import assert from 'node:assert/strict'
import { createTypewriterController, splitDisplayCharacters } from '../src/agent-typewriter.js'

assert.deepEqual(splitDisplayCharacters('小Y👨‍👩‍👧‍👦'), ['小', 'Y', '👨‍👩‍👧‍👦'])

const updates = []
const controller = createTypewriterController({
  interval: 4,
  onUpdate: (_id, content, streaming) => updates.push({ content, streaming, at: Date.now() }),
})

const completion = controller.begin('stream-1')
controller.push('stream-1', '小Y')
await new Promise((resolve) => setTimeout(resolve, 3))
controller.push('stream-1', '正在规划')
controller.complete('stream-1', { reply: '小Y正在规划。' })
await completion

const visibleUpdates = updates.filter((item) => item.content)
assert.ok(visibleUpdates.length >= 7, '应逐字产生多次可见更新')
assert.equal(visibleUpdates[0].content, '小')
for (let index = 1; index < visibleUpdates.length; index += 1) {
  const previousLength = splitDisplayCharacters(visibleUpdates[index - 1].content).length
  const currentLength = splitDisplayCharacters(visibleUpdates[index].content).length
  assert.ok(currentLength - previousLength <= 1, '每次渲染最多新增一个可见字符')
}
assert.deepEqual(visibleUpdates.at(-1), {
  content: '小Y正在规划。',
  streaming: false,
  at: visibleUpdates.at(-1).at,
})

const resetUpdates = []
const resetController = createTypewriterController({
  interval: 3,
  onUpdate: (_id, content, streaming) => resetUpdates.push({ content, streaming }),
})
const resetCompletion = resetController.begin('stream-2')
resetController.push('stream-2', '临时提示')
await new Promise((resolve) => setTimeout(resolve, 5))
resetController.reset('stream-2')
resetController.push('stream-2', '正式回答')
resetController.complete('stream-2', { reply: '正式回答' })
await resetCompletion
assert.deepEqual(resetUpdates.at(-1), { content: '正式回答', streaming: false })
assert.ok(!resetUpdates.at(-1).content.includes('临时'))

console.log('agent typewriter tests passed')
