import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Android 1.9 uses the latest semantic high-range versionCode for reliable upgrades', () => {
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8')
  assert.match(gradle, /versionCode\s+109005/)
  assert.match(gradle, /versionName\s+"1\.9"/)
})
