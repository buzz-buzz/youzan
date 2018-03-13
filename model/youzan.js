// 订单
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId

module.exports = {
  schema: {
    tid: { type: String, unique: true },
    added: Boolean,
  },
  plugin: {},
}
