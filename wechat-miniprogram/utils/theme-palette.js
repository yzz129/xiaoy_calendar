const HEX = /^#[0-9a-f]{6}$/i
const KEYS = [
  'primary', 'primaryStrong', 'primarySoft', 'secondary', 'secondarySoft', 'highlight', 'highlightSoft',
  'blue', 'blueSoft', 'paper', 'paperSoft', 'ink', 'text', 'muted', 'line',
]

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, Number(value) || 0)) }
function safeHex(value, fallback = '') { const text = String(value || '').trim(); return HEX.test(text) ? text.toLowerCase() : fallback }
function component(value) { return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0') }
function rgbHex(r, g, b) { return `#${component(r)}${component(g)}${component(b)}` }
function hexRgb(hex) { const value = safeHex(hex, '#000000').slice(1); return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) } }
function rgbHsl(hex) {
  const rgb = hexRgb(hex); const r = rgb.r / 255; const g = rgb.g / 255; const b = rgb.b / 255
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min; const s = l > .5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s, l }
}
function hslHex(hue, saturation, lightness) {
  let h = ((Number(hue) % 360) + 360) % 360 / 360; const s = clamp(saturation); const l = clamp(lightness)
  if (!s) return rgbHex(l * 255, l * 255, l * 255)
  const q = l < .5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q
  const channel = (offset) => { let value = h + offset; if (value < 0) value += 1; if (value > 1) value -= 1; if (value < 1 / 6) return p + (q - p) * 6 * value; if (value < .5) return q; if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6; return p }
  return rgbHex(channel(1 / 3) * 255, channel(0) * 255, channel(-1 / 3) * 255)
}

function buildAdaptivePalette(seed) {
  const mode = seed?.mode === 'dark' ? 'dark' : 'light'
  const primary = rgbHsl(safeHex(seed?.primary, '#55c9a5'))
  const secondary = rgbHsl(safeHex(seed?.secondary, '#ff806d'))
  const accent = rgbHsl(safeHex(seed?.accent, '#57a9e8'))
  if (mode === 'dark') return {
    mode, primary: hslHex(primary.h, Math.max(.42, primary.s), .29), primaryStrong: hslHex(primary.h, Math.max(.56, primary.s), .69), primarySoft: hslHex(primary.h, Math.max(.24, primary.s * .55), .21),
    secondary: hslHex(secondary.h, Math.max(.58, secondary.s), .68), secondarySoft: hslHex(secondary.h, Math.max(.22, secondary.s * .45), .22), highlight: hslHex(secondary.h + 48, Math.max(.5, secondary.s), .34), highlightSoft: hslHex(secondary.h + 48, Math.max(.22, secondary.s * .4), .21),
    blue: hslHex(accent.h, Math.max(.56, accent.s), .68), blueSoft: hslHex(accent.h, Math.max(.22, accent.s * .45), .22), paper: hslHex(primary.h, .25, .13), paperSoft: hslHex(primary.h, .24, .18), ink: hslHex(primary.h, .16, .96), text: hslHex(primary.h, .14, .78), muted: hslHex(primary.h, .13, .59), line: hslHex(primary.h, .2, .29),
  }
  return {
    mode, primary: hslHex(primary.h, Math.max(.46, primary.s * .8), .72), primaryStrong: hslHex(primary.h, Math.max(.58, primary.s), .3), primarySoft: hslHex(primary.h, Math.max(.28, primary.s * .5), .94),
    secondary: hslHex(secondary.h, Math.max(.58, secondary.s), .46), secondarySoft: hslHex(secondary.h, Math.max(.3, secondary.s * .45), .95), highlight: hslHex(secondary.h + 48, Math.max(.58, secondary.s), .66), highlightSoft: hslHex(secondary.h + 48, Math.max(.28, secondary.s * .4), .95),
    blue: hslHex(accent.h, Math.max(.56, accent.s), .46), blueSoft: hslHex(accent.h, Math.max(.28, accent.s * .45), .95), paper: hslHex(primary.h, .25, .995), paperSoft: hslHex(primary.h, .22, .98), ink: hslHex(primary.h, .32, .19), text: hslHex(primary.h, .2, .39), muted: hslHex(primary.h, .14, .5), line: hslHex(primary.h, .18, .88),
  }
}

function extractPaletteSeed(imageData) {
  const pixels = imageData?.data || imageData
  if (!pixels || pixels.length < 4) return null
  const bins = {}; let brightness = 0; let sampled = 0
  const count = Math.floor(pixels.length / 4); const stride = Math.max(1, Math.floor(count / 5000))
  for (let pixel = 0; pixel < count; pixel += stride) {
    const index = pixel * 4; if (pixels[index + 3] !== undefined && pixels[index + 3] < 160) continue
    const r = pixels[index]; const g = pixels[index + 1]; const b = pixels[index + 2]
    brightness += (r * 299 + g * 587 + b * 114) / 255000; sampled += 1
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); if (max - min < 24 || max > 245 || max < 16) continue
    const key = `${Math.round(r / 32)},${Math.round(g / 32)},${Math.round(b / 32)}`
    const bin = bins[key] || { count: 0, r: 0, g: 0, b: 0 }; bin.count += 1; bin.r += r; bin.g += g; bin.b += b; bins[key] = bin
  }
  const colors = Object.keys(bins).map((key) => { const bin = bins[key]; const hex = rgbHex(bin.r / bin.count, bin.g / bin.count, bin.b / bin.count); const hsl = rgbHsl(hex); return { hex, h: hsl.h, s: hsl.s, count: bin.count } })
  if (!colors.length) return null
  const distance = (a, b) => { const value = Math.abs(a - b) % 360; return Math.min(value, 360 - value) }
  colors.forEach((color) => { color.support = colors.reduce((total, candidate) => total + (distance(color.h, candidate.h) <= 36 ? candidate.count * (1 - distance(color.h, candidate.h) / 48) : 0), 0); color.score = color.support * (.94 + Math.min(.8, color.s) * .08) })
  colors.sort((a, b) => b.score - a.score)
  const primary = colors[0]
  const secondary = colors.find((color) => distance(color.h, primary.h) > 32 && color.s >= .2 && color.support >= primary.support * .35) || { hex: hslHex(primary.h + 18, Math.max(.42, primary.s), .55), h: primary.h + 18 }
  const accent = colors.find((color) => distance(color.h, primary.h) > 28 && distance(color.h, secondary.h) > 24 && color.s >= .18 && color.support >= primary.support * .3) || { hex: hslHex(primary.h - 18, Math.max(.42, primary.s), .55) }
  return { mode: sampled && brightness / sampled < .42 ? 'dark' : 'light', primary: primary.hex, secondary: secondary.hex, accent: accent.hex }
}

function normalizeAdaptivePalette(value) {
  if (!value || typeof value !== 'object') return null
  const result = { mode: value.mode === 'dark' ? 'dark' : 'light' }
  for (const key of KEYS) { const color = safeHex(value[key]); if (!color) return null; result[key] = color }
  return result
}

function rgba(hex, alpha) { const color = hexRgb(hex); return `rgba(${color.r},${color.g},${color.b},${alpha})` }
function paletteStyleText(value) {
  const palette = normalizeAdaptivePalette(value); if (!palette) return ''
  return `--paper:${palette.paper};--paper-soft:${palette.paperSoft};--ink:${palette.ink};--text:${palette.text};--muted:${palette.muted};--line:${palette.line};--mint:${palette.primary};--mint-dark:${palette.primaryStrong};--mint-soft:${palette.primarySoft};--coral:${palette.secondary};--coral-soft:${palette.secondarySoft};--yellow:${palette.highlight};--yellow-soft:${palette.highlightSoft};--blue:${palette.blue};--blue-soft:${palette.blueSoft};--surface-paper:${palette.paper};--surface-paper-soft:${palette.paperSoft};`
}
function paletteOverlay(value) {
  const palette = normalizeAdaptivePalette(value); if (!palette) return ''
  return `${rgba(palette.paper, palette.mode === 'dark' ? .76 : .7)}, ${rgba(palette.paperSoft, palette.mode === 'dark' ? .86 : .82)}`
}

module.exports = { buildAdaptivePalette, extractPaletteSeed, normalizeAdaptivePalette, paletteStyleText, paletteOverlay }
