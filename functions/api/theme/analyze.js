import { authenticate, compactText, jsonResponse, logActivity, optionsResponse, readJson, requestOrigin } from '../../../server/auth.js'
import { normalizeHex, normalizePaletteSeed } from '../../../src/theme-palette.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_IMAGE_DATA_BYTES = 900 * 1024

function clamp(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback
}

function parseJsonObject(value) {
  const text = String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('视觉模型没有返回有效取景位置')
  return JSON.parse(text.slice(start, end + 1))
}

export function normalizeVisionFocus(value) {
  return {
    x: clamp(value?.focusX ?? value?.x, .5),
    y: clamp(value?.focusY ?? value?.y, .45),
  }
}

export function normalizeVisionPalette(value) {
  if (![value?.primary, value?.secondary, value?.accent].every((color) => normalizeHex(color))) return null
  return normalizePaletteSeed({
    mode: value?.colorMode ?? value?.mode,
    primary: value?.primary,
    secondary: value?.secondary,
    accent: value?.accent,
  })
}

export function onRequestOptions({ request }) {
  return optionsResponse(request, 'POST, OPTIONS')
}

export async function onRequestPost({ request, env }) {
  if (requestOrigin(request) === null) return jsonResponse({ error: '不允许跨站调用' }, 403, request)
  const user = await authenticate(env, request)
  if (!user) return jsonResponse({ error: '请先登录' }, 401, request)
  if (!env.OPENROUTER_API_KEY) return jsonResponse({ error: '免费视觉模型暂不可用' }, 503, request)

  try {
    const payload = await readJson(request, MAX_IMAGE_DATA_BYTES)
    const image = String(payload.image || '')
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(image)) {
      return jsonResponse({ error: '图片格式不受支持' }, 415, request)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 22000)
    let response
    try {
      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://calendar.yzzwnw.asia/',
          'X-Title': '小Y日历智能皮肤',
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          temperature: 0,
          max_tokens: 140,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: '你是图片构图助手。找出这张图片在横屏、竖屏和方形背景中最值得保留的视觉主体中心。返回严格 JSON：{"focusX":0到1的小数,"focusY":0到1的小数,"description":"10字内主体"}。坐标从左上角开始；优先人脸、宠物和主体物，避免把主体贴边。不要判断或返回颜色。' },
              { type: 'image_url', image_url: { url: image } },
            ],
          }],
        }),
      })
    } finally {
      clearTimeout(timer)
    }
    if (!response.ok) throw new Error(`视觉模型忙碌（${response.status}）`)
    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content
    const parsed = parseJsonObject(Array.isArray(content) ? content.map((part) => part?.text || '').join('') : content)
    const focus = normalizeVisionFocus(parsed)
    await logActivity(env, request, user.id, 'theme_skin_analyze', {
      provider: 'openrouter',
      model: compactText(result?.model || 'openrouter/free', 100),
      description: compactText(parsed.description, 40),
    })
    return jsonResponse({ focus, description: compactText(parsed.description, 40), provider: 'openrouter-free' }, 200, request)
  } catch (error) {
    return jsonResponse({ error: error?.name === 'AbortError' ? '免费视觉模型响应超时' : error?.message || '智能取景失败' }, error?.status || 503, request)
  }
}
