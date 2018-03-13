const assert = require('power-assert')
const parallel = require('mocha.parallel')

parallel('demo', () => {
  it('demo post', async () => {
    // const random = Math.random()
    // const { status, body } = await req.post('/demo/post')
    //   .set('Fs-Request-From', 'teacher')
    //   .send({ random })
    // assert(body.data.body.random === random)
  })
  it('demo error', async () => {
    // const random = Math.random()
    // const { status, body } = await req.get('/demo/error')
    //   .set('Fs-Request-From', 'teacher')
    // assert(body.code === 1)
  })
})
