const API_ORIGIN = 'https://calendar.yzzwnw.asia'
const TOKEN_KEY = 'xiaoy-calendar-session-token:v1'

function networkErrorMessage(message) {
  const detail = String(message || '')
  if (/url not in domain list/i.test(detail)) {
    return '服务器域名尚未在微信后台生效，请将 calendar.yzzwnw.asia 加入 request 合法域名后重试'
  }
  if (/timeout/i.test(detail)) return '连接服务器超时，请检查网络后重试'
  if (/fail/i.test(detail)) return '暂时无法连接服务器，请检查网络或稍后重试'
  return detail || '网络连接失败'
}

function request(path, options = {}) {
  const token = wx.getStorageSync(TOKEN_KEY)
  const method = String(options.method || 'GET').toUpperCase()
  const header = {
    Accept: 'application/json',
    ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
    ...(options.header || {}),
  }
  if (options.auth !== false && token) header.Authorization = `Bearer ${token}`

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_ORIGIN}${path}`,
      method,
      data: options.data,
      header,
      timeout: 20000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data || {})
          return
        }
        const error = new Error(response.data?.error || `请求失败（${response.statusCode}）`)
        error.statusCode = response.statusCode
        reject(error)
      },
      fail(result) {
        reject(new Error(networkErrorMessage(result.errMsg)))
      },
    })
  })
}

function createUtf8Decoder() {
  let carry = []
  return function decode(chunk, flush = false) {
    const bytes = [...carry, ...new Uint8Array(chunk || new ArrayBuffer(0))]
    carry = []
    let output = ''
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index]
      let length = 1
      let code = first
      if ((first & 0xe0) === 0xc0) { length = 2; code = first & 0x1f }
      else if ((first & 0xf0) === 0xe0) { length = 3; code = first & 0x0f }
      else if ((first & 0xf8) === 0xf0) { length = 4; code = first & 0x07 }
      else if (first >= 0x80) { output += '\ufffd'; index += 1; continue }

      if (index + length > bytes.length) {
        if (!flush) carry = bytes.slice(index)
        else output += '\ufffd'
        break
      }
      let valid = true
      for (let offset = 1; offset < length; offset += 1) {
        const next = bytes[index + offset]
        if ((next & 0xc0) !== 0x80) { valid = false; break }
        code = (code << 6) | (next & 0x3f)
      }
      if (!valid) { output += '\ufffd'; index += 1; continue }
      output += String.fromCodePoint(code)
      index += length
    }
    return output
  }
}

function stream(path, options = {}, handlers = {}) {
  const token = wx.getStorageSync(TOKEN_KEY)
  const header = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    ...(options.header || {}),
  }
  if (options.auth !== false && token) header.Authorization = `Bearer ${token}`

  let task = null
  let settled = false
  let receivedChunk = false
  let buffer = ''
  const decode = createUtf8Decoder()

  const promise = new Promise((resolve, reject) => {
    function fail(error) {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error || '流式请求失败')))
    }

    function dispatch(block) {
      const lines = String(block || '').split('\n')
      let eventName = 'message'
      const dataLines = []
      lines.forEach((line) => {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      })
      if (!dataLines.length) return
      let payload
      try { payload = JSON.parse(dataLines.join('\n')) }
      catch (error) { return }

      if (typeof handlers[eventName] === 'function') handlers[eventName](payload)
      if (eventName === 'error') fail(new Error(payload?.error || payload?.message || '小Y 暂时没有回应'))
      if (eventName === 'result' && !settled) {
        settled = true
        resolve(payload || {})
      }
    }

    function consume(text, flush = false) {
      buffer += String(text || '').replace(/\r\n/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        dispatch(block)
        boundary = buffer.indexOf('\n\n')
      }
      if (flush && buffer.trim()) {
        dispatch(buffer)
        buffer = ''
      }
    }

    task = wx.request({
      url: `${API_ORIGIN}${path}`,
      method: String(options.method || 'POST').toUpperCase(),
      data: options.data,
      header,
      enableChunked: true,
      timeout: Number(options.timeout || 120000),
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          fail(new Error(response.data?.error || `请求失败（${response.statusCode}）`))
          return
        }
        if (!receivedChunk && response.data && typeof response.data === 'object') {
          if (typeof handlers.result === 'function') handlers.result(response.data)
          settled = true
          resolve(response.data)
          return
        }
        consume(decode(new ArrayBuffer(0), true), true)
        if (!settled) fail(new Error('流式响应提前结束，请稍后重试'))
      },
      fail(result) { fail(new Error(networkErrorMessage(result.errMsg))) },
    })

    if (typeof task.onChunkReceived === 'function') {
      task.onChunkReceived((response) => {
        receivedChunk = true
        consume(decode(response.data))
      })
    }
  })

  promise.abort = () => { if (task && typeof task.abort === 'function') task.abort() }
  return promise
}

module.exports = { API_ORIGIN, request, stream, networkErrorMessage }
