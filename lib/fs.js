const fs = require('fs')
const path = require('path')

const Fs = {
  readDirR(dir) {
    return fs.statSync(dir).isDirectory()
      ? Array.prototype.concat(...fs.readdirSync(dir).map(f => Fs.readDirR(path.join(dir, f))))
      : dir
  },
}

module.exports = Fs
