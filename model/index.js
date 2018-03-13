const logger = require('../lib/logger')
const { readDirR } = require('../lib/fs')
const { validator: { isUnique } } = require('../lib/schema')
const _ = require('lodash')
const path = require('path')
const config = require('config')
const mongoose = require('mongoose')
const sequence = require('mongoose-sequence')(mongoose)
const findOrCreate = require('mongoose-findorcreate')
const uniqueValidator = require('mongoose-unique-validator')
const autopopulate = require('mongoose-autopopulate')
const ready = require('readyness')
ready.setLogger(logger.log)
const dbCheck = ready.waitFor('db:connection connected')
require('../lib/page').db()
// const mongooseAsync = require('mongoose-async')
// mongoose.plugin(mongooseAsync, {
//   getters: {},
//   setters: {
//     applyOn: 'save',
//     // (enum) When setters should be applied
//     // change: only execute when path was modified (behaves like an ordinary setter)
//     // save: execute every time before saving
//   },
// })

mongoose.Promise = Promise
if (!['production'].includes(process.env.NODE_ENV)) {
  mongoose.set('debug', (collection, method, ...args) => logger.log(`db:${collection}:${method}`, ...args))
}

const connection = mongoose.connect(config.get('mongodb.uri'), config.get('mongodb.opts'))
connection.on('open', () => {
  logger.log('db:connection', 'connected')
  dbCheck()
})
connection.on('error', e => {
  logger.error('db:error', e)
})

const discriminators = []
const others = []

readDirR(__dirname).map(v => v.replace(`${__dirname}/`, './')).filter(v => v !== './index.js').forEach(v => {
  const module = require(v)
  const item = {
    name: _.upperFirst(_.camelCase(path.basename(v, '.js'))),
    ...module,
  }
  item.discriminator ? discriminators.push(item) : others.push(item)
})

const models = {}
_.each([...others, ...discriminators], v => {
  const schema = new mongoose.Schema(v.schema, {
    discriminatorKey: 'kind',
    strict: true,
    timestamps: true,
    toJSON: config.get('mongodb.schema.toJSON'),
    toObject: config.get('mongodb.schema.toObject'),
  })
  if (v.class) schema.loadClass(v.class)
  if (v.fn) v.fn(schema)
  schema.plugin(findOrCreate)
  schema.plugin(autopopulate)
  schema.plugin(uniqueValidator, isUnique)
  if (v.plugin) {
    if (v.plugin.sequence) {
      schema.plugin(sequence, { inc_field: 'id', id: `${v.name}Counter` })
    }
  }
  models[v.name] = v.discriminator ? models[v.discriminator].discriminator(v.name, schema) : mongoose.model(v.name, schema)
})

module.exports = models
