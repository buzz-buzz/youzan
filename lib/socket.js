const socket = require('socket.io')
const _ = require('lodash')

const { Teacher, Student } = require('../model')

module.exports = server => {
  const io = socket(server, {
    wsEngine: 'uws',
    cookie: false,
  })
  const nsp = io.of('/student')
  nsp.use(async (socket, next) => {
    if (socket.user) return next()
    let error
    const { authorization: token, 'fs-user-id': id } = socket.handshake.headers
    socket.user = await Student.findOneByTokenOrId(token, id).then(Student.isValid)
      .catch(e => {
        e.code = 2
        next(e)
      })
    next()
  }).on('connection', socket => {
    console.log('connect', socket.user)
    socket.on('disconnect', reason => {
      console.log('disconnect', socket.user, reason)
    })
  })
}
