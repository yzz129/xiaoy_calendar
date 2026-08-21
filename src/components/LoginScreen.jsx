import { useState } from 'react'
import { Download, Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck, Sparkles, UserPlus, UserRound } from 'lucide-react'
import { APK_DOWNLOAD_PAGE_URL, isNativeApp } from '../app-links'
import mascot from '../assets/illustrations/agent-focused.png'
import Logo from './Logo'

export default function LoginScreen({ onLogin, onRegister, adminMode = false }) {
  const [mode, setMode] = useState('login')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'register' && !adminMode) await onRegister(nickname, password)
      else await onLogin(nickname, password)
    } catch (submitError) {
      setError(submitError.message || (mode === 'register' ? '注册失败' : '登录失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><Logo /><span><Sparkles /> 你的日历与规划搭子</span></div>
        <div className="auth-hero">
          <span className="auth-mascot"><img src={mascot} alt="" /></span>
          <div><p>{adminMode ? '管理员入口' : mode === 'register' ? '第一次见面' : '欢迎回来'}</p><h1 id="auth-title">{adminMode ? '登录管理后台' : mode === 'register' ? '注册小Y日历' : '登录小Y日历'}</h1><small>{adminMode ? '仅管理员账号可进入，普通用户请返回日历登录页。' : mode === 'register' ? '填写昵称和密码创建账号，注册成功后会自动登录。' : '使用已经注册的昵称和密码登录，以后打开可自动登录。'}</small></div>
        </div>
        {!adminMode ? <div className="auth-mode-tabs" role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}><LogIn />登录</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}><UserPlus />注册</button>
        </div> : null}
        <form className="auth-form" onSubmit={submit}>
          <label><span><UserRound />昵称</span><input value={nickname} onChange={(event) => setNickname(event.target.value.slice(0, 20))} autoComplete="username" placeholder="2—20 个中英文或数字" required /></label>
          <label><span><LockKeyhole />密码</span><div className="auth-password"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value.slice(0, 72))} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="至少 6 位" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button className="auth-submit" type="submit" disabled={busy || nickname.trim().length < 2 || password.length < 6}>{mode === 'register' && !adminMode ? <UserPlus /> : <LogIn />}{busy ? (mode === 'register' ? '正在注册…' : '正在登录…') : (mode === 'register' && !adminMode ? '注册并进入日历' : '登录')}</button>
        </form>
        {adminMode ? <a className="auth-user-entry" href="/">返回普通用户登录 / 注册</a> : null}
        {!adminMode && !isNativeApp() ? <a className="auth-download" href={APK_DOWNLOAD_PAGE_URL}><Download /><span><strong>下载 Android APP</strong><small>进入下载页，获取并安装最新版</small></span></a> : null}
        <div className="auth-note"><ShieldCheck /><span><strong>安全说明</strong><small>密码仅以不可逆哈希保存；账号资料以云端数据为准，可在多个设备登录并自动同步。</small></span></div>
        <a className="auth-privacy" href="/privacy/">隐私政策</a>
      </section>
    </main>
  )
}
