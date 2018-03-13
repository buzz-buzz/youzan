const crypto = require('crypto')
const logger = require('./logger')

module.exports = {
  trim(v) {
    let result = v
    try {
      result = v.replace(/[\u0E00-\u0E7F]/g, '')
    } catch (e) {
      logger.error('string:trim:error', e)
    }
    return result
  },
  isObjectId(v) {
    return /^[a-fA-F0-9]{24}$/.test(v)
  },
  md5(v) {
    if (!v) return
    const md5 = crypto.createHash('md5')
    return md5.update(v).digest('hex')
  },
}
