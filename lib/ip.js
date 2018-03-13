const _ = require('lodash')
const axios = require('axios')

const IP = {
  async info(ip, src = 'taobao') {
    if (src === 'taobao') {
      const res = await axios(`http://ip.taobao.com/service/getIpInfo.php?ip=${ip}`)
      return _.get(res, 'data.data', {})
    }
  },
}

module.exports = IP
