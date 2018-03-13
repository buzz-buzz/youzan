const _ = require('lodash')
const phone = require('phone')

const Phone = {
  num(mobile, area = 'CHN') {
    if (_.isEmpty(mobile)) return null
    const str = phone(String(mobile), area)[0]
    return _.isEmpty(str) ? null : str.replace('+86', '')
  },
}

module.exports = Phone
