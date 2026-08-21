import { Capacitor } from '@capacitor/core'

const TOKEN_KEY = 'xiaoy-calendar-session-token:v1'
const API_ORIGIN = 'https://calendar.yzzwnw.asia'

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return Capacitor.isNativePlatform() ? `${API_ORIGIN}${path}` : path
}

export function getStoredToken() {
  return Capacitor.isNativePlatform() ? window.localStorage.getItem(TOKEN_KEY) || '' : ''
}

export function storeSessionToken(token) {
  if (!Capacitor.isNativePlatform()) return
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = getStoredToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const requestOptions = { ...options, headers, credentials: 'include' }
  const method = String(options.method || 'GET').toUpperCase()
  if (method === 'GET') requestOptions.cache = 'no-store'
  return fetch(apiUrl(path), requestOptions)
}

export async function login(nickname, password, { admin = false } = {}) {
  const response = await authFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, password, ...(admin ? { scope: 'admin' } : {}) }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '登录失败')
  if (!admin) storeSessionToken(payload.token)
  return payload
}

export async function register(nickname, password) {
  const response = await authFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, password }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '注册失败')
  storeSessionToken(payload.token)
  return payload
}

export async function logout({ admin = false } = {}) {
  try {
    await authFetch(`/api/auth/logout${admin ? '?scope=admin' : ''}`, { method: 'POST' })
  } finally {
    if (!admin) storeSessionToken('')
  }
}
