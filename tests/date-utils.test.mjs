import assert from 'node:assert/strict'
import { getDateKeysInRange } from '../src/date-utils.js'

const july = getDateKeysInRange('2026-07-01', '2026-07-31')
assert.equal(july.length, 31)
assert.equal(july[0], '2026-07-01')
assert.equal(july.at(-1), '2026-07-31')

const julyWeekdays = getDateKeysInRange('2026-07-01', '2026-07-31', [1, 2, 3, 4, 5])
assert.equal(julyWeekdays.length, 23)
assert.ok(julyWeekdays.every((key) => {
  const day = new Date(`${key}T00:00:00`).getDay()
  return day >= 1 && day <= 5
}))

assert.equal(getDateKeysInRange('2028-02-01', '2028-02-29').length, 29)
assert.deepEqual(getDateKeysInRange('2026-07-30', '2026-08-02'), [
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
])
assert.throws(() => getDateKeysInRange('2026-08-02', '2026-07-30'), /结束日期不能早于开始日期/)
assert.throws(() => getDateKeysInRange('2026-02-30', '2026-03-01'), /开始日期格式不正确/)

console.log('date utils tests passed')
