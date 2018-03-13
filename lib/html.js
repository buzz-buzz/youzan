const config = require('config')
const sanitizeHTML = require('sanitize-html')

module.exports = {
  sanitize(str) {
    return str ? sanitizeHTML(str, config.get('html.sanitize')) : undefined
  },
}
