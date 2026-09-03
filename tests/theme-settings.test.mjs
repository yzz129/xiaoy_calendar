import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeVisionFocus, normalizeVisionPalette } from '../functions/api/theme/analyze.js'
import { normalizeSurfaceOpacity } from '../src/theme-settings.js'
import { buildAdaptivePalette, extractPaletteSeed, normalizeAdaptivePalette, paletteStyleVariables } from '../src/theme-palette.js'

test('vision focus keeps valid edge coordinates and clamps overflow', () => {
  assert.deepEqual(normalizeVisionFocus({ focusX: 0, focusY: 1 }), { x: 0, y: 1 })
  assert.deepEqual(normalizeVisionFocus({ x: -2, y: 4 }), { x: 0, y: 1 })
})

test('vision focus falls back for invalid model output', () => {
  assert.deepEqual(normalizeVisionFocus({ focusX: 'oops' }), { x: .5, y: .45 })
})

test('vision and device color analysis produce a synchronized readable UI palette', () => {
  assert.deepEqual(normalizeVisionPalette({ colorMode: 'dark', primary: '#123456', secondary: '#abcdef', accent: '#ff8800' }), {
    mode: 'dark', primary: '#123456', secondary: '#abcdef', accent: '#ff8800',
  })
  assert.equal(normalizeVisionPalette({ primary: 'red' }), null)
  const pixels = new Uint8ClampedArray(100 * 4)
  for (let index = 0; index < 100; index += 1) {
    const offset = index * 4
    const color = index < 70 ? [214, 62, 86] : [45, 125, 220]
    pixels.set([...color, 255], offset)
  }
  const seed = extractPaletteSeed(pixels)
  assert.match(seed.primary, /^#[0-9a-f]{6}$/)
  const palette = buildAdaptivePalette({ ...seed, mode: 'light' })
  assert.equal(normalizeAdaptivePalette(palette)?.mode, 'light')
  const style = paletteStyleVariables(palette)
  assert.equal(style['--mint'], palette.primary)
  assert.match(style['--skin-overlay-top'], /^rgba\(/)
})

test('dominant white and green wallpaper cannot be hijacked by a small saturated blue area', () => {
  const pixels = new Uint8ClampedArray(100 * 4)
  for (let index = 0; index < 100; index += 1) {
    const offset = index * 4
    const color = index < 75 ? [248, 249, 246] : index < 95 ? [74, 184, 118] : [25, 80, 220]
    pixels.set([...color, 255], offset)
  }
  const seed = extractPaletteSeed(pixels)
  assert.equal(seed.mode, 'light')
  assert.equal(seed.primary, '#4ab876')
  const palette = buildAdaptivePalette(seed)
  assert.equal(palette.mode, 'light')
  assert.match(palette.primaryStrong, /^#[0-9a-f]{6}$/)
  assert.notEqual(palette.blue, '#1d59d4')
})

test('custom skin keeps fixed overlays out of the document flow on mobile', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /\.app\.has-custom-skin\s*>\s*\*\s*\{[^}]*position:\s*relative/s)
  assert.match(css, /\.app\.has-custom-skin\s*>\s*\.app-frame\s*\{\s*position:\s*relative;\s*z-index:\s*1;/)
  assert.match(css, /\.app\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;/s)
  assert.match(css, /\.calendar-shell\s*\{[^}]*min-height:\s*clamp\(292px,\s*calc\(100dvh\s*-\s*420px\),\s*420px\);[^}]*flex:\s*1\s+1\s+auto;[^}]*grid-template-rows:\s*34px\s+minmax\(258px,\s*1fr\)/s)
  assert.match(css, /\.calendar-grid\s*\{[^}]*min-height:\s*258px;[^}]*repeat\(6,\s*minmax\(43px,\s*1fr\)\)/s)
  assert.match(css, /html\s*\{[^}]*-webkit-text-size-adjust:\s*100%;[^}]*text-size-adjust:\s*100%;/s)
  assert.match(css, /\.app\.has-custom-skin::before\s*\{[^}]*background-size:\s*cover, contain;/s)
  assert.match(css, /\.custom-skin-preview\.has-image\s*\{[^}]*min-height:\s*0;/s)
  assert.match(css, /\.custom-skin-preview\s*>\s*img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;/s)
  assert.match(css, /rgba\(255, 255, 255, \.16\)/)
})

test('foreground opacity stays readable, sync-safe, and leaves the background layer untouched', () => {
  assert.equal(normalizeSurfaceOpacity(undefined), 88)
  assert.equal(normalizeSurfaceOpacity(32), 45)
  assert.equal(normalizeSurfaceOpacity('76'), 76)
  assert.equal(normalizeSurfaceOpacity(140), 100)
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.app\s*>\s*\*\s*\{[^}]*opacity:\s*var\(--content-opacity\)/s)
  assert.doesNotMatch(css, /\.app::before[^}]*opacity:\s*var\(--content-opacity\)/s)
})

test('system font option uses the current-theme wording', () => {
  const dialog = readFileSync(new URL('../src/components/ThemeDialog.jsx', import.meta.url), 'utf8')
  assert.match(dialog, /跟随当前主题字体/)
  assert.doesNotMatch(dialog, /尽量使用设备当前设置的字体/)
})

test('theme preview follows the image ratio and omits the verbose upload hint', () => {
  const dialog = readFileSync(new URL('../src/components/ThemeDialog.jsx', import.meta.url), 'utf8')
  assert.match(dialog, /<img src=\{previewUrl\} alt="当前壁纸完整预览"/)
  assert.doesNotMatch(dialog, /className="skin-help"/)
})
