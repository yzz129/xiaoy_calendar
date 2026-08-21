import { useEffect, useRef, useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, Save, UserRound, X } from 'lucide-react'
import { authFetch } from '../auth'

export default function ProfileDialog({ user, onClose, onUpdated, initialSection = 'nickname' }) {
  const [nickname, setNickname] = useState(user.nickname)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const nicknameRef = useRef(null)
  const currentPasswordRef = useRef(null)

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      if (initialSection === 'password') currentPasswordRef.current?.focus()
      else nicknameRef.current?.focus()
    }, 40)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [initialSection, onClose])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    const cleanNickname = nickname.trim()
    if (newPassword && newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    setSaving(true)
    try {
      const response = await authFetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: cleanNickname, currentPassword, newPassword }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '保存失败')
      onUpdated(payload.user)
      setNickname(payload.user.nickname)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSaved(true)
    } catch (reason) {
      setError(reason?.message || '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <form className="profile-card" onSubmit={submit}>
        <header className="profile-card-header">
          <span className="profile-card-icon"><UserRound /></span>
          <span><small>账号设置</small><strong id="profile-title">个人资料</strong></span>
          <button type="button" onClick={onClose} aria-label="关闭个人资料"><X /></button>
        </header>

        <section className="profile-section">
          <label htmlFor="profile-nickname"><span><UserRound />昵称</span></label>
          <input ref={nicknameRef} id="profile-nickname" value={nickname} maxLength="20" autoComplete="nickname" onChange={(event) => setNickname(event.target.value)} required />
          <small>2—20 个中英文、数字、下划线或短横线；昵称不可与其他用户重复。</small>
        </section>

        <section className="profile-section profile-password-section">
          <div className="profile-section-heading"><span><KeyRound />修改密码</span><small>不修改可留空</small></div>
          <label htmlFor="profile-current-password">当前密码</label>
          <div className="profile-password-input">
            <input ref={currentPasswordRef} id="profile-current-password" type={showPasswords ? 'text' : 'password'} value={currentPassword} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} placeholder="修改密码时填写" />
            <button type="button" onClick={() => setShowPasswords((current) => !current)} aria-label={showPasswords ? '隐藏密码' : '显示密码'}>{showPasswords ? <EyeOff /> : <Eye />}</button>
          </div>
          <div className="profile-password-grid">
            <label><span>新密码</span><input type={showPasswords ? 'text' : 'password'} value={newPassword} minLength="6" maxLength="72" autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} placeholder="至少 6 位" /></label>
            <label><span>确认新密码</span><input type={showPasswords ? 'text' : 'password'} value={confirmPassword} minLength="6" maxLength="72" autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入" /></label>
          </div>
          <small>修改密码后，当前设备会保持登录，其他设备需要重新登录。</small>
        </section>

        {error ? <p className="profile-message error" role="alert">{error}</p> : null}
        {saved ? <p className="profile-message success" role="status"><Check />资料已保存</p> : null}

        <footer className="profile-actions">
          <button type="button" className="profile-cancel" onClick={onClose}>取消</button>
          <button type="submit" className="profile-save" disabled={saving || !nickname.trim()}><Save />{saving ? '保存中…' : '保存修改'}</button>
        </footer>
      </form>
    </div>
  )
}
