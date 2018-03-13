const moment = require('moment')
const defer = require('config/defer').deferConfig

module.exports = {
  app: {
    host: '127.0.0.1',
    port: 10001,
  },
  cors: {
    enable: true,
    config: { exposeHeaders: 'link' },
  },
  mongodb: {
    uri: '',
  },
  redis: {
    host: '',
    password: '',
    port: 6379,
    db: 0,
  },
  queue: {
    name: 'youzan',
    queue: { prefix: 'youzan-queue' },
    job: {
      default: { attempts: 3 },
    },
  },
}
