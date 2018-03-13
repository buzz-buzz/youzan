const config = require('config')
const bluebird = require('bluebird')
const _ = require('lodash')
const { Student } = require('../model')
const { redis } = require('./redis')
const qiniu = require('./qiniu')
const logger = require('./logger')
const { auth, youzan } = config.get('wechat')
const OAuth = require('co-wechat-oauth')
const API = require('co-wechat-api')
const api = new API(
  auth.appID, auth.appSecret,
  async () => JSON.parse(await redis.get(`wechat:api:${auth.appID}`)),
  async token => {
    await redis.set(`wechat:api:${auth.appID}`, JSON.stringify(token))
  }
)

api.registerTicketHandle(async type => JSON.parse(await redis.get(`wechat:ticket:${type}:${auth.appID}`)), async (type, token) => {
  await redis.set(`wechat:ticket:${type}:${auth.appID}`, JSON.stringify(token))
})

const youzanApi = new API(
  youzan.appID, youzan.appSecret,
  async () => JSON.parse(await redis.get(`wechat:api:${youzan.appID}`)),
  async token => {
    await redis.set(`wechat:api:${youzan.appID}`, JSON.stringify(token))
  }
)

youzanApi.registerTicketHandle(async type => JSON.parse(await redis.get(`wechat:ticket:${type}:${youzan.appID}`)), async (type, token) => {
  await redis.set(`wechat:ticket:${type}:${youzan.appID}`, JSON.stringify(token))
})

const client = new OAuth(
  auth.appID, auth.appSecret,
  async openid => JSON.parse(await redis.get(`wechat:oauth:${auth.appID}:${openid}`)),
  async (openid, token) => {
    await redis.set(`wechat:oauth:${auth.appID}:${openid}`, JSON.stringify(token), 'ex', _.get(token, 'expires_in', 7200))
  }
)

const Wx = {
  api,
  youzanApi,
  client,
  authUrl(state) {
    return client.getAuthorizeURL(auth.redirectUrl, state, 'snsapi_base')
  },
  async code(code) {
    const { data } = await client.getAccessToken(code)
    return data
  },
  async userInfo(openid) {
    return await client.getUser(openid)
  },
  async user({ openid, type = 'auth' }) {
    if (type === 'youzan') {
      return await youzanApi.getUser({ openid, lang: 'zh_CN' })
    }
    return await api.getUser({ openid, lang: 'zh_CN' })
  },
  async createTmpQRCode(sceneId, expire, type = 'auth') {
    if (type === 'youzan') {
      return await youzanApi.createTmpQRCode(sceneId, expire)
    }
    return await api.createTmpQRCode(sceneId, expire)
  },
  async createLimitQRCode(sceneId, type = 'auth') {
    if (type === 'youzan') {
      return await youzanApi.createLimitQRCode(sceneId)
    }
    return await api.createLimitQRCode(sceneId)
  },
  async sendTpl(_openid, name, data, type = 'auth', force) {
    let openid = _openid
    if (process.env.NODE_ENV !== 'production') {
      if (!force) return
      const xream = await Student.findOne({ mobile: '18657198908' })
      openid = _.get(xream, 'wechat.auth.openId')
    }
    if (type === 'youzan') {
      const tpl = youzan.tpl[name](data)
      return await youzanApi.sendTemplate(openid, tpl.id, tpl.url, tpl.appid, tpl.pagepath, tpl.data, tpl.color)
    }
    const tpl = auth.tpl[name](data)
    return await api.sendTemplate(openid, tpl.id, tpl.url, tpl.appid, tpl.pagepath, tpl.data, tpl.color)
  },
  async sendTpls(items, fn) {
    await bluebird.each(items, async i => {
      const arg = fn(i)
      // 测试
      const lessonName = _.get(arg, '2.lessonName')
      if (_.isString(lessonName) && lessonName.startsWith('很严肃的线上测试')) {
        await Wx.sendTpl(...arg).catch(e => {
          logger.error('wechat:sendTpls:error', { arg, e })
        })
        await bluebird.delay(youzan.delay)
      }
    })
  },
  async updateOrCreateStudentByOpenid({ openid, beforeSave, type }) {
    const { subscribe, unionid, headimgurl: __headimgurl, nickname } = await Wx.user({ openid, type })
    const _headimgurl = __headimgurl ? __headimgurl.replace(/\\\//g, '/') : __headimgurl
    if (_.isEmpty(unionid)) throw new Error('UnionID Not Found')
    const { doc: user } = await Student.findOrCreate({ 'wechat.unionId': unionid })
    if (!_.isEmpty(nickname)) {
      _.set(user, 'wechat.nickname', nickname)
    }

    if (!_.isEmpty(_headimgurl) && _headimgurl !== _.get(user, 'wechat.logo')) {
      const qiniuData = await qiniu.uploadUrl(_headimgurl).catch(e => {
        logger.error('qiniu:uploadUrl', e, _headimgurl, user)
      })
      const key = _.get(qiniuData, 'key')
      const headimgurl = key ? `${config.get('qiniu.type.default.prefix')}/${key}` : _headimgurl
      _.set(user, 'wechat.avatar', headimgurl)
      _.set(user, 'wechat.logo', _headimgurl)
      if (_.isEmpty(_.get(user, 'avatar')) || !user.avatar.includes('cdn-fs.xxjz.org') || user.avatar.startsWith(config.get('avatar'))) {
        _.set(user, 'avatar', headimgurl)
      }
    }
    _.set(user, 'wechat.auth.openId', openid)
    _.set(user, 'wechat.auth.subscribe', Number(subscribe) === 1)
    if (_.isFunction(beforeSave)) beforeSave(user)
    return await user.save()
  },
}

module.exports = Wx
