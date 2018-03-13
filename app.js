const fs = require('fs')
const Koa = require('koa')
const config = require('config')
const createServer = require('http').createServer
const bodyParser = require('koa-bodyparser')
const socket = require('./lib/socket')
const logger = require('./lib/logger')
const youzan = require('./lib/youzan')
const shutdown = require('./lib/shutdown')
const route = require('./route')
const queryMiddleware = require('./middleware/query')
const resMiddleware = require('./middleware/res')
const bodyMiddleware = require('./middleware/body')
const readyMiddleware = require('./middleware/ready')
const fromMiddleware = require('./middleware/from')
const versionMiddleware = require('./middleware/version')
// const { middleware: i18nMiddleware } = require('./middleware/i18n')
const { handler: errHandler } = require('./lib/err')
const { clearInterval } = require('./lib/queue')
const standalone = !module.parent || require.main === module

const app = new Koa()
app.proxy = true
// err handler
errHandler(app)
// i18n
// app.use(i18nMiddleware)
// check ready
app.use(readyMiddleware)
// cors
if (config.get('cors.enable') === true) {
  const cors = require('kcors')
  app.use(cors(config.get('cors.config')))
}
// 版本
// app.use(versionMiddleware)
// 来源
// app.use(fromMiddleware)
// 处理 query
app.use(queryMiddleware)
app.use(bodyParser(config.get('body')))
app.use(bodyMiddleware)
// 处理响应
app.use(resMiddleware)

if (standalone && !['production'].includes(process.env.NODE_ENV)) {
  if (fs.existsSync('./tmp.js')) {
    /* eslint import/no-unresolved: off */
    require('./tmp')(app).catch(e => logger.error('test', e))
  }
  const serve = require('koa-static-server')
  app.use(serve({ rootDir: 'node_modules/swagger-ui-dist', rootPath: '/doc' }))
}

// 路由
route(app)

const { port, host } = config.get('app')
if (standalone) {
  const server = createServer(app.callback())
  socket(server)
  clearInterval()
  youzan.addIntervalJob()
  server.listen(port, host, e => {
    if (e) return logger.error(e)
    logger.log('app', `NODE_ENV: ${process.env.NODE_ENV}`, `listening on ${host}:${port}`)
  })
} else {
  module.exports = app
}
