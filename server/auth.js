const SESSION_COOKIE = 'xy_session'
const ADMIN_SESSION_COOKIE = 'xy_admin_session'
const SESSION_SECONDS = 30 * 24 * 60 * 60
const MAX_JSON_BYTES = 640 * 1024
const NATIVE_APP_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
])

export function nowIso() {
  return new Date().toISOString()
}

export function compactText(value, max = 300) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function normalizeNickname(value) {
  return String(value || '').normalize('NFKC').trim().slice(0, 20)
}

export function validNickname(value) {
  return /^[\p{L}\p{N}_-]{2,20}$/u.test(value)
}

export function validPassword(value) {
  return typeof value === 'string' && value.length >= 6 && value.length <= 72
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function randomToken(byteLength = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

async function derivePassword(password, salt) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const result = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    // Cloudflare Workers Web Crypto 当前单次 PBKDF2 上限为 100,000。
    iterations: 100000,
  }, key, 256)
  return new Uint8Array(result)
}

function constantTimeEqual(left, right) {
  const length = Math.max(left.length, right.length)
  let different = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    different |= (left[index] || 0) ^ (right[index] || 0)
  }
  return different === 0
}

export async function createPasswordRecord(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePassword(password, salt)
  return { salt: bytesToBase64Url(salt), hash: bytesToBase64Url(hash) }
}

export async function verifyPassword(password, saltValue, hashValue) {
  try {
    const actual = await derivePassword(password, base64UrlToBytes(saltValue))
    return constantTimeEqual(actual, base64UrlToBytes(hashValue))
  } catch {
    return false
  }
}

export function requestOrigin(request) {
  const origin = request.headers.get('Origin')
  if (!origin) return ''
  try {
    const normalized = new URL(origin).origin
    if (normalized === new URL(request.url).origin || NATIVE_APP_ORIGINS.has(normalized)) return normalized
  } catch {
    // The caller will reject an invalid Origin.
  }
  return null
}

export function corsHeaders(request) {
  const origin = requestOrigin(request)
  return origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  } : {}
}

export function jsonResponse(payload, status = 200, request, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
      ...(request ? corsHeaders(request) : {}),
      ...extraHeaders,
    },
  })
}

export function optionsResponse(request, methods = 'GET, POST, PATCH, DELETE, OPTIONS') {
  const origin = requestOrigin(request)
  if (origin === null) return new Response(null, { status: 403 })
  return new Response(null, {
    status: 204,
    headers: {
      ...(origin ? corsHeaders(request) : {}),
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function readJson(request, maxBytes = MAX_JSON_BYTES) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('仅接受 JSON 请求'), { status: 415 })
  }
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > maxBytes) throw Object.assign(new Error('请求内容过大'), { status: 413 })
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw Object.assign(new Error('请求内容过大'), { status: 413 })
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw Object.assign(new Error('JSON 格式不正确'), { status: 400 })
  }
}

export function publicUser(user) {
  return user ? {
    id: user.id,
    nickname: user.nickname,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  } : null
}

function cookieValue(request, name) {
  const cookie = request.headers.get('Cookie') || ''
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return ''
}

function sessionCookieName(adminScope = false) {
  return adminScope ? ADMIN_SESSION_COOKIE : SESSION_COOKIE
}

function requestToken(request, adminScope = false) {
  const authorization = request.headers.get('Authorization') || ''
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim()
  return cookieValue(request, sessionCookieName(adminScope))
}

export async function authenticate(env, request, requireAdmin = false) {
  if (!env.DB) return null
  const token = requestToken(request, requireAdmin)
  if (!token || token.length > 200) return null
  const sessionId = await sha256(token)
  const user = await env.DB.prepare(`
    SELECT u.id, u.nickname, u.role, u.status, u.created_at, u.last_login_at,
           s.id AS session_id, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).bind(sessionId).first()
  if (!user || user.status !== 'active' || user.expires_at <= nowIso()) {
    if (user?.session_id) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
    return null
  }
  if (requireAdmin && user.role !== 'admin') return null
  await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(nowIso(), sessionId).run()
  return user
}

export async function createSession(env, userId, request, { adminScope = false } = {}) {
  const token = randomToken()
  const id = await sha256(token)
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString()
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions
      (id, user_id, created_at, expires_at, last_seen_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, userId, createdAt, expiresAt, createdAt, compactText(request.headers.get('User-Agent'), 300), requestIp(request)),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(createdAt),
  ])
  return {
    token,
    cookie: `${sessionCookieName(adminScope)}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`,
  }
}

export function clearSessionCookie(adminScope = false) {
  return `${sessionCookieName(adminScope)}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export async function revokeCurrentSession(env, request, adminScope = false) {
  const token = requestToken(request, adminScope)
  if (!token) return
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run()
}

export function requestIp(request) {
  return compactText(request.headers.get('CF-Connecting-IP') || '', 64)
}

export async function logActivity(env, request, userId, action, detail = {}) {
  if (!env.DB) return
  await env.DB.prepare(`INSERT INTO activity_logs
    (id, user_id, action, detail_json, created_at, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      userId || null,
      compactText(action, 80),
      JSON.stringify(detail).slice(0, 4000),
      nowIso(),
      requestIp(request),
      compactText(request.headers.get('User-Agent'), 300),
    ).run()
}

export async function loginAttemptKey(request, nickname) {
  return sha256(`${requestIp(request) || 'unknown'}:${nickname.toLocaleLowerCase('zh-CN')}`)
}

export async function isLoginRateLimited(env, attemptKey) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM login_attempts WHERE attempt_key = ? AND created_at >= ?')
    .bind(attemptKey, since).first()
  return Number(row?.total || 0) >= 8
}

export async function recordLoginFailure(env, attemptKey) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_attempts (id, attempt_key, created_at) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), attemptKey, nowIso()),
    env.DB.prepare('DELETE FROM login_attempts WHERE created_at < ?').bind(since),
  ])
}

export async function clearLoginFailures(env, attemptKey) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempt_key = ?').bind(attemptKey).run()
}

export function timingSafeStringEqual(left, right) {
  return constantTimeEqual(new TextEncoder().encode(String(left || '')), new TextEncoder().encode(String(right || '')))
}
