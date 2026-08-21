import {
  authenticate,
  createPasswordRecord,
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
  verifyPassword,
} from '../../../server/auth.js'

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'GET, PATCH, OPTIONS')
}

export async function onRequestGet({ request, env }) {
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '登录已失效，请重新登录' }, 401, request)
  return jsonResponse({ user: publicUser(user) }, 200, request)
}

export async function onRequestPatch({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)

  const sessionUser = await authenticate(env, request)
  if (!sessionUser) return jsonResponse({ error: '登录已失效，请重新登录' }, 401, request)

  try {
    const payload = await readJson(request, 12 * 1024)
    const nickname = normalizeNickname(payload.nickname)
    const currentPassword = typeof payload.currentPassword === 'string' ? payload.currentPassword : ''
    const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword : ''

    if (!validNickname(nickname)) {
      return jsonResponse({ error: '昵称需为 2—20 个中英文、数字、下划线或短横线' }, 400, request)
    }
    if (newPassword && !validPassword(newPassword)) {
      return jsonResponse({ error: '新密码需为 6—72 位' }, 400, request)
    }

    const currentUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(sessionUser.id).first()
    if (!currentUser || currentUser.status !== 'active') {
      return jsonResponse({ error: '账号不可用，请重新登录' }, 401, request)
    }

    if (newPassword && !(await verifyPassword(currentPassword, currentUser.password_salt, currentUser.password_hash))) {
      return jsonResponse({ error: '当前密码不正确' }, 400, request)
    }

    const nicknameOwner = await env.DB.prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE')
      .bind(nickname).first()
    if (nicknameOwner && nicknameOwner.id !== currentUser.id) {
      return jsonResponse({ error: '该昵称已被注册' }, 409, request)
    }

    const timestamp = nowIso()
    const statements = []
    if (newPassword) {
      const passwordRecord = await createPasswordRecord(newPassword)
      statements.push(env.DB.prepare(`UPDATE users
        SET nickname = ?, password_hash = ?, password_salt = ?, updated_at = ?
        WHERE id = ?`)
        .bind(nickname, passwordRecord.hash, passwordRecord.salt, timestamp, currentUser.id))
      statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?')
        .bind(currentUser.id, sessionUser.session_id))
    } else {
      statements.push(env.DB.prepare('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?')
        .bind(nickname, timestamp, currentUser.id))
    }

    try {
      await env.DB.batch(statements)
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) {
        return jsonResponse({ error: '该昵称已被注册' }, 409, request)
      }
      throw error
    }

    const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(currentUser.id).first()
    await logActivity(env, request, currentUser.id, 'profile_updated', {
      nicknameChanged: nickname !== currentUser.nickname,
      passwordChanged: Boolean(newPassword),
    })
    return jsonResponse({ user: publicUser(updatedUser) }, 200, request)
  } catch (error) {
    return jsonResponse({ error: error?.message || '保存个人资料失败' }, error?.status || 500, request)
  }
}
