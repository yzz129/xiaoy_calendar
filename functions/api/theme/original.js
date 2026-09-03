import { authenticate, jsonResponse, logActivity, nowIso, optionsResponse, requestOrigin } from '../../../server/auth.js'

const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024
const CHUNK_BYTES = 1500 * 1024
const ALLOWED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png'])

function safeFilename(request, contentType) {
  const fallback = contentType === 'image/png' ? 'wallpaper.png' : contentType === 'image/webp' ? 'wallpaper.webp' : 'wallpaper.jpg'
  try {
    return new URL(request.url).searchParams.get('filename')?.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 160) || fallback
  } catch {
    return fallback
  }
}

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'PUT, OPTIONS')
}

export async function onRequestPut({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '请先登录' }, 401, request)
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].toLowerCase()
  if (!ALLOWED_TYPES.has(contentType)) return jsonResponse({ error: '原图仅支持 WebP、JPG 和 PNG' }, 415, request)
  const declaredBytes = Number(request.headers.get('Content-Length') || 0)
  if (declaredBytes > MAX_ORIGINAL_BYTES) return jsonResponse({ error: '原图不能超过 15MB' }, 413, request)
  const buffer = await request.arrayBuffer()
  if (!buffer.byteLength || buffer.byteLength > MAX_ORIGINAL_BYTES) return jsonResponse({ error: '原图不能超过 15MB' }, 413, request)

  const updatedAt = nowIso()
  const filename = safeFilename(request, contentType)
  await env.DB.prepare('DELETE FROM user_theme_original_chunks WHERE user_id = ?').bind(user.id).run()
  await env.DB.prepare(`INSERT INTO user_theme_originals (user_id, content_type, filename, byte_size, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET content_type = excluded.content_type, filename = excluded.filename,
      byte_size = excluded.byte_size, updated_at = excluded.updated_at`)
    .bind(user.id, contentType, filename, buffer.byteLength, updatedAt).run()

  const bytes = new Uint8Array(buffer)
  let chunkCount = 0
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
    const chunk = bytes.slice(offset, Math.min(bytes.byteLength, offset + CHUNK_BYTES))
    await env.DB.prepare('INSERT INTO user_theme_original_chunks (user_id, chunk_index, chunk_blob) VALUES (?, ?, ?)')
      .bind(user.id, chunkCount, chunk.buffer).run()
    chunkCount += 1
  }
  await logActivity(env, request, user.id, 'theme_original_upload', { bytes: buffer.byteLength, contentType, chunkCount })
  return jsonResponse({ ok: true, bytes: buffer.byteLength, filename, updatedAt }, 200, request)
}
