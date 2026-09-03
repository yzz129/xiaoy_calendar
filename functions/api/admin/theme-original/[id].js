import { authenticate, corsHeaders, jsonResponse, optionsResponse, requestOrigin } from '../../../../server/auth.js'

const ALLOWED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png'])

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'GET, OPTIONS')
}

export async function onRequestGet({ request, env, params }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const admin = await authenticate(env, request, true)
  if (!admin) return jsonResponse({ error: '需要管理员权限' }, 403, request)
  const id = String(params.id || '')
  const meta = await env.DB.prepare('SELECT content_type, filename, byte_size, updated_at FROM user_theme_originals WHERE user_id = ?').bind(id).first()
  if (!meta) return jsonResponse({ error: '该用户尚无已归档的壁纸原图' }, 404, request)
  const rows = await env.DB.prepare('SELECT chunk_blob FROM user_theme_original_chunks WHERE user_id = ? ORDER BY chunk_index ASC').bind(id).all()
  const chunks = (rows.results || []).map((row) => new Uint8Array(row.chunk_blob))
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  if (!chunks.length || totalBytes !== Number(meta.byte_size)) return jsonResponse({ error: '壁纸原图数据不完整' }, 500, request)
  const safeName = String(meta.filename || 'wallpaper').replace(/["\\\r\n]/g, '_')
  return new Response(new Blob(chunks, { type: meta.content_type }), {
    status: 200,
    headers: {
      'Content-Type': ALLOWED_TYPES.has(meta.content_type) ? meta.content_type : 'image/jpeg',
      'Content-Length': String(totalBytes),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(request),
    },
  })
}
