const moment = require('moment')
const _ = require('lodash')
const defer = require('config/defer').deferConfig

module.exports = {
  body: {
    textLimit: '10mb',
    jsonLimit: '10mb',
    formLimit: '10mb',
  },
  cors: {
    enable: true,
    config: { exposeHeaders: 'link' },
  },
  app: {
    host: '127.0.0.1',
    port: 10001,
  },
  mongodb: {
    uri: 'mongodb://',
    opts: { reconnectTries: Number.MAX_VALUE, useMongoClient: true },
    schema: {
      toJSON: { getters: true, virtuals: true, versionKey: false },
      toObject: defer(cfg => cfg.mongodb.schema.toJSON),
    },
    page: {
      conf: {
        perPage: 20,
        page: 1,
        sort: '-_id',
      },
      perPageMax: 500,
    },
  },
  redis: {
    host: '',
    password: '',
    port: 6379,
    db: 2,
    showFriendlyErrorStack: true,
    enableReadyCheck: true,
    retryStrategy: times => Math.min(times * 50, 2000),
  },
  queue: {
    name: require('os').hostname(),
    queue: { prefix: 'youzan-test-queue' },
    job: {
      default: { attempts: 1, backoff: 1 * 60 * 1000, removeOnComplete: true, removeOnFail: true },
      youzan: {
        interval: defer(cfg => ({
          ...cfg.queue.job.default,
          jobId: 'youzanInterval',
          repeat: { cron: '*/30 * * * *' },
          // repeat: { cron: '* * * * *' },
        })),
      },
    },
  },
  logger: {
    alertUrl: '',
    tracer: {
      level: 'log', // 'log':0, 'trace':1, 'debug':2, 'info':3, 'warn':4, 'error':5
      // inspectOpt: {
      //   showHidden: true,
      //   depth: null,
      // },
    },
  },
  youzan: {
    default: {
      clientID: '',
      clientSecret: '',
      kdt_id: '',
      kdt_name: '',
    },
  },
  api: {
    buzzService: 'http://localhost:16888',
  },
  deploy: {
    production: {
      user: '',
      host: [
        { host: '' },
      ],
    },
    dev: {
      user: '',
      host: [
        { host: '' },
      ],
    },
  },
  notify: {
    youzan: {
      url: '',
      channel: '',
    },
  },
}
