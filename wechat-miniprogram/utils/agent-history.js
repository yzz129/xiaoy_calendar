const HISTORY_VERSION = 1
const HISTORY_LIMIT = 30

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeMessage(message, index = 0) {
  if (!message || typeof message !== 'object') return null
  const role = message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : ''
  const content = String(message.content || '').trim()
  if (!role || !content) return null
  const createdAt = String(message.createdAt || message.created_at || new Date().toISOString())
  return {
    id: String(message.id || `${role}-${createdAt}-${index}`),
    role,
    content,
    createdAt,
    streaming: false,
    provider: String(message.provider || ''),
    model: String(message.model || ''),
    status: String(message.status || ''),
    questions: safeArray(message.questions).map(String).filter(Boolean).slice(0, 8),
    planDrafts: safeArray(message.planDrafts).slice(0, 8),
    actionDrafts: safeArray(message.actionDrafts).slice(0, 8),
    sources: safeArray(message.sources).slice(0, 8),
    searchWarning: String(message.searchWarning || ''),
  }
}

function normalizeMessages(messages, limit = HISTORY_LIMIT) {
  return safeArray(messages)
    .map(normalizeMessage)
    .filter(Boolean)
    .slice(-Math.max(1, Number(limit) || HISTORY_LIMIT))
}

function historyKey(user) {
  const identity = user?.id || user?.nickname || 'guest'
  return `xy-calendar-agent-history-v${HISTORY_VERSION}:${String(identity)}`
}

function signature(message) {
  return `${message.role}\u0000${message.content}`
}

function mergeHistories(remoteMessages, localMessages, limit = HISTORY_LIMIT) {
  const remote = normalizeMessages(remoteMessages, limit)
  const local = normalizeMessages(localMessages, limit)
  if (!remote.length) return local
  const remoteIds = new Set(remote.map((item) => item.id))
  const remoteSignatures = new Set(remote.map(signature))
  const combined = [...remote]
  local.forEach((item) => {
    if (!remoteIds.has(item.id) && !remoteSignatures.has(signature(item))) combined.push(item)
  })
  combined.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  return combined.slice(-Math.max(1, Number(limit) || HISTORY_LIMIT))
}

module.exports = { HISTORY_LIMIT, historyKey, normalizeMessages, mergeHistories }
