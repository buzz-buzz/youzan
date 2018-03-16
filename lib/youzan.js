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

const fields = ['tid', 'status', 'orders', 'created', 'update_time', 'fans_info', 'buyer_message']

const Yz = {
  getNotifyChannelByEnv(env) {
    if (env === '测试') {
      return config.get('notify.youzan.channelTest')
    }
    return config.get('notify.youzan.channel')
  },
  getAdminBaseUrlByEnv(env) {
    if (env === '测试') {
      return config.get('api.buzzAdminTest')
    }
    return config.get('api.buzzAdmin')
  },
  getBaseUrlByEnv(env) {
    if (env === '测试') {
      return config.get('api.buzzServiceTest')
    }
    return config.get('api.buzzService')
  },
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

  // 取微信信息
  async getUsersByOpenids(weixin_openid) {
    const { user } = await Yz.api('users.weixin.follower.get', { weixin_openid, fields: 'weixin_openid,nick,avatar,sex,union_id,city,province' })
    return user
  },

  // 用订单 id 取 trade
  async getTradeByTradeId(tid) {
    const { trade } = await Yz.api('trade.get', { tid, fields: fields.join(',') })
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
      fields: fields.join(','),
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
    await bluebird.each(trades, async trade => {
      const { tid, status, orders, created, update_time, fans_info = {}, buyer_message } = trade
      const fn = async () => {
        if (_.isEmpty(tid) || _.isEmpty(orders) || !['WAIT_SELLER_SEND_GOODS', 'WAIT_BUYER_CONFIRM_GOODS', 'TRADE_BUYER_SIGNED'].includes(status)) {
          logger.log('youzan:trade:parse', 'invalid', { tid, orders, status })
          return
        }
        const { fans_weixin_openid: openid, buyer_id: buyerId, fans_nickname: nickname, fans_id: fanId } = fans_info
        const data = []
        await bluebird.each(orders, async ({ buyer_messages, outer_item_id, num, pic_path, title }) => {
          const mobile = _.get(_.find(buyer_messages, i => i.title === '手机号'), 'content')
          const { env, period } = this.parseOuterItemId(outer_item_id)
          if (!mobile || !period) {
            logger.log('youzan:trade:parse', 'invalid', { mobile, outer_item_id, env, period })
            return
          }
          data.push({ env, mobile, num, period, pic_path, title, buyer_messages })
        })
        const { created: isNewDoc, doc } = await Youzan.findOrCreate({ tid })
        if (!isNewDoc && (doc.added || doc.ongoing)) {
          logger.log('youzan:trade:parse', 'invalid', { added: doc.added, ongoing: doc.ongoing })
          return
        }
        // 加权限
        await bluebird.each(data, async ({ env, mobile, period, num, pic_path, title, buyer_messages }) => {
          // 给 env 环境的 openid 的用户添加 num * period 课时
          const classHours = num * period
          logger.log('youzan:trade:parse:classHours', { env, openid, classHours, pic_path, title, mobile, buyer_message, buyer_messages })
          let getUserErr
          const resUserByWechat = await axios({
            url: `${this.getBaseUrlByEnv(env)}/api/v1/users/by-wechat?openid=${openid}`,
            validateStatus: () => true,
          }).catch(e => {
            getUserErr = _.get(e, 'message', '获取用户失败')
          })
          logger.log('youzan:getUserByWechat', { env, url: `${this.getBaseUrlByEnv(env)}/api/v1/users/by-wechat?openid=${openid}`, res: resUserByWechat })
          if (getUserErr) {
            doc.ongoing = false
            await doc.save()
            logger.log('youzan:getUserByWechat:error', {
              url: `${this.getBaseUrlByEnv(env)}/api/v1/users/by-wechat?openid=${openid}`,
              res: resUserByWechat,
              err: getUserErr,
            })
            return await axios({
              url: config.get('notify.youzan.url'),
              method: 'post',
              data: {
                channel: this.getNotifyChannelByEnv(env),
                text: `**订单**: ${tid} [链接](https://www.youzan.com/v2/trade/order/detail?order_no=${tid})
**名称**: ${title}
**获取用户失败**: openid ${openid}
**错误**: ${getUserErr}`,
                markdown: true,
              },
            }).catch(e => {})
          }
          const userByWechat = _.get(resUserByWechat, 'data')
          let userId = _.get(userByWechat, 'user_id')
          let beforeClassHours = _.get(userByWechat, 'class_hours')
          if (_.isNil(beforeClassHours)) {
            beforeClassHours = 0
          }
          let createUserErr
          if (!userId) {
            const { weixin_openid, nick, avatar, sex, union_id, city, province } = await this.getUsersByOpenids(openid)
            const newUserData = {
              role: 's',
              wechat_name: nick,
              wechat_openid: openid,
              wechat_unionid: union_id,
              avatar,
            }
            const newUserRes = await axios({
              method: 'post',
              url: `${this.getBaseUrlByEnv(env)}/api/v1/users`,
              data: newUserData,
            }).catch(e => {
              createUserErr = _.get(e, 'message', '创建用户失败')
            })
            logger.log('youzan:createUserByWechat', {
              env,
              url: `${this.getBaseUrlByEnv(env)}/api/v1/users`,
              data: newUserData,
              res: newUserRes,
            })
            userId = _.get(newUserRes, 'data')
            if (!userId) {
              createUserErr = '创建用户未返回有效的 userId'
            }
            if (createUserErr) {
              doc.ongoing = false
              await doc.save()
              logger.log('youzan:createUser:error', {
                url: `${this.getBaseUrlByEnv(env)}/api/v1/users`,
                data: newUserData,
                res: newUserRes,
                err: createUserErr,
              })
              return await axios({
                url: config.get('notify.youzan.url'),
                method: 'post',
                data: {
                  channel: this.getNotifyChannelByEnv(env),
                  text: `**订单**: ${tid} [链接](https://www.youzan.com/v2/trade/order/detail?order_no=${tid})
  **名称**: ${title}
  **创建用户**: data ${JSON.stringify(newUserData)}
  **错误**: ${createUserErr}`,
                  markdown: true,
                },
              }).catch(e => {})
            }
            beforeClassHours = 0
          }
          let addClassHoursErr = ''
          const classHoursRes = await axios({
            method: 'put',
            url: `${this.getBaseUrlByEnv(env)}/api/v1/user-balance/${userId}`,
            data: {
              class_hours: classHours,
            },
          }).catch(e => {
            addClassHoursErr = _.get(e, 'message', '增加课时失败')
          })
          logger.log('youzan:addClassHours', {
            env,
            url: `${this.getBaseUrlByEnv(env)}/api/v1/user-balance/${userId}`,
            data: {
              class_hours: classHours,
            },
            res: classHoursRes,
          })
          let currentClassHours = _.get(classHoursRes, 'data.class_hours')
          if (_.isNil(currentClassHours)) {
            currentClassHours = 0
          }
          let classHoursInfo = `${beforeClassHours}+${classHours}=${currentClassHours}`
          if (Number(currentClassHours) !== Number(beforeClassHours) + Number(classHours)) {
            addClassHoursErr = '增加课时失败'
            classHoursInfo = `${beforeClassHours}+${classHours}≠${currentClassHours}`
          }
          const text = `**订单**: ${tid} [链接](https://www.youzan.com/v2/trade/order/detail?order_no=${tid})
**名称**: ${title}
**${addClassHoursErr || '课时'}**: ${classHoursInfo}
**用户**: ${nickname} [有赞](https://www.youzan.com/scrm/customer/customer/#/info/${buyerId}) [后台](${this.getAdminBaseUrlByEnv(env)}/students/${userId})
${buyer_messages && `${_.chain(buyer_messages)
    .filter(i => _.size(i.content) > 0)
    .map(i => {
      if (i.title === '手机号') {
        return `**${i.title}**: ${i.content} [拨打](tel://${i.content})`
      }
      return `**${i.title}**: ${i.content}`
    })
    .join('\n')
    .value()}`}
${buyer_message && `**备注**: ${buyer_message}`}`.replace(/\n$/g, '')
          if (addClassHoursErr) {
            logger.log('youzan:addClassHours:error', {
              url: `${this.getBaseUrlByEnv(env)}/api/v1/user-balance/${userId}`,
              data: {
                class_hours: classHours,
              },
              res: classHoursRes,
              err: addClassHoursErr,
            })
          }
          await axios({
            url: config.get('notify.youzan.url'),
            method: 'post',
            data: {
              channel: this.getNotifyChannelByEnv(env),
              text,
              markdown: true,
            },
          }).catch(e => {})
          if (!addClassHoursErr) {
            doc.added = true
          }
          doc.text = text
        })
        doc.ongoing = false
        await doc.save()
      }
      await fn().catch(e => {
        logger.error('youzan:trade:parse:error', e, trade)
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
