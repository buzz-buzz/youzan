const logger = require('../lib/logger')
const youzan = require('../lib/youzan')
const { Youzan } = require('../model')

module.exports = {
  async notify(data) {
    return await youzan.notify(data)
  },
  async allot({ token, text, channel_name }) {
    if (token !== 'd3e8701ee7a34e22f8383c2bf00d1df2') {
      return
    }
    logger.debug('allot', { token, text, channel_name })
    // '@bot 分配订单 E20180315101920004000003 给 @xream'
    return { text: new Date() }
  },
}
