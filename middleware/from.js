const _ = require('lodash')
const config = require('config')

module.exports = async (ctx, next) => {
  if (_.some(['/favicon'], i => ctx.path.startsWith(i))) return ctx.status = 204
  ctx.from = ctx.get('fs-request-from')
  if (_.some(['/doc', '/wechat', '/youzan/receive', '/test', '/qiniu/notify', '/user/fixFollowUpUser'], i => ctx.path.startsWith(i))) return await next()
  if (!config.get('from').includes(ctx.from)) ctx.throw(new Error('Invalid Request-From'))
  await next()
}
