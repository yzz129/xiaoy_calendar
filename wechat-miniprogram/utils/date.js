const lunarCalendar = require('../vendor/lunar.js')

const { HolidayUtil, Solar } = lunarCalendar
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const metaCache = Object.create(null)

function pad(value) { return String(value).padStart(2, '0') }
function toKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function fromKey(key) {
  const parts = String(key).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function calendarMeta(date) {
  const key = toKey(date)
  if (metaCache[key]) return metaCache[key]
  const solar = Solar.fromDate(date)
  const lunar = solar.getLunar()
  const holiday = HolidayUtil.getHoliday(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunarMonth = `${lunar.getMonth() < 0 ? '闰' : ''}${lunar.getMonthInChinese()}月`
  const lunarDay = lunar.getDayInChinese()
  const events = Array.from(new Set([
    ...lunar.getFestivals(), ...solar.getFestivals(), lunar.getJieQi(),
    ...lunar.getOtherFestivals(), ...solar.getOtherFestivals(),
  ].filter(Boolean)))
  const meta = {
    lunarLabel: Math.abs(lunar.getDay()) === 1 ? lunarMonth : lunarDay,
    lunarFullLabel: `农历${lunarMonth}${lunarDay}`,
    eventLabel: events[0] || '',
    events,
    holiday: holiday ? { name: holiday.getName(), type: holiday.isWork() ? 'work' : 'rest', target: holiday.getTarget() } : null,
  }
  metaCache[key] = meta
  return meta
}

function monthCells(year, month) {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month - 1, 1 - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: toKey(date), day: date.getDate(), current: date.getMonth() === month - 1,
      weekend: date.getDay() === 0 || date.getDay() === 6, meta: calendarMeta(date),
    }
  })
}

function dateTitle(key) {
  const date = fromKey(key)
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()]
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekday}`
}

function rangeStats(entries, start, end) {
  let workDays = 0
  let duration = 0
  Object.keys(entries || {}).forEach((key) => {
    const entry = entries[key]
    if (key < start || key > end || entry.status !== 'work') return
    workDays += 1
    duration += Number(entry.duration || 0)
  })
  return { workDays, duration: Number.isInteger(duration) ? duration : Number(duration.toFixed(1)) }
}

module.exports = { WEEK_LABELS, toKey, fromKey, monthCells, dateTitle, calendarMeta, rangeStats }
