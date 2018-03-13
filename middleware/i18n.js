const path = require('path')
const parser = require('accept-language-parser')
const logger = require('../lib/logger')
const { sub } = require('../lib/redis')
const config = require('config')
const _ = require('lodash')
const { init } = require('../lib/i18n')
const i18next = require('i18next')

init()

module.exports = {
  middleware: async (ctx, next) => {
    const al = ctx.get('accept-language')
    ctx.lang = parser.pick(config.get('i18n'), al) || _.get(parser.parse(al), '0.code') || 'en'
    ctx.t = await new Promise((resolve, reject) => {
      ctx.i18n = i18next.cloneInstance({ lng: ctx.lang }, (e, t) => {
        if (e) reject(e)
        resolve(t)
      })
    })
    // sub.subscribe('i18n:reload', (e, count) => {
    //   if (e) return logger.error(e)
    //   try { ctx.i18n.reloadResources() } catch (e) {
    //     if (process.env.NODE_ENV === 'test') return
    //     logger.error('i18n', e)
    //   }
    // })
    await next()
  },
}
