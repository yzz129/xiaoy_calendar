import {
  clearLoginFailures,
  createSession,
  isLoginRateLimited,
  jsonResponse,
  logActivity,
  loginAttemptKey,
  normalizeNickname,
  nowIso,
  optionsResponse,
  publicUser,
  readJson,
  recordLoginFailure,
  requestOrigin,
  validNickname,
  validPassword,
  verifyPassword,
} from '../../../server/auth.js'

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'POST, OPTIONS')
}

export async function onRequestPost({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  if (!env.DB) return jsonResponse({ error: '账号数据库尚未配置' }, 503, request)

  try {
    const payload = await readJson(request, 8 * 1024)
    const nickname = normalizeNickname(payload.nickname)
    const password = typeof payload.password === 'string' ? payload.password : ''
    const adminScope = payload.scope === 'admin'
    if (!validNickname(nickname)) return jsonResponse({ error: '昵称需为 2—20 个中英文、数字、下划线或短横线' }, 400, request)
    if (!validPassword(password)) return jsonResponse({ error: '密码需为 6—72 位' }, 400, request)

    const attemptKey = await loginAttemptKey(request, nickname)
    if (await isLoginRateLimited(env, attemptKey)) {
      return jsonResponse({ error: '尝试次数过多，请 15 分钟后再试' }, 429, request)
    }

    let user = await env.DB.prepare('SELECT * FROM users WHERE nickname = ? COLLATE NOCASE').bind(nickname).first()

    if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
      await recordLoginFailure(env, attemptKey)
      await logActivity(env, request, user?.id || null, 'login_failed', { nickname })
      return jsonResponse({ error: '昵称或密码不正确' }, 401, request)
    }
    if (user.status !== 'active') return jsonResponse({ error: '账号已被停用，请联系管理员' }, 403, request)
    if (adminScope && user.role !== 'admin') {
      await logActivity(env, request, user.id, 'admin_login_rejected', {})
      return jsonResponse({ error: '该账号没有管理员权限' }, 403, request)
    }

    const timestamp = nowIso()
    await env.DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(timestamp, timestamp, user.id).run()
    user = { ...user, last_login_at: timestamp }
    await clearLoginFailures(env, attemptKey)
    const session = await createSession(env, user.id, request, { adminScope })
    await logActivity(env, request, user.id, adminScope ? 'admin_login' : 'login', {})

    return jsonResponse({ user: publicUser(user), token: session.token }, 200, request, {
      'Set-Cookie': session.cookie,
    })
  } catch (error) {
    return jsonResponse({ error: error?.message || '登录失败' }, error?.status || 500, request)
  }
}
