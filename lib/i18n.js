// const { I18N } = require('../model')
// const logger = require('../lib/logger')
// const cache = require('../lib/cache')
// const { redis } = require('../lib/redis')
// const _ = require('lodash')
// const config = require('config')
// const i18next = require('i18next')
//
// const Obj = {
//   async resetCache() {
//     await redis.multi()
//       .del('i18n:resource')
//       .del('i18n:ns')
//       .exec()
//   },
//   async readFromDb() {
//     return await cache.getOrSet('i18n:resource', async () => {
//       const resources = {}
//       _.each(await I18N.find(), ({ ns, data }) => {
//         _.each(data, ({ key, zh, en }) => {
//           _.set(resources, ['zh', ns, key], zh)
//           _.set(resources, ['en', ns, key], en)
//         })
//       })
//       return resources
//     })
//   },
//   async saveMissing({ lng, ns, key, fallback }) {
//     return await I18N.update({ ns }, { $addToSet: { missing: key } }, { upsert: true })
//   },
//   backend: {
//     type: 'backend',
//     // init(services, backendOptions, i18nextOptions) {
//     // },
//     // async read(lng, ns, cb) {
//     //   const doc = await I18N.findOne({ ns }).catch(e => { if (e) cb(e) })
//     //   const result = {}
//     //   _.each(_.get(doc, 'data', []), i => {
//     //     result[i.key] = i[lng]
//     //   })
//     //   cb(null, result)
//     // },
//     async readMulti(lng, ns, cb) {
//       const resources = await Obj.readFromDb().catch(e => { if (e) cb(e) })
//       _.each(lng, lng => {
//         _.each(ns, ns => {
//           if (!_.has(resources, [lng, ns])) {
//             _.set(resources, [lng, ns], {})
//           }
//         })
//       })
//       cb(null, resources)
//     },
//     async create(lng, ns, key, fallback) {
//       await Obj.saveMissing({ lng, ns, key, fallback })
//     },
//   },
//   async getConfig() {
//     const ns = await cache.getOrSet('i18n:ns', async () => ({ ns: await I18N.distinct('ns') }), { wrap: true })
//     return {
//       fallbackLng: 'en',
//       preload: config.get('i18n'),
//       saveMissing: true,
//       saveMissingTo: 'all',
//       ns: await I18N.distinct('ns'),
//       defaultNS: 'default',
//       fallbackNS: 'default',
//       backend: {
//         allowMultiLoading: true,
//       },
//     }
//   },
//   async init(opt) {
//     const conf = await Obj.getConfig()
//     i18next.use(Obj.backend).init({
//       ...conf,
//       ...opt,
//     }, (e, t) => {
//       if (e) {
//         logger.error('i18n', e)
//       }
//     })
//   },
// }
//
// module.exports = Obj
