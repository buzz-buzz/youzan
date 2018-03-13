const config = require('config')
const mongoose = require('mongoose')
const helpers = require('mongoose/lib/queryhelpers')
const _ = require('lodash')
const { conf, perPageMax } = config.get('mongodb.page')
const keys = _.keys(conf)

const Page = {
  group(obj) {
    return { paginate: _.pick(obj, keys), qs: _.omit(obj, keys) }
  },
  parser(qs) {
    const opts = _.mapValues({
      ...conf,
      ...qs,
    }, (v, k) => (k === 'sort' ? v : _.toInteger(v)))
    opts.perPage = Math.min(opts.perPage, perPageMax)
    return {
      limit: opts.perPage,
      skip: (opts.page - 1) * opts.perPage,
      opts,
    }
  },
  db() {
    if (!mongoose.Aggregate.prototype.replaceRoot) {
      mongoose.Aggregate.prototype.replaceRoot = function (name) {
        return this.append({ $replaceRoot: { newRoot: name.startsWith('$') ? name : `$${name}` } })
      }
    }

    mongoose.Aggregate.prototype.paginate = async function (qs) {
      const { limit, skip, opts } = Page.parser(qs)
      const [count, data = []] = await Promise.all([this._model.aggregate(this._pipeline).group({ _id: null, count: { $sum: 1 } }), this.skip(skip).limit(limit).sort(opts.sort)])
      const total = _.get(count, '0.count', 0)
      return {
        data,
        meta: { ...opts, total, next: (Math.ceil(total / limit) || 1) === opts.page ? undefined : opts.page + 1 },
      }
    }
    mongoose.Query.prototype.paginate = async function (qs) {
      const { limit, skip, opts } = Page.parser(qs)
      const [total, data = []] = await Promise.all([this.model.count(this._conditions), this.skip(skip).limit(limit).sort(opts.sort)])
      return {
        data,
        meta: { ...opts, total, next: (Math.ceil(total / limit) || 1) === opts.page ? undefined : opts.page + 1 },
      }
    }
    // mongoose.Query.prototype.cb = async function (name, ...arg) {
    //   return await this.then(v => this.model[name](v, ...arg))
    // }
    mongoose.Query.prototype._applyPaths = function applyPaths() {
      this._fields = this._fields || {}
      helpers.applyPaths(this._fields, this.model.schema)
    }
  },
}

module.exports = Page
