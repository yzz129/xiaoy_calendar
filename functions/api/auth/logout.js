import {
  authenticate,
  clearSessionCookie,
  jsonResponse,
  logActivity,
  optionsResponse,
  requestOrigin,
  revokeCurrentSession,
} from '../../../server/auth.js'

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'POST, OPTIONS')
}

export async function onRequestPost({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const adminScope = new URL(request.url).searchParams.get('scope') === 'admin'
  const user = await authenticate(env, request, adminScope)
  if (user) await logActivity(env, request, user.id, adminScope ? 'admin_logout' : 'logout', {})
  await revokeCurrentSession(env, request, adminScope)
  return jsonResponse({ ok: true }, 200, request, { 'Set-Cookie': clearSessionCookie(adminScope) })
}
