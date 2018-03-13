const _ = require('lodash')
const config = require('config')
const { queue } = require('./queue')
const logger = require('./logger')
const { redis } = require('./redis')
const util = require('util')
const { SMS, DYSMS } = require('waliyun')
const isSms = config.get('sms.type') === 'sms'
const sms = isSms ? SMS(config.get('sms.conf')) : DYSMS(config.get('sms.conf'))

const Sms = {
  async send(type, mobile, param) {
    if (isSms) {
      const { Code, Message } = await sms.singleSendSMS({ ...config.get('sms.tpl')[type], RecNum: _.isArray(mobile) ? mobile : [mobile], ParamString: JSON.stringify(param) })
      if (Code) throw new Error(Message)
    } else {
      const { Code, Message } = await sms.sendSms({ ...config.get('sms.tpl')[type], PhoneNumbers: _.isArray(mobile) ? mobile : [mobile], TemplateParam: JSON.stringify(param) })
      if (Code !== 'OK' && Message !== 'OK') throw new Error(Message)
    }
  },
  // // 添加队列任务: 类型, 手机号, 变量
  // addJob(type, recNum, param) {
  //   // 加入队列
  //   queue.add('sms:send', { ...config.get('sms')[type], RecNum: _.isArray(recNum) ? recNum : [recNum], ParamString: JSON.stringify(param) })
  // },
  // 生成验证码并加入 redis
  async createCode(type, mobile, from) {
    const { digit, expire } = config.get('code')
    const code = _.random(10 ** (digit - 1), (10 ** digit) - 1)
    await redis.set(`sms:${type}:${mobile}`, `${from}:${code}`, 'ex', expire)
    return { code, expire }
  },
  // 验证验证码并删除
  async verifyCode(type, mobile, code, from) {
    const str = `sms:${type}:${mobile}`
    const value = await redis.get(str)
    if (`${from}:${code}` !== String(value)) throw new Error('invalid verification code')
    await redis.del(str)
  },
  // 生成验证码并加入发送队列
  async addCodeJob(type, mobile, from) {
    const { code, expire } = await this.createCode(type, mobile, from)
    // this.addJob(type, mobile, { code: String(code) }) // 阿里云不允许数字
    const send = this.send(type, mobile, { code: String(code) })
    if (process.env.NODE_ENV === 'production') {
      await send
    } else {
      await send.catch(e => logger.error('sms', e))
    }
    return { code: process.env.NODE_ENV === 'production' ? undefined : code, expire }
  },
}

// queue.process('sms:send', async job => await Sms.send(job.data))

module.exports = Sms
