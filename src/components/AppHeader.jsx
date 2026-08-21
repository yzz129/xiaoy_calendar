import { ChevronLeft, ChevronRight, ClipboardList, LogOut, MoonStar, ShieldCheck, Sun, UserRound } from 'lucide-react'
import Logo from './Logo'

export default function AppHeader({ month, onPrevious, onNext, onToday, onPlans, activePlanCount, theme, onTheme, user, onProfile, onLogout }) {
  return (
    <header className={`app-header ${user.role === 'admin' ? 'is-admin' : ''}`}>
      <Logo />
      <div className="month-switcher" aria-label="切换月份">
        <button className="icon-button" onClick={onPrevious} aria-label="上个月"><ChevronLeft /></button>
        <h1>{month}</h1>
        <button className="icon-button" onClick={onNext} aria-label="下个月"><ChevronRight /></button>
      </div>
      <div className="header-actions">
        <button className="today-button" onClick={onToday}>今天</button>
        <button className="plan-button" onClick={onPlans} aria-label={`打开规划中心，${activePlanCount}个进行中规划`}>
          <ClipboardList /><span>规划中心</span>{activePlanCount ? <i>{activePlanCount > 9 ? '9+' : activePlanCount}</i> : null}
        </button>
        <button className="icon-button" onClick={onTheme} aria-label="切换主题">
          {theme === 'light' ? <MoonStar /> : <Sun />}
        </button>
        {user.role === 'admin' ? <a className="admin-link-button" href="/admin/" aria-label="进入管理员后台"><ShieldCheck /></a> : null}
        <div className="account-chip"><button className="account-profile-button" onClick={onProfile} aria-label="修改个人资料" title="个人资料"><UserRound /><span>{user.nickname}</span></button><button className="account-logout-button" onClick={onLogout} aria-label="退出登录" title="退出登录"><LogOut /></button></div>
      </div>
    </header>
  )
}
