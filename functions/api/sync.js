import {
  authenticate,
  jsonResponse,
  logActivity,
  nowIso,
  optionsResponse,
  readJson,
  requestOrigin,
} from '../../server/auth.js'
import { normalizeAdaptivePalette } from '../../src/theme-palette.js'

const EMPTY_SNAPSHOT = {
  entries: {},
  notes: {},
  plans: [],
  planProgress: {},
  planTaskOverrides: {},
  theme: 'light',
  fontTheme: 'cloud',
  surfaceOpacity: 88,
  skin: { enabled: false, revision: '', focusX: 0.5, focusY: 0.45, palette: null },
  planTypeDataVersion: 1,
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function cleanSnapshot(value) {
  const skin = objectOrEmpty(value?.skin)
  return {
    ...EMPTY_SNAPSHOT,
    entries: objectOrEmpty(value?.entries),
    notes: objectOrEmpty(value?.notes),
    plans: Array.isArray(value?.plans) ? value.plans.slice(0, 300) : [],
    planProgress: objectOrEmpty(value?.planProgress),
    planTaskOverrides: objectOrEmpty(value?.planTaskOverrides),
    theme: value?.theme === 'berry-night' ? 'berry-night' : 'light',
    fontTheme: value?.fontTheme === 'system' ? 'system' : 'cloud',
    surfaceOpacity: Math.round(Math.max(45, Math.min(100, Number.isFinite(Number(value?.surfaceOpacity)) ? Number(value.surfaceOpacity) : 88))),
    skin: {
      enabled: Boolean(skin.enabled && skin.revision),
      revision: String(skin.revision || '').replace(/[^\w.-]/g, '').slice(0, 40),
      focusX: Math.max(0, Math.min(1, Number.isFinite(Number(skin.focusX)) ? Number(skin.focusX) : 0.5)),
      focusY: Math.max(0, Math.min(1, Number.isFinite(Number(skin.focusY)) ? Number(skin.focusY) : 0.45)),
      palette: normalizeAdaptivePalette(skin.palette),
    },
    planTypeDataVersion: 1,
  }
}

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'GET, POST, OPTIONS')
}

export async function onRequestGet({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '请先登录' }, 401, request)
  const row = await env.DB.prepare('SELECT data_json, updated_at FROM user_snapshots WHERE user_id = ?').bind(user.id).first()
  if (!row) return jsonResponse({ snapshot: null, updatedAt: null }, 200, request)
  try {
    return jsonResponse({ snapshot: cleanSnapshot(JSON.parse(row.data_json)), updatedAt: row.updated_at }, 200, request)
  } catch {
    return jsonResponse({ snapshot: null, updatedAt: row.updated_at }, 200, request)
  }
}

export async function onRequestPost({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '请先登录' }, 401, request)
  try {
    const payload = await readJson(request)
    const snapshot = cleanSnapshot(payload.snapshot)
    const serialized = JSON.stringify(snapshot)
    const updatedAt = nowIso()
    await env.DB.prepare(`INSERT INTO user_snapshots (user_id, data_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
      .bind(user.id, serialized, updatedAt).run()
    await logActivity(env, request, user.id, 'data_sync', {
      plans: snapshot.plans.length,
      entries: Object.keys(snapshot.entries).length,
      notes: Object.values(snapshot.notes).reduce((total, notes) => total + (Array.isArray(notes) ? notes.length : 0), 0),
    })
    return jsonResponse({ ok: true, updatedAt }, 200, request)
  } catch (error) {
    return jsonResponse({ error: error?.message || '同步失败' }, error?.status || 500, request)
  }
}
