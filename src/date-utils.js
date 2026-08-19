export const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function toKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function monthLabel(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function dateLabel(date, todayKey) {
  const prefix = toKey(date) === todayKey ? '今天 · ' : ''
  return `${prefix}${date.getMonth() + 1}月${date.getDate()}日`
}

export function getMonthCells(viewDate) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      date,
      key: toKey(date),
      isCurrentMonth: date.getMonth() === month,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    }
  })
}

export function isSameMonth(key, viewDate) {
  const date = fromKey(key)
  return date.getFullYear() === viewDate.getFullYear() && date.getMonth() === viewDate.getMonth()
}
