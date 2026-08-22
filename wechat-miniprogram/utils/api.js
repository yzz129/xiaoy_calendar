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

module.exports = { API_ORIGIN, request, networkErrorMessage }
