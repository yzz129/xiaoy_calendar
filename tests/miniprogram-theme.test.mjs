import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve('wechat-miniprogram')
const read = (file) => readFileSync(resolve(root, file), 'utf8')

test('mini program registers the theme page and synchronized settings', () => {
  const config = JSON.parse(read('app.json'))
  const app = read('app.js')
  assert.ok(config.pages.includes('pages/theme/theme'))
  assert.match(app, /fontTheme:\s*'cloud'/)
  assert.match(app, /surfaceOpacity:\s*88/)
  assert.match(app, /skin:\s*\{ enabled: false/)
  assert.match(app, /api\.download\(`\/api\/theme\/skin/)
})

test('theme page exposes font, transparency, skin, and smart crop actions', () => {
  const script = read('pages/theme/theme.js')
  const markup = read('pages/theme/theme.wxml')
  assert.match(script, /\/api\/theme\/analyze/)
  assert.match(script, /api\.putFile\(`\/api\/theme\/skin/)
  assert.match(script, /api\.putFile\(`\/api\/theme\/original/)
  assert.match(markup, /跟随系统字体/)
  assert.match(markup, /跟随当前主题字体/)
  assert.doesNotMatch(markup, /使用微信与手机系统字体/)
  assert.match(markup, /内容透明度/)
  assert.match(markup, /全部前景内容，只有背景图片保持不变/)
  assert.match(read('app.wxss'), /opacity:\s*var\(--content-opacity/)
  assert.match(markup, /上传并智能适配/)
  assert.match(markup, /当前使用/)
  assert.match(markup, /自适应 UI 配色已启用/)
  assert.match(script, /buildAdaptivePalette/)
  assert.match(script, /图片已显示，正在本机快速适配/)
  assert.match(script, /background-size: contain/)
  assert.match(script, /timeout: 7000/)
  assert.match(read('app.js'), /background-size: cover, contain/)
})

test('mini program adaptive palette is complete and exported as page variables', () => {
  const paletteModule = { exports: {} }
  Function('module', 'exports', read('utils/theme-palette.js'))(paletteModule, paletteModule.exports)
  const paletteTools = paletteModule.exports
  const palette = paletteTools.buildAdaptivePalette({ mode: 'dark', primary: '#7b4fd6', secondary: '#d98258', accent: '#4b9dc5' })
  assert.equal(palette.mode, 'dark')
  assert.match(palette.primaryStrong, /^#[0-9a-f]{6}$/)
  assert.match(paletteTools.paletteStyleText(palette), /--mint:/)
  assert.match(paletteTools.paletteOverlay(palette), /^rgba\(/)
  const pixels = new Uint8ClampedArray(100 * 4)
  for (let index = 0; index < 100; index += 1) {
    pixels.set([...(index < 75 ? [248, 249, 246] : index < 95 ? [74, 184, 118] : [25, 80, 220]), 255], index * 4)
  }
  const seed = paletteTools.extractPaletteSeed(pixels)
  assert.equal(seed.mode, 'light')
  assert.equal(seed.primary, '#4ab876')
})

test('mini program admin can preview the archived wallpaper original', () => {
  assert.match(read('pages/admin/admin.js'), /themeOriginal\.url/)
  assert.match(read('pages/admin/admin.wxml'), /用户壁纸原图/)
  assert.match(read('pages/admin/admin.wxml'), /previewWallpaper/)
})

test('every visible mini program surface receives the synchronized theme classes', () => {
  for (const page of ['calendar', 'theme', 'day', 'plans', 'profile', 'login', 'admin', 'privacy', 'terms']) {
    const markup = read(`pages/${page}/${page}.wxml`)
    assert.match(markup, /fontClass/, `${page} missing font theme class`)
    assert.match(markup, /skinStyle/, `${page} missing custom skin style`)
  }
})

test('mini program Agent can confirm and execute theme actions', () => {
  const script = read('pages/calendar/calendar.js')
  const markup = read('pages/calendar/calendar.wxml')
  assert.match(script, /function decorateThemeActions/)
  assert.match(script, /applyPetThemeAction/)
  assert.match(script, /set_surface_opacity/)
  assert.match(script, /open_theme_settings/)
  assert.match(markup, /主题操作/)
  assert.match(markup, /确认执行/)
})

test('pet window controls use real-device safe tap targets and touch coordinates', () => {
  const script = read('pages/calendar/calendar.js')
  const markup = read('pages/calendar/calendar.wxml')
  const styles = read('pages/calendar/calendar.wxss')
  assert.match(markup, /class="pet-close"[^>]*catchtap="closePet"/)
  assert.match(markup, /class="pet-resize-handle"[^>]*catchtouchstart="startBubbleResize"[^>]*catchtouchmove="resizeBubble"/)
  assert.match(markup, /class="pet-resize-handle"[^>]*catchtap="cycleBubbleSize"/)
  assert.match(script, /function petTouchPoint/)
  assert.match(script, /touch\.clientX \?\? touch\.pageX \?\? touch\.x/)
  assert.match(script, /petOpen: false, bubbleResizing: false/)
  assert.match(styles, /\.pet-resize-handle\{[^}]*width:78rpx!important;[^}]*height:78rpx/)
  assert.match(styles, /\.pet-head-action,\.pet-close\{[^}]*width:76rpx!important;[^}]*height:76rpx/)
  assert.match(script, /cycleBubbleSize\(\)/)
  assert.doesNotMatch(read('app.wxss'), /\.calendar-page\s*>\s*view/)
  assert.match(styles, /\.calendar-page\s*>\s*\.pet-bubble\s*\{[^}]*visibility:\s*hidden;[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/)
  assert.match(styles, /\.calendar-page\s*>\s*\.pet-bubble\.is-open\s*\{[^}]*visibility:\s*visible;[^}]*pointer-events:\s*auto;/)
})

test('cloud font files are loaded before full fonts and theme settings survive server sync', () => {
  const app = read('app.js')
  const sync = readFileSync(resolve('functions/api/sync.js'), 'utf8')
  assert.match(app, /xy-rounded-miniprogram\.woff/)
  assert.match(app, /v=2\.3\.9/)
  assert.match(app, /function loadBrandFontPreviews/)
  assert.match(app, /ensureBrandFontPreviews\(force = false\)/)
  assert.match(read('app.wxss'), /font-family:\s*"XY Doodle", "XY Doodle Preview"/)
  assert.match(read('app.wxss'), /\.font-cloud view,/)
  assert.match(read('app.wxss'), /"PingFang SC", sans-serif !important;/)
  assert.match(sync, /fontTheme:\s*value\?\.fontTheme === 'system'/)
  assert.match(sync, /surfaceOpacity:/)
  assert.match(sync, /skin:\s*\{/)
})
