const mongoose = require('mongoose')
const logger = require('./logger')
const { queue } = require('./queue')
const { redis } = require('./redis')

process.on('SIGINT', async () => {
  await Promise.all([mongoose.disconnect, queue.close, redis.disconnect])
  logger.log('db & queue & redis', 'close on exit')
  process.exit(0)
})
