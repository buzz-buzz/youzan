const _ = require('lodash')
const config = require('config')
const qiniu = require('qiniu')
const conf = config.get('qiniu')
const axios = require('axios')
const logger = require('./logger')
const { queue } = require('./queue')
const { Homework } = require('../model')

const mac = new qiniu.auth.digest.Mac(conf.accessKey, conf.secretKey)

module.exports = {
  async pfopAll(items) {
    if (_.isEmpty(items) || !_.isArray(items)) return
    const data = []
    _.each(items, i => {
      if (!_.isEmpty(i) && !i.includes(`://${conf.type.video.prefix.replace('https://', '').replace('http://', '')}/compressed_`)) {
        data.push(i.replace(`${conf.type.video.prefix}/`, '').replace(`${conf.type.video.prefix.replace('https://', 'http://')}/`, ''))
      }
    })
    return await Promise.all(data.map(async i => {
      const id = await this.pfop(i).catch(e => {
        logger.error('qiniu:pfop', e)
      })
      if (id) {
        this.addJob(id)
        return id
      }
    }))
  },
  async pfop(srcKey) {
    const c = new qiniu.conf.Config()
    c.useHttpsDomain = true
    c.zone = qiniu.zone[conf.zone[conf.type.video.zone]]
    const operManager = new qiniu.fop.OperationManager(mac, c)
    const saveBucket = conf.type.video.putPolicy.scope
    const fops = [conf.type.video.persistent.fops.video + qiniu.util.urlsafeBase64Encode(`${saveBucket}:compressed_${srcKey.replace(/\./g, '_')}.mp4`)]
    const pipeline = conf.type.video.persistent.pipeline
    const srcBucket = conf.type.video.putPolicy.scope
    const options = {
      notifyURL: conf.type.video.persistent.notifyUrl,
      force: false,
    }
    return new Promise((resolve, reject) => {
      console.log(srcKey)
      operManager.pfop(srcBucket, srcKey, fops, pipeline, options, (err, respBody, respInfo) => {
        if (err) {
          reject(err)
        }
        if (respInfo.statusCode === 200) {
          resolve(respBody.persistentId)
        } else {
          logger.log({
            status: respInfo.statusCode,
            body: respInfo.respBody,
          })
          reject(respInfo.respBody)
        }
      })
    })
  },
  process() {
    queue.process('qiniuNotify', async job => {
      const data = await this.prefop(job.data.id)
      await this.persistent(data)
    })
  },
  addJob(id) {
    queue.add('qiniuNotify', { id }, config.get('queue.job.qiniu'))
  },
  async prefop(id) {
    const { data } = await axios({ url: `https://api.qiniu.com/status/get/prefop?id=${id}`, method: 'get' })
    return data
  },
  async persistent(data) {
    const code = _.get(data, 'code')
    if (!data.id) return
    if ([0, 4].includes(code)) {
      const raw = `${conf.type.default.prefix}/${data.inputKey}`
      const after = `${conf.type.default.prefix}/${data.items[0].key}`
      const homework = await Homework.findOne({ video: raw })
      if (!homework) return
      const index = homework.video.indexOf(raw)
      homework.video.set(index, after)
      await homework.save()
    } else if (code === 1) {
      throw new Error('qiniu persistent waiting')
    } else if (code === 2) {
      throw new Error('qiniu persistent processing')
    } else if (code === 3) {
      throw new Error(`qiniu persistent error: ${data.error}`)
    }
  },
  createToken(type = 'default') {
    const putPolicy = new qiniu.rs.PutPolicy(conf.type[type].putPolicy)
    return {
      token: putPolicy.uploadToken(mac),
      prefix: conf.type[type].prefix,
      ...conf.type[type].putPolicy,
    }
  },
  async urlStream(url) {
    const { data } = await axios({
      method: 'get',
      url,
      responseType: 'stream',
    })
    return data
  },
  async uploadUrl(url) {
    return await this.uploadStream(await this.urlStream(url))
  },
  uploadStream(stream) {
    const { token } = this.createToken('default')
    const con = new qiniu.conf.Config()
    // 空间对应的机房
    con.zone = qiniu.zone[conf.zone[conf.type.default.zone]]
    // 是否使用https域名
    con.useHttpsDomain = true
    // 上传是否使用cdn加速
    con.useCdnDomain = true
    const formUploader = new qiniu.form_up.FormUploader(con)
    const putExtra = new qiniu.form_up.PutExtra()
    return new Promise((resolve, reject) => {
      formUploader.putStream(token, undefined, stream, putExtra, (
        respErr,
        respBody, respInfo
      ) => {
        if (respErr) {
          logger.error('qiniu:putStream', respErr)
          return reject(new Error('qiniu error'))
        }
        if (respInfo.statusCode === 200) {
          return resolve(respBody)
        }
        logger.error('qiniu:putStream', {
          status: respInfo.statusCode,
          body: respBody,
        })
        return reject(new Error('qiniu error'))
      })
    })
  },
}
