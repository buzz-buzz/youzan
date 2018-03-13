const _ = require('lodash')
const mongoose = require('mongoose')

module.exports = {
  validator: {
    isInteger: {
      validator: Number.isInteger,
      message: 'integer validator failed for path `{PATH}` with value `{VALUE}`.',
    },
    isUnique: { message: 'unique validator failed for path `{PATH}` with value `{VALUE}`.' },
  },
}
