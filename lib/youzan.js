const bluebird = require('bluebird')
const _ = require('lodash')
const axios = require('axios')
const moment = require('moment')
const config = require('config')
const conf = config.get('youzan.default')
const { md5 } = require('./string')
const { redis } = require('./redis')
const { queue, interval } = require('./queue')
const { Youzan } = require('../model')
const logger = require('./logger')
const merge = require('deepmerge')

const Yz = {
  async getToken() {
    let token = await redis.get(`youzan:token:${conf.clientID}:${conf.clientSecret}:${conf.kdt_id}`)
    if (!token) {
      const { data } = await axios({
        method: 'post',
        url: 'https://open.youzan.com/oauth/token',
        data: {
          client_id: conf.clientID,
          client_secret: conf.clientSecret,
          grant_type: 'silent',
          kdt_id: conf.kdt_id,
        },
      })
      const { access_token, expires_in } = data
      token = access_token
      await redis.set(`youzan:token:${conf.clientID}:${conf.clientSecret}:${conf.kdt_id}`, token, 'ex', expires_in)
    }
    return token
  },
  async api(api, params) {
    const apiArray = api.split('.')
    const action = apiArray.pop()
    const name = apiArray.join('.')
    const { data } = await axios({
      method: 'get',
      url: `https://open.youzan.com/api/oauthentry/youzan.${name}/3.0.0/${action}`,
      params: {
        access_token: await Yz.getToken(),
        ...params,
      },
    })
    const e = _.get(data, 'error_response.msg')
    if (e) {
      throw new Error(e)
    }
    return _.get(data, 'response')
  },
  // 用订单 id 取 trade
  async getTradeByTradeId(tid) {
    const { trade } = await Yz.api('trade.get', { tid, fields: 'tid,status,orders,title,created,update_time' })
    logger.log('youzan:trade:get', { tid, trade })
    return trade
  },
  // 取 trades
  async getTrades(opts) {
    const { trades, has_next } = await Yz.api('trades.sold.get', opts)
    return { trades, has_next }
  },
  // 取所有 trades
  async getAllTrades(opts) {
    let trades = []
    let page_no = 1
    const fn = async () => {
      const result = await Yz.getTrades({
        page_no,
        use_has_next: true,
        ...opts,
      })
      trades = trades.concat(result.trades)
      if (result.has_next) {
        page_no += 1
        await fn()
      }
    }
    await fn()
    return trades
  },
  // 取近期 trades
  async getRecentTrades(hour) {
    const format = 'YYYY-MM-DD HH:mm:ss'
    const opts = {
      start_update: moment().subtract(hour, 'hour').format(format),
      end_update: moment().format(format),
      fields: 'tid,status,orders,title,created,update_time',
    }
    return await Yz.getAllTrades(opts)
  },
  // 处理 outer_item_id
  parseOuterItemId(v) {
    if (_.includes(v, '测试')) {
      return {
        env: '测试',
        period: _.replace(v, '测试', ''),
      }
    }
    return {
      env: '正式',
      period: v,
    }
  },
  async parseTrades(trade, opt) {
    const trades = _.isArray(trade) ? trade : [trade]
    await bluebird.each(trades, async ({ tid, status, orders, title, created, update_time }) => {
      const fn = async () => {
        if (_.isEmpty(tid) || _.isEmpty(orders) || !['WAIT_SELLER_SEND_GOODS', 'WAIT_BUYER_CONFIRM_GOODS', 'TRADE_BUYER_SIGNED'].includes(status)) {
          logger.log('youzan:trade:parse', 'invalid', { tid, orders, status })
          return
        }
        const data = []
        await bluebird.each(orders, async ({ buyer_messages, outer_item_id, num }) => {
          const mobile = _.get(_.find(buyer_messages, i => i.title === '手机号'), 'content')
          const { env, period } = this.parseOuterItemId(outer_item_id)
          if (!mobile || !period) {
            logger.log('youzan:trade:parse', 'invalid', { mobile, outer_item_id, env, period })
            return
          }
          data.push({ env, mobile, num, period })
        })
        const { doc } = await Youzan.findOrCreate({ tid })
        if (doc.added) {
          logger.log('youzan:trade:parse', 'invalid', { added: doc.added })
          return
        }
        // 加权限
        await bluebird.each(data, async ({ env, mobile, period, num }) => {
          // TODO: 给 env 环境的手机号为 mobile 的用户添加 num * period 课时
          logger.debug('youzan:trade:parse:add', { env, mobile, add: num * period })
        })
        doc.added = true
        await doc.save()
      }
      await fn().catch(e => {
        logger.error('youzan:trade:parse:error', e, { tid, status, orders, title, created, update_time })
      })
    })
  },
  parseMsg(v) {
    const data = _.attempt(() => JSON.parse(decodeURIComponent(v)))
    return _.isError(data) ? {} : data
  },
  // 处理推送
  async notify(data) {
    const success = { code: 0, msg: 'success' }
    try {
      const { id, kdt_id, test, msg } = data
      const { update_time, status } = this.parseMsg(msg)
      logger.log('youzan:notify:check', { id, kdt_id, test, update_time, status })
      if (!test && String(kdt_id) === String(conf.kdt_id) && md5(`${conf.clientID}${msg}${conf.clientSecret}`)) {
        await this.getTradeAndParse({ id, update_time, status })
      }
    } catch (e) {
      logger.log('youzan:notify:error', e, { data })
    }
    return success
  },
  async getTradeAndParse({ id, update_time, status }) {
    // 待优化
    const trade = await this.getTradeByTradeId(id)
    await this.parseTrades(trade)
  },
  async addIntervalJob() {
    // if (process.env.NODE_ENV !== 'production') return
    interval.process('youzanInterval', async job => await this.processIntervalJob(job))
    interval.add('youzanInterval', {}, config.get('queue.job.youzan.interval'))
  },
  async processIntervalJob() {
    const trades = await this.getRecentTrades(1)
    await this.parseTrades(trades)
  },
}

module.exports = Yz
