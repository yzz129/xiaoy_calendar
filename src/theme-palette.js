const HEX_PATTERN = /^#[0-9a-f]{6}$/i

const DEFAULT_SEED = {
  mode: 'light',
  primary: '#55c9a5',
  secondary: '#ff806d',
  accent: '#57a9e8',
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

export function normalizeHex(value, fallback = '') {
  const text = String(value || '').trim()
  return HEX_PATTERN.test(text) ? text.toLowerCase() : fallback
}

function hexToRgb(hex) {
  const value = normalizeHex(hex, '#000000').slice(1)
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function componentToHex(value) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')
}

function rgbToHex({ r, g, b }) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: lightness }
  const delta = max - min
  const saturation = lightness > .5 ? delta / (2 - max - min) : delta / (max + min)
  let hue
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return { h: hue * 60, s: saturation, l: lightness }
}

function hslToHex(hue, saturation, lightness) {
  const h = ((Number(hue) % 360) + 360) % 360 / 360
  const s = clamp(saturation)
  const l = clamp(lightness)
  if (!s) return rgbToHex({ r: l * 255, g: l * 255, b: l * 255 })
  const q = l < .5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (offset) => {
    let value = h + offset
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }
  return rgbToHex({ r: channel(1 / 3) * 255, g: channel(0) * 255, b: channel(-1 / 3) * 255 })
}

function relativeLuminance({ r, g, b }) {
  const linear = (channel) => {
    const value = channel / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  }
  return linear(r) * .2126 + linear(g) * .7152 + linear(b) * .0722
}

function hueDistance(first, second) {
  const distance = Math.abs(first - second) % 360
  return Math.min(distance, 360 - distance)
}

export function normalizePaletteSeed(value, fallback = DEFAULT_SEED) {
  const safeFallback = fallback && typeof fallback === 'object' ? fallback : DEFAULT_SEED
  return {
    mode: value?.mode === 'dark' ? 'dark' : value?.mode === 'light' ? 'light' : safeFallback.mode === 'dark' ? 'dark' : 'light',
    primary: normalizeHex(value?.primary, normalizeHex(safeFallback.primary, DEFAULT_SEED.primary)),
    secondary: normalizeHex(value?.secondary, normalizeHex(safeFallback.secondary, DEFAULT_SEED.secondary)),
    accent: normalizeHex(value?.accent, normalizeHex(safeFallback.accent, DEFAULT_SEED.accent)),
  }
}

export function extractPaletteSeed(imageData) {
  const pixels = imageData?.data || imageData
  if (!pixels || typeof pixels.length !== 'number' || pixels.length < 4) return { ...DEFAULT_SEED }
  const bins = new Map()
  let luminanceTotal = 0
  let sampled = 0
  const pixelCount = Math.floor(pixels.length / 4)
  const stride = Math.max(1, Math.floor(pixelCount / 9000))
  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const index = pixel * 4
    if (pixels[index + 3] !== undefined && pixels[index + 3] < 160) continue
    const r = pixels[index]
    const g = pixels[index + 1]
    const b = pixels[index + 2]
    const rgb = { r, g, b }
    luminanceTotal += relativeLuminance(rgb)
    sampled += 1
    const hsl = rgbToHsl(rgb)
    if (hsl.l < .06 || hsl.l > .95 || hsl.s < .12) continue
    const key = `${Math.round(r / 28)},${Math.round(g / 28)},${Math.round(b / 28)}`
    const current = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 }
    current.count += 1
    current.r += r
    current.g += g
    current.b += b
    bins.set(key, current)
  }
  const colors = [...bins.values()].map((bin) => {
    const rgb = { r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count }
    const hsl = rgbToHsl(rgb)
    return { ...rgb, ...hsl, count: bin.count }
  })
  for (const color of colors) {
    color.support = colors.reduce((total, candidate) => {
      const distance = hueDistance(color.h, candidate.h)
      return total + (distance <= 36 ? candidate.count * (1 - distance / 48) : 0)
    }, 0)
    color.score = color.support * (.94 + Math.min(.8, color.s) * .08)
  }
  colors.sort((a, b) => b.score - a.score)
  if (!colors.length) return { ...DEFAULT_SEED, mode: sampled && luminanceTotal / sampled < .32 ? 'dark' : 'light' }
  const primary = colors[0]
  const secondary = colors.find((color) => hueDistance(color.h, primary.h) >= 32 && color.s >= .2 && color.support >= primary.support * .35)
    || { h: primary.h + 18, s: Math.max(primary.s, .42), l: primary.l }
  const accent = colors.find((color) => hueDistance(color.h, primary.h) >= 28 && hueDistance(color.h, secondary.h) >= 24 && color.s >= .18 && color.support >= primary.support * .3)
    || { h: primary.h - 18, s: Math.max(primary.s, .42), l: primary.l }
  const colorHex = (color) => Number.isFinite(color.r) ? rgbToHex(color) : hslToHex(color.h, color.s, color.l)
  return {
    mode: sampled && luminanceTotal / sampled < .32 ? 'dark' : 'light',
    primary: colorHex(primary),
    secondary: colorHex(secondary),
    accent: colorHex(accent),
  }
}

export function buildAdaptivePalette(value, fallback = DEFAULT_SEED) {
  const seed = normalizePaletteSeed(value, fallback)
  const primary = rgbToHsl(hexToRgb(seed.primary))
  const secondary = rgbToHsl(hexToRgb(seed.secondary))
  const accent = rgbToHsl(hexToRgb(seed.accent))
  if (seed.mode === 'dark') {
    return {
      mode: 'dark',
      primary: hslToHex(primary.h, Math.max(.42, primary.s), .29),
      primaryStrong: hslToHex(primary.h, Math.max(.56, primary.s), .69),
      primarySoft: hslToHex(primary.h, Math.max(.24, primary.s * .55), .21),
      secondary: hslToHex(secondary.h, Math.max(.58, secondary.s), .68),
      secondarySoft: hslToHex(secondary.h, Math.max(.22, secondary.s * .45), .22),
      highlight: hslToHex(secondary.h + 48, Math.max(.5, secondary.s), .34),
      highlightSoft: hslToHex(secondary.h + 48, Math.max(.22, secondary.s * .4), .21),
      blue: hslToHex(accent.h, Math.max(.56, accent.s), .68),
      blueSoft: hslToHex(accent.h, Math.max(.22, accent.s * .45), .22),
      paper: hslToHex(primary.h, .25, .13),
      paperSoft: hslToHex(primary.h, .24, .18),
      ink: hslToHex(primary.h, .16, .96),
      text: hslToHex(primary.h, .14, .78),
      muted: hslToHex(primary.h, .13, .59),
      line: hslToHex(primary.h, .2, .29),
    }
  }
  return {
    mode: 'light',
    primary: hslToHex(primary.h, Math.max(.46, primary.s * .8), .72),
    primaryStrong: hslToHex(primary.h, Math.max(.58, primary.s), .3),
    primarySoft: hslToHex(primary.h, Math.max(.28, primary.s * .5), .94),
    secondary: hslToHex(secondary.h, Math.max(.58, secondary.s), .46),
    secondarySoft: hslToHex(secondary.h, Math.max(.3, secondary.s * .45), .95),
    highlight: hslToHex(secondary.h + 48, Math.max(.58, secondary.s), .66),
    highlightSoft: hslToHex(secondary.h + 48, Math.max(.28, secondary.s * .4), .95),
    blue: hslToHex(accent.h, Math.max(.56, accent.s), .46),
    blueSoft: hslToHex(accent.h, Math.max(.28, accent.s * .45), .95),
    paper: hslToHex(primary.h, .25, .995),
    paperSoft: hslToHex(primary.h, .22, .98),
    ink: hslToHex(primary.h, .32, .19),
    text: hslToHex(primary.h, .2, .39),
    muted: hslToHex(primary.h, .14, .5),
    line: hslToHex(primary.h, .18, .88),
  }
}

export const PALETTE_KEYS = [
  'primary', 'primaryStrong', 'primarySoft', 'secondary', 'secondarySoft', 'highlight', 'highlightSoft',
  'blue', 'blueSoft', 'paper', 'paperSoft', 'ink', 'text', 'muted', 'line',
]

export function normalizeAdaptivePalette(value) {
  if (!value || typeof value !== 'object') return null
  const normalized = { mode: value.mode === 'dark' ? 'dark' : 'light' }
  for (const key of PALETTE_KEYS) {
    const color = normalizeHex(value[key])
    if (!color) return null
    normalized[key] = color
  }
  return normalized
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function paletteStyleVariables(value) {
  const palette = normalizeAdaptivePalette(value)
  if (!palette) return {}
  const paperRgb = hexToRgb(palette.paper)
  const paperSoftRgb = hexToRgb(palette.paperSoft)
  return {
    '--paper': palette.paper,
    '--paper-soft': palette.paperSoft,
    '--ink': palette.ink,
    '--text': palette.text,
    '--muted': palette.muted,
    '--line': palette.line,
    '--mint': palette.primary,
    '--mint-dark': palette.primaryStrong,
    '--mint-soft': palette.primarySoft,
    '--coral': palette.secondary,
    '--coral-soft': palette.secondarySoft,
    '--yellow': palette.highlight,
    '--yellow-soft': palette.highlightSoft,
    '--blue': palette.blue,
    '--blue-soft': palette.blueSoft,
    '--paper-rgb': `${paperRgb.r} ${paperRgb.g} ${paperRgb.b}`,
    '--paper-soft-rgb': `${paperSoftRgb.r} ${paperSoftRgb.g} ${paperSoftRgb.b}`,
    '--skin-overlay-top': rgba(palette.paper, palette.mode === 'dark' ? .22 : .16),
    '--skin-overlay-bottom': rgba(palette.paperSoft, palette.mode === 'dark' ? .34 : .24),
  }
}
