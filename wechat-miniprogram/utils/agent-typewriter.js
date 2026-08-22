const DEFAULT_INTERVAL = 18

function splitDisplayCharacters(value) {
  return Array.from(String(value || ''))
}

function createTypewriterController(options = {}) {
  const interval = Number(options.interval || DEFAULT_INTERVAL)
  const onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : () => {}
  let activeId = ''
  let rendered = ''
  let queue = []
  let timer = null
  let completion = null

  function emit(streaming = true) {
    if (activeId) onUpdate(activeId, rendered, streaming)
  }

  function settle() {
    if (queue.length || timer || !completion) return
    const resolver = completion
    completion = null
    emit(false)
    resolver()
  }

  function tick() {
    timer = null
    if (!activeId || !queue.length) {
      settle()
      return
    }
    rendered += queue.shift()
    emit(true)
    if (queue.length) timer = setTimeout(tick, interval)
    else settle()
  }

  function ensureTimer() {
    if (!timer && queue.length) timer = setTimeout(tick, interval)
  }

  function begin(id) {
    if (timer) clearTimeout(timer)
    activeId = String(id || '')
    rendered = ''
    queue = []
    completion = null
    timer = null
    emit(true)
  }

  function push(id, text) {
    if (String(id || '') !== activeId) return
    queue.push(...splitDisplayCharacters(text))
    ensureTimer()
  }

  function reset(id, text = '') {
    if (String(id || '') !== activeId) return
    if (timer) clearTimeout(timer)
    timer = null
    rendered = ''
    queue = splitDisplayCharacters(text)
    emit(true)
    ensureTimer()
  }

  function complete(id, finalText) {
    if (String(id || '') !== activeId) return Promise.resolve()
    if (typeof finalText === 'string') {
      const combined = rendered + queue.join('')
      if (combined !== finalText) {
        rendered = ''
        queue = splitDisplayCharacters(finalText)
        emit(true)
      }
    }
    return new Promise((resolve) => {
      completion = resolve
      ensureTimer()
      settle()
    })
  }

  function cancel(id) {
    if (id && String(id) !== activeId) return
    if (timer) clearTimeout(timer)
    timer = null
    queue = []
    completion = null
    activeId = ''
  }

  return { begin, push, reset, complete, cancel, dispose: cancel }
}

module.exports = { createTypewriterController, splitDisplayCharacters }
