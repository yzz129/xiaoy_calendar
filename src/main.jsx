import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LoaderCircle, LockKeyhole } from 'lucide-react'
import App from './App'
import { authFetch, login as loginAccount, logout as logoutAccount, register as registerAccount } from './auth'
import LoginScreen from './components/LoginScreen'
import './styles.css'

const AdminApp = lazy(() => import('./components/AdminApp'))

const isNativeApp = window.Capacitor?.isNativePlatform?.() === true
const isAdminRoute = window.location.pathname.startsWith('/admin')
const CACHED_USER_KEY = isAdminRoute ? 'xiaoy-calendar:admin-user:v1' : 'xiaoy-calendar:user:v1'
const SESSION_ENDPOINT = isAdminRoute ? '/api/auth/session?scope=admin' : '/api/auth/session'

function readCachedUser() {
  try { return JSON.parse(localStorage.getItem(CACHED_USER_KEY) || 'null') } catch { return null }
}

function cacheUser(user) {
  if (user) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(CACHED_USER_KEY)
}

if (!isNativeApp && import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 离线缓存注册失败时不影响日历本身使用。
    })
  })
}

function Root() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    authFetch(SESSION_ENDPOINT)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!active) return
        const nextUser = response.ok ? payload.user : null
        cacheUser(nextUser)
        setUser(nextUser)
      })
      .catch(() => {
        // 已登录用户断网时仍可进入自己的本地日历；Agent 会单独提示需要联网。
        if (active) setUser(readCachedUser())
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const handleLogin = async (nickname, password) => {
    const payload = await loginAccount(nickname, password, { admin: isAdminRoute })
    cacheUser(payload.user)
    setUser(payload.user)
  }

  const handleRegister = async (nickname, password) => {
    const payload = await registerAccount(nickname, password)
    cacheUser(payload.user)
    setUser(payload.user)
  }

  const handleLogout = async () => {
    await logoutAccount({ admin: isAdminRoute })
    cacheUser(null)
    setUser(null)
  }

  const handleUserUpdated = (nextUser) => {
    cacheUser(nextUser)
    setUser(nextUser)
  }

  if (loading) return <main className="auth-page"><div className="auth-loading"><LoaderCircle /><span>小Y 正在确认登录状态…</span></div></main>
  if (!user) return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} adminMode={isAdminRoute} />
  if (isAdminRoute) {
    if (user.role !== 'admin') return <main className="auth-page"><section className="auth-card auth-denied"><LockKeyhole /><h1>需要管理员权限</h1><p>当前账号不能进入管理后台。</p><a href="/">返回小Y日历</a></section></main>
    return <Suspense fallback={<main className="auth-page"><div className="auth-loading"><LoaderCircle /><span>正在打开管理员后台…</span></div></main>}><AdminApp currentUser={user} onLogout={handleLogout} /></Suspense>
  }
  return <App key={user.id} user={user} onUserUpdated={handleUserUpdated} onLogout={handleLogout} />
}

createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>)
