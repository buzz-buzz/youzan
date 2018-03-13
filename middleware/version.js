const _ = require('lodash')
const config = require('config')
const { version } = require('../package.json')
const semver = require('semver')

module.exports = async (ctx, next) => {
  ctx.version = ctx.get('fs-version')
  await next()
}
