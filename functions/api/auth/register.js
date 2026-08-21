import {
  createPasswordRecord,
  createSession,
  jsonResponse,
  logActivity,
  normalizeNickname,
  nowIso,
  optionsResponse,
  publicUser,
  readJson,
  requestOrigin,
  validNickname,
  validPassword,
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
    if (!validNickname(nickname)) return jsonResponse({ error: '昵称需为 2—20 个中英文、数字、下划线或短横线' }, 400, request)
    if (!validPassword(password)) return jsonResponse({ error: '密码需为 6—72 位' }, 400, request)

    const nicknameTaken = nickname.toLocaleLowerCase('zh-CN') === 'yzz'
      || await env.DB.prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE').bind(nickname).first()
    if (nicknameTaken) return jsonResponse({ error: '该昵称已被注册' }, 409, request)

    const passwordRecord = await createPasswordRecord(password)
    const timestamp = nowIso()
    const id = crypto.randomUUID()
    try {
      await env.DB.prepare(`INSERT INTO users
        (id, nickname, password_hash, password_salt, role, status, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)`)
        .bind(id, nickname, passwordRecord.hash, passwordRecord.salt, timestamp, timestamp, timestamp)
        .run()
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) {
        return jsonResponse({ error: '该昵称已被注册' }, 409, request)
      }
      throw error
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
    const session = await createSession(env, id, request)
    await logActivity(env, request, id, 'registered', {})
    return jsonResponse({ user: publicUser(user), token: session.token }, 201, request, {
      'Set-Cookie': session.cookie,
    })
  } catch (error) {
    return jsonResponse({ error: error?.message || '注册失败' }, error?.status || 500, request)
  }
}
