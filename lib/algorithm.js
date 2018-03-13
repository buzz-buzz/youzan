const _ = require('lodash')

module.exports = {
  // 时间段是否重叠
  periodsOverlap(_items) {
    const items = _.sortBy(_items, 'start')

    return _.every(items, (v, i) => {
      const { start, end } = v
      if (i === 0) {
        return start < end
      }
      return (start < end) && (start > items[i - 1].end)
    })
  },
}
