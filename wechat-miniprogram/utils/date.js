const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function pad(value) {
  return String(value).padStart(2, '0')
}

function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromKey(key) {
  const parts = String(key).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function monthCells(year, month) {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month - 1, 1 - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: toKey(date),
      day: date.getDate(),
      current: date.getMonth() === month - 1,
      weekend: date.getDay() === 0 || date.getDay() === 6,
    }
  })
}

function dateTitle(key) {
  const date = fromKey(key)
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()]
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekday}`
}

module.exports = { WEEK_LABELS, toKey, fromKey, monthCells, dateTitle }
