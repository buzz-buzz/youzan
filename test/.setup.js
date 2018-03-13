const ready = require('readyness')
const assert = require('power-assert')
const request = require('supertest')
const app = require('../app')
const server = app.listen()
global.req = request(server)

before(done => {
  // this.timeout(5000)
  ready.doWhen(done)
})

after(() => server.close())
