const _ = require('lodash')
const http = require('http')
const logger = require('./logger')

const clear = e => {
  _.each(e, (v, k) => {
    if (!['name', 'message', 'stack', 'status', 'headers', 'headerSent', 'code'].includes(k)) {
      delete e[k]
    }
  })
}

process.on('unhandledRejection', (err, p) => {
  clear(err)
  logger.error('unhandledRejection', err)
})
module.exports = {
  handler(app) {
    app.context.onerror = function (err) {
      if (_.isNil(err)) return

      if (!(err instanceof Error)) {
        const newError = new Error(`non-error thrown: ${err}`)
        if (err) {
          if (err.name) newError.name = err.name
          if (err.message) newError.message = err.message
          if (err.stack) newError.stack = err.stack
          if (err.status) newError.status = err.status
          if (err.headers) newError.headers = err.headers
        }
        err = newError
      }

      const headerSent = this.headerSent || !this.writable
      if (headerSent) err.headerSent = true

      // this.app.emit('error', err, this)
      clear(err)
      logger.error('app', err)

      if (headerSent) return

      // if (err.code === 'ENOENT') {
      //   err.status = 404
      // }
      //
      // if (typeof err.status !== 'number' || !http.STATUS_CODES[err.status]) {
      //   err.status = 500
      // }
      // this.status = err.status
      this.status = 200

      this.set(err.headers)
      this.body = { code: err.code || 1, msg: err.message }
      if (process.env.NODE_ENV !== 'production') {
        this.body.stack = err.stack
      }
      this.body = JSON.stringify(this.body)
      this.res.end(this.body)
      // TODO: 记录请求信息 方便追踪错误
      // logger.log(this.request.body)
    }
  },
}
