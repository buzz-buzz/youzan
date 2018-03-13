// const i18next = require('i18next')
const mongoose = require('mongoose')
const { redis } = require('../lib/redis')
const { queue } = require('../lib/queue')

module.exports = async (ctx, next) => {
  let e
  if (!mongoose.connection.db) e = 'db not connected'
  if (redis.status !== 'ready') e = 'redis not ready'
  // if (queue.client.status !== 'ready') e = 'queue not ready'
  // if (!i18next.isInitialized) e = 'i18n not ready'
  if (e) {
    e = new Error(e)
    e.code = 3
    ctx.throw(e)
  }
  await next()
}
