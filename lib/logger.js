const _ = require('lodash')
const config = require('config')
const os = require('os')
const tracer = require('tracer')
const axios = require('axios')
const chalk = require('chalk')
const util = require('util')
const unhandled = []

const logger = tracer.colorConsole({
  dateformat: 'yyyy-mm-dd HH:MM:ss',
  async preprocess(param) {
    const { timestamp, message, title, level, args: _args, file, pos, line, path: _path, method, stack } = param
    const args = Array.from(_args)
    if (!_.isString(args[0])) {
      args.unshift('undefined')
    }
    if (args[0].startsWith('ready: [')) return
    // 'log':0, 'trace':1, 'debug':2, 'info':3, 'warn':4, 'error':5
    let name = []
    if (args[0].includes(':')) {
      name = args[0].split(':')
      args.shift()
    } else {
      name.push(args[0])
      args.shift()
    }
    if (process.stdout.isTTY) {
      _.each(name, (_v, i) => {
        const v = ` ${_v} `
        let str
        switch (title) {
        case 'trace':
          str = chalk.bgHsl(181, 43, 50 - (i * 5))(v)
          break
        case 'debug':
          str = chalk.bgHsl(301, 19, 50 - (i * 5))(v)
          break
        case 'info':
          str = chalk.bgHsl(207, 42, 50 - (i * 5))(v)
          break
        case 'warn':
          str = chalk.bgHsl(40, 50, 50 - (i * 5))(v)
          break
        case 'error':
          str = chalk.bgHsl(359, 42, 50 - (i * 5))(v)
          break
        default:
          str = chalk.bgHsl(359, 0, 50 - (i * 5))(v)
        }
        process.stdout.write(str)
      })
      // if (args[0] && args[0].endsWith && args[0].endsWith('ready')) {
      //   args[0] = 'ready'
      // }
      const body = args.map(i => (_.isObjectLike(i) ? util.inspect(i, { showHidden: true, depth: null, colors: true }) : i)).join(', ')
      console.log(chalk` {hsl(359, 0, 80) ${body}}`)
      const path = _path.replace(process.env.HOME, '~')
      console.log(chalk`{hsl(359, 0, 30) ${timestamp}} {hsl(359, 0, 30) ${path}:${line}:${pos}}\n`)
    } else {
      console.log(`[${name.join(':')}] ${args.map(i => (_.isObjectLike(i) ? util.inspect(i, { showHidden: true, depth: null, colors: false }) : i)).join(', ')}`)
    }
  },
  transport: [
    async data => {
      // console.log(data.args)
    },
  ],
  ...config.get('logger.tracer'),
})

module.exports = logger
