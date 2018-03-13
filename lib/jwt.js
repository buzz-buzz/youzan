const config = require('config')
const jwt = require('jsonwebtoken')

module.exports = {
  sign(payload, opts) {
    return jwt.sign(payload, config.get('jwt.secret'), opts)
  },
  async verify(token, opts) {
    return await jwt.verify(token, config.get('jwt.secret'), opts)
  },
}
