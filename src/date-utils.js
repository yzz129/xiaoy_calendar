import lunarCalendar from 'lunar-javascript'

const { HolidayUtil, Solar } = lunarCalendar

export const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const calendarMetaCache = new Map()

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
      meta: getCalendarMeta(date),
    }
  })
}

export function isSameMonth(key, viewDate) {
  const date = fromKey(key)
  return date.getFullYear() === viewDate.getFullYear() && date.getMonth() === viewDate.getMonth()
}

export function getRangeStats(entries, start, end) {
  let workDays = 0
  let duration = 0

  Object.entries(entries).forEach(([key, entry]) => {
    if (key < start || key > end || entry.status !== 'work') return
    workDays += 1
    duration += entry.duration || 0
  })

  return { workDays, duration }
}

export function getDateKeysInRange(startKey, endKey, weekdays = [0, 1, 2, 3, 4, 5, 6], maxDays = 366) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey || '') || toKey(fromKey(startKey)) !== startKey) throw new Error('开始日期格式不正确')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endKey || '') || toKey(fromKey(endKey)) !== endKey) throw new Error('结束日期格式不正确')
  const start = fromKey(startKey)
  const end = fromKey(endKey)
  const spanDays = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1
  if (spanDays < 1) throw new Error('结束日期不能早于开始日期')
  if (spanDays > maxDays) throw new Error(`单次最多批量设置 ${maxDays} 天`)
  const normalizedWeekdays = Array.isArray(weekdays)
    ? [...new Set(weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [0, 1, 2, 3, 4, 5, 6]
  const allowed = new Set(normalizedWeekdays.length ? normalizedWeekdays : [0, 1, 2, 3, 4, 5, 6])
  const keys = []
  for (let index = 0; index < spanDays; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    if (allowed.has(date.getDay())) keys.push(toKey(date))
  }
  return keys
}

export function getCalendarMeta(date) {
  const key = toKey(date)
  if (calendarMetaCache.has(key)) return calendarMetaCache.get(key)

  const solar = Solar.fromDate(date)
  const lunar = solar.getLunar()
  const holiday = HolidayUtil.getHoliday(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunarMonth = `${lunar.getMonth() < 0 ? '闰' : ''}${lunar.getMonthInChinese()}月`
  const lunarDay = lunar.getDayInChinese()
  const lunarLabel = Math.abs(lunar.getDay()) === 1 ? lunarMonth : lunarDay
  const events = Array.from(new Set([
    ...lunar.getFestivals(),
    ...solar.getFestivals(),
    lunar.getJieQi(),
    ...lunar.getOtherFestivals(),
    ...solar.getOtherFestivals(),
  ].filter(Boolean)))

  const meta = {
    lunarLabel,
    lunarFullLabel: `农历${lunarMonth}${lunarDay}`,
    eventLabel: events[0] || '',
    events,
    holiday: holiday ? {
      name: holiday.getName(),
      type: holiday.isWork() ? 'work' : 'rest',
      target: holiday.getTarget(),
    } : null,
  }

  calendarMetaCache.set(key, meta)
  return meta
}
