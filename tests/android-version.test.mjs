import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Android 2.0 uses the latest semantic high-range versionCode for reliable upgrades', () => {
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8')
  assert.match(gradle, /versionCode\s+200000/)
  assert.match(gradle, /versionName\s+"2\.0"/)
})
