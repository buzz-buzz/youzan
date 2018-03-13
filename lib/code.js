const { redis } = require('./redis')
const jwt = require('./jwt')
const _ = require('lodash')
const config = require('config')
const { digit, expire } = config.get('code')
const base = 10 ** (digit - 1)

module.exports = {
  createToken(data, expiresIn) {
    return jwt.sign(data, expiresIn ? { expiresIn } : null)
  },
  async verifyToken(token) {
    return await jwt.verify(token)
  },
  // 初始化范围和数字, 增加数字
  async init() {
    let range = await redis.get('code:range')
    if (_.isNil(range)) {
      range = base
      await redis.multi()
        .set('code:range', range)
        .sadd('code:base', _.range(range, range + base))
        .exec()
    }
    const len = await redis.scard('code:base')
    if (len < (base / 2)) {
      range = Number(range) + base
      await redis.multi()
        .set('code:range', range)
        .sadd('code:base', _.range(range, range + base))
        .exec()
    }
  },
  // 创建 code 并存入 redis
  async create(data, id, ex = expire) {
    await this.init()
    const v = JSON.stringify(data)
    const old = await redis.hget('code:id', id)
    const code = await redis.spop('code:base')
    if (old) {
      await redis.multi()
        .del(`code:${old}`)
        .hdel('code:code', old)
        .sadd('code:base', old)
        .hset('code:id', id, code)
        .hset('code:code', code, id)
        .set(`code:${code}`, v, 'ex', ex)
        .exec()
    } else {
      await redis.multi()
        .hset('code:id', id, code)
        .hset('code:code', code, id)
        .set(`code:${code}`, v, 'ex', ex)
        .exec()
    }
    return code
  },
  // 兑换 code 并放回 base
  async get(code) {
    const v = `code:${code}`
    const [[, data]] = await redis.multi()
      .get(v)
      .del(v)
      .exec()
    if (!data) throw new Error('Code Not Found')
    const id = await redis.hget('code:code', code)
    await redis.multi()
      .hdel('code:id', id)
      .hdel('code:code', code)
      .sadd('code:base', code)
      .exec()
    return JSON.parse(data)
  },
}
