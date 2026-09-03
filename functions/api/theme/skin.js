import { authenticate, corsHeaders, jsonResponse, logActivity, nowIso, optionsResponse, requestOrigin } from '../../../server/auth.js'

const MAX_SKIN_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png'])

function safeDimension(value) {
  const number = Math.round(Number(value) || 0)
  return Math.max(1, Math.min(5000, number))
}

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'GET, PUT, DELETE, OPTIONS')
}

export async function onRequestGet({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '请先登录' }, 401, request)
  const row = await env.DB.prepare('SELECT image_blob, content_type, updated_at FROM user_theme_assets WHERE user_id = ?').bind(user.id).first()
  if (!row?.image_blob) return jsonResponse({ error: '尚未上传自定义皮肤' }, 404, request)
  const imageBody = new Uint8Array(row.image_blob)
  const imageBytes = imageBody.byteLength
  return new Response(imageBody, {
    status: 200,
    headers: {
      'Content-Type': ALLOWED_TYPES.has(row.content_type) ? row.content_type : 'image/webp',
      ...(imageBytes ? { 'Content-Length': String(imageBytes) } : {}),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(request ? corsHeaders(request) : {}),
    },
  })
}

export async function onRequestPut({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '请先登录' }, 401, request)
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].toLowerCase()
  if (!ALLOWED_TYPES.has(contentType)) return jsonResponse({ error: '仅支持 WebP、JPG 和 PNG 图片' }, 415, request)
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > MAX_SKIN_BYTES) return jsonResponse({ error: '处理后的皮肤图片不能超过 2MB' }, 413, request)
  const buffer = await request.arrayBuffer()
  if (!buffer.byteLength || buffer.byteLength > MAX_SKIN_BYTES) return jsonResponse({ error: '处理后的皮肤图片不能超过 2MB' }, 413, request)
  const url = new URL(request.url)
  const width = safeDimension(url.searchParams.get('width'))
  const height = safeDimension(url.searchParams.get('height'))
  const revision = String(url.searchParams.get('revision') || Date.now()).replace(/[^\d]/g, '').slice(0, 20) || `${Date.now()}`
  const updatedAt = nowIso()
  await env.DB.prepare(`INSERT INTO user_theme_assets (user_id, image_blob, content_type, width, height, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET image_blob = excluded.image_blob, content_type = excluded.content_type,
      width = excluded.width, height = excluded.height, updated_at = excluded.updated_at`)
    .bind(user.id, buffer, contentType, width, height, updatedAt).run()
  await logActivity(env, request, user.id, 'theme_skin_upload', { bytes: buffer.byteLength, width, height })
  return jsonResponse({ ok: true, revision, updatedAt }, 200, request)
}

export async function onRequestDelete({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '请先登录' }, 401, request)
  // 删除当前皮肤只影响用户端展示。管理员审计用的上传原图必须保留，
  // 否则用户切回内置主题后，后台会永久失去这次上传记录。
  await env.DB.prepare('DELETE FROM user_theme_assets WHERE user_id = ?').bind(user.id).run()
  await logActivity(env, request, user.id, 'theme_skin_delete')
  return jsonResponse({ ok: true }, 200, request)
}
