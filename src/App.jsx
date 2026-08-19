import { useMemo, useState } from 'react'
import { ChevronUp, Cloudy, HardDrive, ShieldCheck } from 'lucide-react'
import AppHeader from './components/AppHeader'
import CalendarGrid from './components/CalendarGrid'
import DayPlanner from './components/DayPlanner'
import SummaryStrip from './components/SummaryStrip'
import { dateLabel, getMonthCells, isSameMonth, monthLabel, toKey } from './date-utils'
import { useCalendarStore } from './useCalendarStore'

const STATUS_LABELS = { work: '工作日', rest: '休息日', leave: '请假' }
const PRIVACY_ACCEPTED_KEY = 'xiaoy-calendar-privacy-accepted-v1'

export default function App() {
  const [today] = useState(() => new Date())
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(
    () => window.localStorage.getItem(PRIVACY_ACCEPTED_KEY) === 'true',
  )
  const { store, updateEntry, addNote, updateNote, removeNote, toggleTheme } = useCalendarStore()
  const todayKey = toKey(today)
  const selectedKey = toKey(selectedDate)

  const cells = useMemo(() => getMonthCells(viewDate), [viewDate])
  const stats = useMemo(() => {
    let completed = 0
    let leave = 0
    let duration = 0
    Object.entries(store.entries).forEach(([key, entry]) => {
      if (!isSameMonth(key, viewDate)) return
      if (entry.status === 'work') {
        completed += 1
        duration += entry.duration || 0
      }
      if (entry.status === 'leave') leave += 1
    })
    return { completed, leave, duration }
  }, [store.entries, viewDate])

  const changeMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  const selectDate = (date) => {
    setSelectedDate(date)
    setPlannerOpen(true)
    if (date.getMonth() !== viewDate.getMonth() || date.getFullYear() !== viewDate.getFullYear()) {
      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  const setDuration = (duration) => updateEntry(selectedKey, { duration, status: 'work' })
  const selectedEntry = store.entries[selectedKey]
  const selectedStatus = STATUS_LABELS[selectedEntry?.status] || '未设置状态'

  const acceptPrivacy = () => {
    window.localStorage.setItem(PRIVACY_ACCEPTED_KEY, 'true')
    setPrivacyAccepted(true)
  }

  return (
    <div className="app" data-theme={store.theme}>
      <div className="app-frame">
        <AppHeader
          month={monthLabel(viewDate)}
          onPrevious={() => changeMonth(-1)}
          onNext={() => changeMonth(1)}
          onToday={goToday}
          theme={store.theme}
          onTheme={toggleTheme}
        />
        <SummaryStrip stats={stats} />
        <main className="workspace">
          <CalendarGrid
            cells={cells}
            entries={store.entries}
            notes={store.notes}
            selectedKey={selectedKey}
            todayKey={todayKey}
            onSelect={selectDate}
          />
          <div className="mobile-day-dock">
            <button onClick={() => setPlannerOpen(true)} aria-expanded={plannerOpen}>
              <span>
                <strong>{dateLabel(selectedDate, todayKey)}</strong>
                <small>{selectedEntry?.status ? <i className={`status-dot ${selectedEntry.status}`} /> : null}{selectedStatus}</small>
              </span>
              <span className="dock-action">编辑 <ChevronUp /></span>
            </button>
          </div>
          {plannerOpen ? <button className="planner-backdrop" onClick={() => setPlannerOpen(false)} aria-label="关闭日期编辑" /> : null}
          <DayPlanner
            label={dateLabel(selectedDate, todayKey)}
            entry={selectedEntry}
            notes={store.notes[selectedKey] || []}
            open={plannerOpen}
            onClose={() => setPlannerOpen(false)}
            onStatus={(status) => updateEntry(selectedKey, { status, duration: status === 'work' ? (store.entries[selectedKey]?.duration || 1) : 0 })}
            onDuration={setDuration}
            onAddNote={() => addNote(selectedKey)}
            onUpdateNote={(noteId, patch) => updateNote(selectedKey, noteId, patch)}
            onRemoveNote={(noteId) => removeNote(selectedKey, noteId)}
          />
        </main>
        <footer className="app-footer">
          {store.theme === 'light' ? <HardDrive /> : <Cloudy />}
          <span>数据保存在本机</span>
          <span aria-hidden="true">·</span>
          <a href="/privacy/">隐私政策</a>
        </footer>
      </div>
      {!privacyAccepted ? (
        <div className="privacy-gate" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
          <section className="privacy-card">
            <span className="privacy-icon" aria-hidden="true"><ShieldCheck /></span>
            <div>
              <p className="privacy-eyebrow">首次使用说明</p>
              <h2 id="privacy-title">你的日历，只留在你的设备里</h2>
              <p>小Y日历不要求登录，不收集或上传个人信息。工作状态、工期和便签仅保存在当前设备本地。</p>
            </div>
            <div className="privacy-actions">
              <a href="/privacy/">查看隐私政策</a>
              <button type="button" onClick={acceptPrivacy}>同意并进入</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
