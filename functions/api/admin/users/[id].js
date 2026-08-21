import {
  authenticate,
  createPasswordRecord,
  jsonResponse,
  logActivity,
  normalizeNickname,
  nowIso,
  optionsResponse,
  readJson,
  requestOrigin,
  validNickname,
  validPassword,
} from '../../../../server/auth.js'

export function onRequestOptions({ request }) {
  return optionsResponse(request)
}

async function requireAdmin(request, env) {
  if (requestOrigin(request) === null) return { response: jsonResponse({ error: '不允许跨站调用' }, 403, request) }
  const admin = await authenticate(env, request, true)
  return admin ? { admin } : { response: jsonResponse({ error: '需要管理员权限' }, 403, request) }
}

export async function onRequestGet({ request, env, params }) {
  const auth = await requireAdmin(request, env)
  if (auth.response) return auth.response
  const id = String(params.id || '')
  const [user, snapshot, chats, calls, activities, usage, providers, actionBreakdown, sessions] = await Promise.all([
    env.DB.prepare(`SELECT id, nickname, role, status, created_at, updated_at, last_login_at
      FROM users WHERE id = ?`).bind(id).first(),
    env.DB.prepare('SELECT data_json, updated_at FROM user_snapshots WHERE user_id = ?').bind(id).first(),
    env.DB.prepare(`SELECT id, role, content, provider, model, meta_json, created_at
      FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`).bind(id).all(),
    env.DB.prepare(`SELECT id, provider, model, request_preview, response_preview, status, latency_ms, error, created_at
      FROM model_calls WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`).bind(id).all(),
    env.DB.prepare(`SELECT id, action, detail_json, created_at, ip, user_agent, location
      FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 300`).bind(id).all(),
    env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM sessions WHERE user_id = ?) AS session_count,
      (SELECT COUNT(*) FROM sessions WHERE user_id = ? AND expires_at > ?) AS active_session_count,
      (SELECT MAX(last_seen_at) FROM sessions WHERE user_id = ?) AS last_seen_at,
      (SELECT COUNT(*) FROM chat_messages WHERE user_id = ?) AS chat_count,
      (SELECT COUNT(*) FROM model_calls WHERE user_id = ?) AS call_count,
      (SELECT COUNT(*) FROM model_calls WHERE user_id = ? AND status = 'success') AS successful_calls,
      (SELECT COUNT(*) FROM model_calls WHERE user_id = ? AND status != 'success') AS failed_calls,
      (SELECT CAST(AVG(latency_ms) AS INTEGER) FROM model_calls WHERE user_id = ?) AS average_latency_ms,
      (SELECT COUNT(*) FROM activity_logs WHERE user_id = ?) AS activity_count,
      (SELECT COUNT(*) FROM activity_logs WHERE user_id = ? AND action = 'login') AS login_count,
      (SELECT COUNT(*) FROM activity_logs WHERE user_id = ? AND action = 'data_sync') AS sync_count,
      (SELECT COUNT(*) FROM activity_logs WHERE user_id = ? AND action = 'agent_search') AS search_count,
      (SELECT COUNT(*) FROM activity_logs WHERE user_id = ? AND action = 'agent_completed') AS agent_completed_count,
      (SELECT MAX(created_at) FROM activity_logs WHERE user_id = ?) AS last_activity_at
    `).bind(id, id, nowIso(), id, id, id, id, id, id, id, id, id, id, id, id).first(),
    env.DB.prepare(`SELECT provider, model, status, COUNT(*) AS count,
      CAST(AVG(latency_ms) AS INTEGER) AS average_latency_ms,
      MAX(created_at) AS last_used_at
      FROM model_calls WHERE user_id = ?
      GROUP BY provider, model, status
      ORDER BY count DESC, last_used_at DESC`).bind(id).all(),
    env.DB.prepare(`SELECT action, COUNT(*) AS count, MAX(created_at) AS last_used_at
      FROM activity_logs WHERE user_id = ?
      GROUP BY action ORDER BY count DESC, last_used_at DESC`).bind(id).all(),
    env.DB.prepare(`SELECT created_at, expires_at, last_seen_at, user_agent, ip, location
      FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 50`).bind(id).all(),
  ])
  if (!user) return jsonResponse({ error: '用户不存在' }, 404, request)
  let snapshotData = null
  try { snapshotData = snapshot?.data_json ? JSON.parse(snapshot.data_json) : null } catch { snapshotData = null }
  return jsonResponse({
    user,
    snapshot: snapshotData,
    snapshotUpdatedAt: snapshot?.updated_at || null,
    chats: chats.results || [],
    modelCalls: calls.results || [],
    activities: activities.results || [],
    usage: {
      ...(usage || {}),
      providers: providers.results || [],
      actionBreakdown: actionBreakdown.results || [],
      sessions: sessions.results || [],
    },
  }, 200, request)
}

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireAdmin(request, env)
  if (auth.response) return auth.response
  const id = String(params.id || '')
  try {
    const target = await env.DB.prepare('SELECT id, nickname, role, status FROM users WHERE id = ?').bind(id).first()
    if (!target) return jsonResponse({ error: '用户不存在' }, 404, request)
    const payload = await readJson(request, 12 * 1024)
    const nickname = payload.nickname == null ? target.nickname : normalizeNickname(payload.nickname)
    const status = payload.status === 'disabled' ? 'disabled' : 'active'
    const role = payload.role === 'admin' ? 'admin' : 'user'
    if (!validNickname(nickname)) return jsonResponse({ error: '昵称格式不正确' }, 400, request)
    if (id === auth.admin.id && (status !== 'active' || role !== 'admin')) {
      return jsonResponse({ error: '不能停用或降级当前管理员账号' }, 400, request)
    }

    const statements = [env.DB.prepare(`UPDATE users SET nickname = ?, status = ?, role = ?, updated_at = ? WHERE id = ?`)
      .bind(nickname, status, role, nowIso(), id)]
    if (payload.password) {
      if (!validPassword(payload.password)) return jsonResponse({ error: '密码需为 6—72 位' }, 400, request)
      const passwordRecord = await createPasswordRecord(payload.password)
      statements.push(env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
        .bind(passwordRecord.hash, passwordRecord.salt, nowIso(), id))
      statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND user_id != ?').bind(id, auth.admin.id))
    }
    await env.DB.batch(statements)
    await logActivity(env, request, auth.admin.id, 'admin_user_updated', { targetUserId: id, nickname, status, role, passwordReset: Boolean(payload.password) })
    return jsonResponse({ ok: true }, 200, request)
  } catch (error) {
    const duplicate = String(error?.message || '').includes('UNIQUE')
    return jsonResponse({ error: duplicate ? '该昵称已存在' : error?.message || '修改失败' }, duplicate ? 409 : error?.status || 500, request)
  }
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireAdmin(request, env)
  if (auth.response) return auth.response
  const id = String(params.id || '')
  if (id === auth.admin.id) return jsonResponse({ error: '不能删除当前管理员账号' }, 400, request)
  const target = await env.DB.prepare('SELECT nickname FROM users WHERE id = ?').bind(id).first()
  if (!target) return jsonResponse({ error: '用户不存在' }, 404, request)
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  await logActivity(env, request, auth.admin.id, 'admin_user_deleted', { targetUserId: id, nickname: target.nickname })
  return jsonResponse({ ok: true }, 200, request)
}
