const _ = require('lodash')
const qs = require('qs')
const { User } = require('../model')
const { redis } = require('../lib/redis')
const logger = require('../lib/logger')

module.exports = async (ctx, next) => {
  ctx.ok = () => {
    ctx.code = 0
  }
  await next()
  if (_.find(['code', 'meta', 'data', 'msg', 'schema'], v => _.has(ctx, v))) {
    if (ctx.from === 'student') {
      if (_.has(ctx.meta, 'next')) {
        if (ctx.meta.next) {
          ctx.set('Link', `<${process.env.NODE_ENV === 'production' ? ctx.origin.replace(/^http/, 'https') : ctx.origin}${ctx.path}?${qs.stringify({ ...ctx.qs, ...ctx.paginate, page: ctx.meta.next })}>; rel="next"`)
        }
      }
    }
    if (_.isNil(ctx.code) && _.isNull(ctx.data)) {
      ctx.throw('Not Found')
    }
    ctx.body = { code: ctx.code || 0, meta: ctx.meta, data: ctx.data, msg: ctx.msg, schema: ctx.schema }
  }
  if (ctx.from === 'student') {
    const userId = _.get(ctx, 'user._id')
    if (userId && (await redis.sismember('user:modified', userId))) {
      if (_.get(ctx, 'body.meta')) {
        _.assign(ctx.body.meta, { user: ctx.user })
      } else {
        _.set(ctx, 'body.meta.user', ctx.user)
      }
      await redis.srem('user:modified', userId)
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    if (_.has(ctx, 'body.wechat.auth.subscribe')) {
      _.set(ctx, 'body.wechat.auth.subscribe', true)
    }
    if (_.has(ctx, 'body.user.wechat.auth.subscribe')) {
      _.set(ctx, 'body.user.wechat.auth.subscribe', true)
    }
  }
}
