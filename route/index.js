const _ = require('lodash')
const path = require('path')
const config = require('config')
const { readDirR } = require('../lib/fs')
const logger = require('../lib/logger')
const Router = require('koa-router')

module.exports = app => {
  readDirR(__dirname).map(v => v.replace(`${__dirname}/`, './')).filter(v => v !== './index.js').forEach(v => {
    if (process.env.NODE_ENV !== 'production' || v !== './doc.js') {
      const module = require(v)
      const router = module(new Router())
      // _.map(router.stack, i => console.log(i.name, i.path))
      app.use(router.routes())
      // logger.debug(router.stack.map(i => i.name))
    }
  })
  const router = new Router()
  router.all('notFound', '*', async ctx => {
    ctx.throw(new Error(`Not Found: ${ctx.url}`))
  })
  app.use(router.routes())
}
