export const TYPEWRITER_INTERVAL_MS = 18

export function splitDisplayCharacters(value) {
  const text = String(value || '')
  if (!text) return []
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (item) => item.segment)
  }
  return Array.from(text)
}

export function createTypewriterController({ onUpdate, interval = TYPEWRITER_INTERVAL_MS }) {
  let activeId = ''
  let rendered = ''
  let queue = []
  let finalPayload = null
  let timer = null
  let resolveCompletion = null

  const stopTimer = () => {
    if (timer !== null) globalThis.clearTimeout(timer)
    timer = null
  }

  const resolveCurrent = () => {
    resolveCompletion?.()
    resolveCompletion = null
  }

  const finish = () => {
    if (!finalPayload || queue.length) return
    const finalText = String(finalPayload.reply || rendered || '我整理好了。')
    rendered = finalText
    onUpdate(activeId, rendered, false)
    finalPayload = null
    resolveCurrent()
  }

  const tick = () => {
    timer = null
    if (!activeId) return
    const character = queue.shift()
    if (character !== undefined) {
      rendered += character
      onUpdate(activeId, rendered, true)
    }
    if (queue.length) {
      timer = globalThis.setTimeout(tick, interval)
      return
    }
    finish()
  }

  const schedule = () => {
    if (timer !== null || !activeId) return
    if (!queue.length) {
      finish()
      return
    }
    timer = globalThis.setTimeout(tick, rendered ? interval : 0)
  }

  const cancel = (id = activeId, keepRendered = true) => {
    if (!activeId || (id && id !== activeId)) return
    stopTimer()
    queue = []
    finalPayload = null
    if (keepRendered && rendered) onUpdate(activeId, rendered, false)
    resolveCurrent()
    activeId = ''
    rendered = ''
  }

  return {
    begin(id) {
      cancel(activeId, true)
      activeId = id
      rendered = ''
      queue = []
      finalPayload = null
      onUpdate(activeId, '', true)
      return new Promise((resolve) => { resolveCompletion = resolve })
    },
    push(id, text) {
      if (!activeId || id !== activeId || !text) return
      queue.push(...splitDisplayCharacters(text))
      schedule()
    },
    reset(id) {
      if (!activeId || id !== activeId) return
      stopTimer()
      rendered = ''
      queue = []
      finalPayload = null
      onUpdate(activeId, '', true)
    },
    complete(id, payload) {
      if (!activeId || id !== activeId) return
      const finalText = String(payload?.reply || rendered || '我整理好了。')
      const receivedText = rendered + queue.join('')
      if (finalText.startsWith(receivedText)) {
        queue.push(...splitDisplayCharacters(finalText.slice(receivedText.length)))
      } else if (finalText.startsWith(rendered)) {
        queue = splitDisplayCharacters(finalText.slice(rendered.length))
      } else {
        rendered = ''
        queue = splitDisplayCharacters(finalText)
        onUpdate(activeId, '', true)
      }
      finalPayload = payload || { reply: finalText }
      schedule()
    },
    cancel,
    dispose() {
      cancel(activeId, false)
    },
  }
}
