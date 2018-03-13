const { redis } = require('./redis')

const Cache = {
  async getOrSet(key, fn, opt = {}) {
    const cache = await redis.get(key)
    if (cache) {
      const obj = JSON.parse(cache)
      return opt.wrap ? obj.v : obj
    }
    const obj = await fn()
    const str = JSON.stringify(opt.wrap ? { v: obj } : obj)
    if (opt.ex) {
      await redis.set(key, str, 'ex', opt.ex)
    } else {
      await redis.set(key, str)
    }
    return obj
  },
}

module.exports = Cache
