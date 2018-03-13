const _ = require('lodash')
const logger = require('../lib/logger')
const jwt = require('../lib/jwt')
const { trim } = require('../lib/string')

module.exports = async (ctx, next) => {
  if (_.has(ctx.request.body, '__v')) {
    delete ctx.request.body.__v
  }
  if (_.isObjectLike(ctx.request.body)) {
    ctx.request.body = JSON.parse(trim(JSON.stringify(ctx.request.body)))
  }
  let userId = ctx.get('fs-user-id')
  if (process.env.NODE_ENV === 'production' || !userId) {
    const data = await jwt.verify(ctx.get('authorization')).catch(e => {})
    userId = _.get(data, 'id')
  }
  ctx.userId = userId
  logger.log('req', {
    url: ctx.url,
    headers: ctx.request.header,
    method: ctx.method,
    ip: ctx.ip,
    query: ctx.query,
    qs: ctx.qs,
    paginate: ctx.paginate,
    body: ctx.request.body,
    userId,
  })
  await next()
  // logger.debug('res', {
  //   body: ctx.body,
  // })
}
