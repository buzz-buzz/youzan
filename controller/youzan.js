const logger = require('../lib/logger')
const youzan = require('../lib/youzan')

module.exports = {
  async notify(data) {
    return await youzan.notify(data)
  },
}
