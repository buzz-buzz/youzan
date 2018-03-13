const config = require('config')
const Queue = require('bull')
const logger = require('./logger')
const { redis, sub, create } = require('./redis')
// https://github.com/OptimalBits/bull/commit/ce0048c1a7e3903d25d048572919e5c11697adc5
function createQueue(name) {
  const queue = new Queue(name ? `${config.get('queue.name')}-${name}` : config.get('queue.name'), {
    ...config.get('queue.queue'),
    createClient(type) {
      switch (type) {
      case 'client':
        return redis
      case 'subscriber':
        return sub
      default:
        return create('queue')
      }
    },
  })
  queue.on('error', e => {
    logger.error(`queue:${name || 'default'}`, 'error', e)
  })
  queue.on('failed', (job, e) => {
    logger.error(`${name || 'default'}:job:failed:${job.name}:${job.id}`, job.data, e)
  })
  queue.on('completed', job => {
    logger.log(`${name || 'default'}:job:completed:${job.name}:${job.id}`, job.data)
  })
  return queue
}

const queue = createQueue()
const interval = createQueue('interval')
function clearInterval() {
  interval.clean(0, 'delayed')
  interval.clean(0, 'wait')
  interval.clean(0, 'active')
  interval.clean(0, 'completed')
  interval.clean(0, 'failed')

  const multi = interval.multi()
  multi.del(interval.toKey('repeat'))
  multi.exec()
}
module.exports = {
  queue,
  interval,
  clearInterval,
}
