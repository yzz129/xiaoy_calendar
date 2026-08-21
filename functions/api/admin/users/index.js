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

export async function onRequestGet({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const admin = await authenticate(env, request, true)
  if (!admin) return jsonResponse({ error: '需要管理员权限' }, 403, request)
  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.trim().slice(0, 40) || ''
  const sort = ['recent', 'nickname', 'registered', 'calls', 'activity', 'plans'].includes(url.searchParams.get('sort'))
    ? url.searchParams.get('sort')
    : 'recent'
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  const [result, summary] = await Promise.all([
    env.DB.prepare(`
    SELECT u.id, u.nickname, u.role, u.status, u.created_at, u.updated_at, u.last_login_at,
      (SELECT COUNT(*) FROM chat_messages c WHERE c.user_id = u.id) AS chat_count,
      (SELECT COUNT(*) FROM model_calls m WHERE m.user_id = u.id) AS model_call_count,
      (SELECT COUNT(*) FROM model_calls m WHERE m.user_id = u.id AND m.status = 'success') AS successful_call_count,
      (SELECT COUNT(*) FROM activity_logs a WHERE a.user_id = u.id) AS activity_count,
      (SELECT COUNT(*) FROM sessions se WHERE se.user_id = u.id) AS session_count,
      (SELECT MAX(a.created_at) FROM activity_logs a WHERE a.user_id = u.id) AS last_activity_at,
      (SELECT MAX(m.created_at) FROM model_calls m WHERE m.user_id = u.id) AS last_call_at,
      (SELECT MAX(c.created_at) FROM chat_messages c WHERE c.user_id = u.id) AS last_chat_at,
      (SELECT MAX(se.last_seen_at) FROM sessions se WHERE se.user_id = u.id) AS last_seen_at,
      s.updated_at AS snapshot_updated_at,
      s.data_json AS snapshot_json
    FROM users u
    LEFT JOIN user_snapshots s ON s.user_id = u.id
    WHERE (? = '' OR u.nickname LIKE ? ESCAPE '\\')
  `).bind(search, pattern).all(),
    env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE status = 'active') AS active,
      (SELECT COUNT(*) FROM chat_messages) AS chats,
      (SELECT COUNT(*) FROM model_calls) AS calls,
      (SELECT COUNT(*) FROM activity_logs) AS activities`).first(),
  ])

  const timeValue = (value) => value ? Date.parse(value) || 0 : 0
  const numberValue = (value) => Number(value || 0)
  const users = (result.results || []).map((user) => {
    let snapshot = null
    try { snapshot = user.snapshot_json ? JSON.parse(user.snapshot_json) : null } catch { snapshot = null }
    const lastActiveAt = [user.last_login_at, user.last_activity_at, user.last_call_at, user.last_chat_at, user.last_seen_at, user.snapshot_updated_at]
      .filter(Boolean)
      .sort((a, b) => timeValue(b) - timeValue(a))[0] || user.created_at
    const notes = snapshot?.notes && typeof snapshot.notes === 'object' ? snapshot.notes : {}
    const enriched = {
      ...user,
      last_active_at: lastActiveAt,
      plan_count: Array.isArray(snapshot?.plans) ? snapshot.plans.length : 0,
      entry_count: snapshot?.entries && typeof snapshot.entries === 'object' ? Object.keys(snapshot.entries).length : 0,
      note_count: Object.values(notes).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0),
    }
    delete enriched.snapshot_json
    return enriched
  })

  const compareRecent = (a, b) => timeValue(b.last_active_at) - timeValue(a.last_active_at)
  const sorters = {
    recent: compareRecent,
    nickname: (a, b) => a.nickname.localeCompare(b.nickname, 'zh-CN', { numeric: true, sensitivity: 'base' }),
    registered: (a, b) => timeValue(b.created_at) - timeValue(a.created_at),
    calls: (a, b) => numberValue(b.model_call_count) - numberValue(a.model_call_count) || compareRecent(a, b),
    activity: (a, b) => numberValue(b.activity_count) - numberValue(a.activity_count) || compareRecent(a, b),
    plans: (a, b) => numberValue(b.plan_count) - numberValue(a.plan_count) || compareRecent(a, b),
  }
  users.sort(sorters[sort])
  return jsonResponse({ users, summary: summary || {}, sort }, 200, request)
}

export async function onRequestPost({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const admin = await authenticate(env, request, true)
  if (!admin) return jsonResponse({ error: '需要管理员权限' }, 403, request)
  try {
    const payload = await readJson(request, 12 * 1024)
    const nickname = normalizeNickname(payload.nickname)
    const password = typeof payload.password === 'string' ? payload.password : ''
    const role = payload.role === 'admin' ? 'admin' : 'user'
    if (!validNickname(nickname)) return jsonResponse({ error: '昵称格式不正确' }, 400, request)
    if (!validPassword(password)) return jsonResponse({ error: '密码需为 6—72 位' }, 400, request)
    const passwordRecord = await createPasswordRecord(password)
    const timestamp = nowIso()
    const id = crypto.randomUUID()
    await env.DB.prepare(`INSERT INTO users
      (id, nickname, password_hash, password_salt, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`)
      .bind(id, nickname, passwordRecord.hash, passwordRecord.salt, role, timestamp, timestamp).run()
    await logActivity(env, request, admin.id, 'admin_user_created', { targetUserId: id, nickname, role })
    return jsonResponse({ ok: true, id }, 201, request)
  } catch (error) {
    const duplicate = String(error?.message || '').includes('UNIQUE')
    return jsonResponse({ error: duplicate ? '该昵称已存在' : error?.message || '创建用户失败' }, duplicate ? 409 : error?.status || 500, request)
  }
}
