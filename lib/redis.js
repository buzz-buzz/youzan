const config = require('config')
const logger = require('./logger')
const Redis = require('ioredis')
const ready = require('readyness')
ready.setLogger(logger.log)
const redisCheck = ready.waitFor('redis:default ready')
const subCheck = ready.waitFor('redis:sub ready')

const redis = new Redis(config.get('redis'))

redis.on('ready', () => {
  logger.log('redis:default', 'ready')
  redisCheck()
})
redis.on('error', e => {
  logger.error('redis:default:error', e)
})

const sub = new Redis(config.get('redis'))

sub.on('ready', () => {
  logger.log('redis:sub', 'ready')
  subCheck()
})
sub.on('error', e => {
  logger.error('redis:sub:error', e)
})

module.exports = {
  redis,
  sub,
  create(name = 'new') {
    const redis = new Redis(config.get('redis'))
    redis.on('ready', () => {
      logger.log(`redis:${name}`, 'ready')
    })
    redis.on('error', e => {
      logger.error(`redis:${name}`, e)
    })
    return redis
  },
}
