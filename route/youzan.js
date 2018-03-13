const youzan = require('../controller/youzan')

module.exports = router => router.prefix('/youzan')
  .post('youzan:notify', '/notify', async ctx => {
    ctx.body = await youzan.notify(ctx.request.body)
  })
