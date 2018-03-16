const youzan = require('../controller/youzan')
const logger = require('../lib/logger')

module.exports = router => router.prefix('/youzan')
  .post('youzan:notify', '/notify', async ctx => {
    ctx.body = await youzan.notify(ctx.request.body)
  })
  .post('youzan:allot', '/allot', async ctx => {
    ctx.body = await youzan.allot(ctx.request.body)
  })
