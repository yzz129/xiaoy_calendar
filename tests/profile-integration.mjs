const base = process.env.XY_TEST_ORIGIN || 'http://127.0.0.1:4312'
const suffix = Date.now().toString().slice(-7)
const firstNickname = `qaA_${suffix}`
const secondNickname = `qaB_${suffix}`
const renamedNickname = `qaC_${suffix}`
const oldPassword = 'test-pass-1'
const newPassword = 'test-pass-2'

async function call(path, method, body, token) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, payload }
}

const first = await call('/api/auth/register', 'POST', { nickname: firstNickname, password: oldPassword })
const second = await call('/api/auth/register', 'POST', { nickname: secondNickname, password: oldPassword })
if (first.status !== 201 || second.status !== 201) throw new Error(`register ${first.status}/${second.status}`)

const otherSession = await call('/api/auth/login', 'POST', { nickname: firstNickname, password: oldPassword })
const duplicate = await call('/api/account/profile', 'PATCH', { nickname: secondNickname, currentPassword: '', newPassword: '' }, first.payload.token)
const renamed = await call('/api/account/profile', 'PATCH', { nickname: renamedNickname, currentPassword: '', newPassword: '' }, first.payload.token)
const wrongCurrent = await call('/api/account/profile', 'PATCH', { nickname: renamedNickname, currentPassword: 'wrong-password', newPassword }, first.payload.token)
const passwordChanged = await call('/api/account/profile', 'PATCH', { nickname: renamedNickname, currentPassword: oldPassword, newPassword }, first.payload.token)
const oldPasswordLogin = await call('/api/auth/login', 'POST', { nickname: renamedNickname, password: oldPassword })
const newPasswordLogin = await call('/api/auth/login', 'POST', { nickname: renamedNickname, password: newPassword })
const revokedSession = await call('/api/account/profile', 'GET', null, otherSession.payload.token)
const currentSession = await call('/api/account/profile', 'GET', null, first.payload.token)

const actual = {
  duplicate: duplicate.status,
  renamed: renamed.status,
  wrongCurrent: wrongCurrent.status,
  passwordChanged: passwordChanged.status,
  oldPasswordLogin: oldPasswordLogin.status,
  newPasswordLogin: newPasswordLogin.status,
  revokedSession: revokedSession.status,
  currentSession: currentSession.status,
}
const expected = {
  duplicate: 409,
  renamed: 200,
  wrongCurrent: 400,
  passwordChanged: 200,
  oldPasswordLogin: 401,
  newPasswordLogin: 200,
  revokedSession: 401,
  currentSession: 200,
}

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`profile integration failed: ${JSON.stringify(actual)}`)
}

console.log(JSON.stringify({ ok: true, actual, testNicknames: [secondNickname, renamedNickname] }))
