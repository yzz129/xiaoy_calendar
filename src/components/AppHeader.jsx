import { ChevronLeft, ChevronRight, MoonStar, Sun } from 'lucide-react'
import Logo from './Logo'

export default function AppHeader({ month, onPrevious, onNext, onToday, theme, onTheme }) {
  return (
    <header className="app-header">
      <Logo />
      <div className="month-switcher" aria-label="切换月份">
        <button className="icon-button" onClick={onPrevious} aria-label="上个月"><ChevronLeft /></button>
        <h1>{month}</h1>
        <button className="icon-button" onClick={onNext} aria-label="下个月"><ChevronRight /></button>
      </div>
      <div className="header-actions">
        <button className="today-button" onClick={onToday}>今天</button>
        <button className="icon-button" onClick={onTheme} aria-label="切换主题">
          {theme === 'light' ? <MoonStar /> : <Sun />}
        </button>
      </div>
    </header>
  )
}
