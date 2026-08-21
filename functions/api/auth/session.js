import { authenticate, jsonResponse, optionsResponse, publicUser, requestOrigin } from '../../../server/auth.js'

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'GET, OPTIONS')
}

export async function onRequestGet({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const adminScope = new URL(request.url).searchParams.get('scope') === 'admin'
  const user = await authenticate(env, request, adminScope)
  if (!user) return jsonResponse({ user: null }, 401, request)
  return jsonResponse({ user: publicUser(user) }, 200, request)
}
