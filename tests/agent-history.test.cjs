const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')

const moduleShim = { exports: {} }
runInNewContext(
  readFileSync(new URL('../wechat-miniprogram/utils/agent-history.js', `file:///${__filename.replace(/\\/g, '/')}`), 'utf8'),
  { module: moduleShim, exports: moduleShim.exports, Date },
)
const { HISTORY_LIMIT, historyKey, normalizeMessages, mergeHistories } = moduleShim.exports

assert.equal(HISTORY_LIMIT, 30)
assert.equal(historyKey({ id: 'user-1' }), 'xy-calendar-agent-history-v1:user-1')

const local = normalizeMessages([
  { id: 'local-user', role: 'user', content: '帮我规划学习', createdAt: '2026-08-22T10:00:00.000Z' },
  { id: 'local-assistant', role: 'assistant', content: '先告诉我目标。', createdAt: '2026-08-22T10:01:00.000Z', streaming: true },
])
assert.equal(local[1].streaming, false)

const merged = mergeHistories([
  { id: 'remote-user', role: 'user', content: '帮我规划学习', createdAt: '2026-08-22T10:00:00.000Z' },
  { id: 'remote-assistant', role: 'assistant', content: '先告诉我目标。', createdAt: '2026-08-22T10:01:00.000Z' },
], [
  ...local,
  { id: 'local-new', role: 'user', content: '目标是考研', createdAt: '2026-08-22T10:02:00.000Z' },
])

assert.deepEqual(Array.from(merged, (message) => message.content), ['帮我规划学习', '先告诉我目标。', '目标是考研'])
console.log('agent history persistence tests passed')
