const base = process.env.XY_TEST_ORIGIN || 'http://127.0.0.1:4312'
const suffix = process.env.XY_TEST_SUFFIX || Date.now().toString().slice(-7)
const adminNickname = process.env.XY_TEST_ADMIN || `dualAdmin_${suffix}`
const userNickname = process.env.XY_TEST_USER || `dualUser_${suffix}`
const password = process.env.XY_TEST_PASSWORD || 'dual-session-pass-1'

async function call(path, method = 'GET', body, cookie = '') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, payload, setCookie: response.headers.get('set-cookie') || '' }
}

function cookiePair(setCookie) {
  return setCookie.split(';', 1)[0]
}

if (process.env.XY_TEST_PREPARED !== '1') {
  throw new Error('先创建测试用户、将 XY_TEST_ADMIN 提升为管理员，再以 XY_TEST_PREPARED=1 运行此测试。')
}

const adminLogin = await call('/api/auth/login', 'POST', { nickname: adminNickname, password, scope: 'admin' })
const userLogin = await call('/api/auth/login', 'POST', { nickname: userNickname, password })
const rejectedAdminLogin = await call('/api/auth/login', 'POST', { nickname: userNickname, password, scope: 'admin' })
const adminCookie = cookiePair(adminLogin.setCookie)
const userCookie = cookiePair(userLogin.setCookie)
const bothCookies = `${adminCookie}; ${userCookie}`

const adminSession = await call('/api/auth/session?scope=admin', 'GET', null, bothCookies)
const userSession = await call('/api/auth/session', 'GET', null, bothCookies)
const adminUsers = await call('/api/admin/users', 'GET', null, bothCookies)

const userLogout = await call('/api/auth/logout', 'POST', null, bothCookies)
const adminAfterUserLogout = await call('/api/auth/session?scope=admin', 'GET', null, adminCookie)
const userAfterUserLogout = await call('/api/auth/session', 'GET')

const userLoginAgain = await call('/api/auth/login', 'POST', { nickname: userNickname, password })
const userCookieAgain = cookiePair(userLoginAgain.setCookie)
const adminLogout = await call('/api/auth/logout?scope=admin', 'POST', null, `${adminCookie}; ${userCookieAgain}`)
const userAfterAdminLogout = await call('/api/auth/session', 'GET', null, userCookieAgain)
const adminAfterAdminLogout = await call('/api/auth/session?scope=admin', 'GET')

const actual = {
  adminLogin: adminLogin.status,
  userLogin: userLogin.status,
  rejectedAdminLogin: rejectedAdminLogin.status,
  adminCookie: adminCookie.split('=')[0],
  userCookie: userCookie.split('=')[0],
  adminSession: adminSession.payload.user?.nickname,
  userSession: userSession.payload.user?.nickname,
  adminUsers: adminUsers.status,
  userLogout: userLogout.status,
  adminAfterUserLogout: adminAfterUserLogout.status,
  userAfterUserLogout: userAfterUserLogout.status,
  adminLogout: adminLogout.status,
  userAfterAdminLogout: userAfterAdminLogout.status,
  adminAfterAdminLogout: adminAfterAdminLogout.status,
}
const expected = {
  adminLogin: 200,
  userLogin: 200,
  rejectedAdminLogin: 403,
  adminCookie: 'xy_admin_session',
  userCookie: 'xy_session',
  adminSession: adminNickname,
  userSession: userNickname,
  adminUsers: 200,
  userLogout: 200,
  adminAfterUserLogout: 200,
  userAfterUserLogout: 401,
  adminLogout: 200,
  userAfterAdminLogout: 200,
  adminAfterAdminLogout: 401,
}

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`dual session integration failed: ${JSON.stringify(actual)}`)
}

console.log(JSON.stringify({ ok: true, actual }))
