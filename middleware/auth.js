const _ = require('lodash')
const model = require('../model')
const logger = require('../lib/logger')

module.exports = (from, needUser = true) => async (ctx, next) => {
  if (!_.isEmpty(from) && ctx.from !== from) ctx.throw('Invalid Request-From')
  const { [_.upperFirst(ctx.from)]: User } = model
  if (needUser) {
    let user
    if (ctx.userId) {
      user = await User.findOne({ id: ctx.userId })
        .then(User.valid)
        .catch(e => {
          e.code = 2
          ctx.throw(e)
        })
    } else {
      user = await User.findOneByTokenOrId(ctx.get('authorization'), ctx.get('fs-user-id'))
        .then(User.valid)
        .catch(e => {
          e.code = 2
          ctx.throw(e)
        })
    }
    ctx.user = user
  }
  // const name = ctx._matchedRouteName
  // if (!_.isEmpty(name)) {
  //   const [resource, action] = name.split(':')
  //   if (!_.isEmpty(resource) && !_.isEmpty(action)) {
  //
  //   }
  // }
  await next()
}
