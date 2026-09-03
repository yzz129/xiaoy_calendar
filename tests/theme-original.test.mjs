import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('wallpaper originals are split below the D1 blob limit and protected by admin auth', () => {
  const upload = read('../functions/api/theme/original.js')
  const adminImage = read('../functions/api/admin/theme-original/[id].js')
  const migration = read('../migrations/0004_theme_originals.sql')
  assert.match(upload, /MAX_ORIGINAL_BYTES\s*=\s*15\s*\*\s*1024\s*\*\s*1024/)
  assert.match(upload, /CHUNK_BYTES\s*=\s*1500\s*\*\s*1024/)
  assert.match(adminImage, /authenticate\(env, request, true\)/)
  assert.match(migration, /user_theme_original_chunks/)
})

test('web upload publishes the processed skin before archiving the original in background', () => {
  const dialog = read('../src/components/ThemeDialog.jsx')
  assert.ok(dialog.indexOf('/api/theme/skin?width=') < dialog.indexOf('/api/theme/original'))
  assert.match(dialog, /图片已显示，正在本机快速适配/)
  assert.match(dialog, /onPreviewSkin\?\.\(\{ source: file/)
  assert.match(read('../src/components/AdminApp.jsx'), /用户壁纸原图/)
})

test('removing a custom skin preserves the archived original and admin exposes a wallpaper tab', () => {
  const skinApi = read('../functions/api/theme/skin.js')
  const admin = read('../src/components/AdminApp.jsx')
  const detailApi = read('../functions/api/admin/users/[id].js')
  const deleteHandler = skinApi.slice(skinApi.indexOf('export async function onRequestDelete'))
  assert.doesNotMatch(deleteHandler, /DELETE FROM user_theme_original/)
  assert.match(admin, /\['wallpaper', '用户壁纸', ImageIcon\]/)
  assert.match(admin, /tab === 'wallpaper'/)
  assert.match(detailApi, /theme_original_upload/)
  assert.match(detailApi, /uploadCount:/)
})
