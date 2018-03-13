const _ = require('lodash')
const qs = require('qs')
const qjson = require('qjson')
const { group } = require('../lib/page')

module.exports = async (ctx, next) => {
  const query = qs.parse(ctx.querystring)
  if (query.qjson) {
    _.assign(query, qjson.parse(query.qjson))
    delete query.qjson
  }
  _.assign(ctx, group(query))
  await next()
}
