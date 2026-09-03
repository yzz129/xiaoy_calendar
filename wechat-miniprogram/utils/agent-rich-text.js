function inlineSegments(value) {
  const source = String(value || '')
  const segments = []
  let cursor = 0

  while (cursor < source.length) {
    const start = source.indexOf('**', cursor)
    if (start < 0) {
      if (cursor < source.length) segments.push({ text: source.slice(cursor), strong: false })
      break
    }
    if (start > cursor) segments.push({ text: source.slice(cursor, start), strong: false })
    const end = source.indexOf('**', start + 2)
    if (end < 0) {
      const pending = source.slice(start + 2)
      if (pending) segments.push({ text: pending, strong: false })
      break
    }
    const strong = source.slice(start + 2, end)
    if (strong) segments.push({ text: strong, strong: true })
    cursor = end + 2
  }

  return segments.length ? segments : [{ text: '', strong: false }]
}

function renderAgentRichText(content) {
  return String(content || '').split('\n').map((raw, index) => {
    const line = raw.replace(/\r$/, '')
    if (!line.trim()) return { id: `gap-${index}`, type: 'gap', segments: [] }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) return { id: `heading-${index}`, type: 'heading', level: heading[1].length, segments: inlineSegments(heading[2]) }

    const step = line.match(/^(\d+)[.、]\s*(.+)$/)
    if (step) return { id: `step-${index}`, type: 'step', marker: `${step[1]}.`, segments: inlineSegments(step[2]) }

    const bullet = line.match(/^[-•]\s*(.+)$/)
    if (bullet) return { id: `bullet-${index}`, type: 'bullet', marker: '•', segments: inlineSegments(bullet[1]) }

    return { id: `line-${index}`, type: 'line', segments: inlineSegments(line) }
  })
}

module.exports = { inlineSegments, renderAgentRichText }
