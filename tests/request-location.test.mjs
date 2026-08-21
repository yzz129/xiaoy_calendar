import assert from 'node:assert/strict'
import test from 'node:test'
import { requestLocation } from '../server/auth.js'

test('requestLocation formats Cloudflare city metadata', () => {
  assert.equal(
    requestLocation({ cf: { city: '深圳市', region: '广东省', country: 'CN' } }),
    '深圳市 · 广东省 · CN',
  )
  assert.equal(
    requestLocation({ cf: { city: 'Shanghai', region: 'Shanghai', country: 'CN' } }),
    'Shanghai · CN',
  )
  assert.equal(
    requestLocation({ cf: {}, headers: new Headers({ 'CF-IPCountry': 'CN' }) }),
    'CN',
  )
  assert.equal(requestLocation({ cf: {} }), '')
  assert.equal(requestLocation({}), '')
})
