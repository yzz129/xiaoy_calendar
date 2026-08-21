import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { BookOpenCheck, ChevronUp } from 'lucide-react'
import AppHeader from './components/AppHeader'
import CalendarGrid from './components/CalendarGrid'
import DayPlanner from './components/DayPlanner'
import RangeSummary from './components/RangeSummary'
import SummaryStrip from './components/SummaryStrip'
import { dateLabel, fromKey, getMonthCells, getRangeStats, isSameMonth, monthLabel, toKey } from './date-utils'
import { getActivePlanCount, getPlanProgress, getPlanTasksForDate } from './plan-utils'
import { useCalendarStore } from './useCalendarStore'
import { authFetch } from './auth'

const STATUS_LABELS = { work: '工作日', rest: '休息日', leave: '请假' }
const PRIVACY_ACCEPTED_KEY = 'xiaoy-calendar-privacy-accepted-v2'
const AGENT_VISIBLE_KEY = 'xiaoy-calendar-agent-visible:v1'
const PlanCenter = lazy(() => import('./components/PlanCenter'))
const AgentPet = lazy(() => import('./components/AgentPet'))
const ProfileDialog = lazy(() => import('./components/ProfileDialog'))

function getMonthRange(date) {
  return {
    start: toKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: toKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  }
}

export default function App({ user, onUserUpdated, onLogout }) {
  const [today] = useState(() => new Date())
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [planCenterOpen, setPlanCenterOpen] = useState(false)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileSection, setProfileSection] = useState('nickname')
  const [rangeStart, setRangeStart] = useState(() => getMonthRange(today).start)
  const [rangeEnd, setRangeEnd] = useState(() => getMonthRange(today).end)
  const [privacyAccepted, setPrivacyAccepted] = useState(
    () => window.localStorage.getItem(PRIVACY_ACCEPTED_KEY) === 'true',
  )
  const [agentVisible, setAgentVisible] = useState(
    () => window.localStorage.getItem(AGENT_VISIBLE_KEY) !== 'false',
  )
  const {
    store,
    updateEntry,
    updateEntriesRange,
    addNote,
    createNote,
    updateNote,
    removeNote,
    createPlan,
    createPlans,
    updatePlan,
    removePlan,
    togglePlanTask,
    setPlanTaskDone,
    updatePlanTask,
    addPlanTask,
    removePlanTask,
    resetPlanTask,
    movePlanTask,
    toggleTheme,
  } = useCalendarStore(user.id)
  const todayKey = toKey(today)
  const selectedKey = toKey(selectedDate)

  const cells = useMemo(() => getMonthCells(viewDate), [viewDate])
  const stats = useMemo(() => {
    let completed = 0
    let leave = 0
    let duration = 0
    Object.entries(store.entries).forEach(([key, entry]) => {
      if (entry.status === 'work') duration += entry.duration || 0
      if (!isSameMonth(key, viewDate)) return
      if (entry.status === 'work') {
        completed += 1
      }
      if (entry.status === 'leave') leave += 1
    })
    return { completed, leave, duration }
  }, [store.entries, viewDate])

  const rangeStats = useMemo(
    () => getRangeStats(store.entries, rangeStart, rangeEnd),
    [store.entries, rangeStart, rangeEnd],
  )
  const planTasksByDate = useMemo(
    () => Object.fromEntries(cells.map((cell) => [
      cell.key,
      getPlanTasksForDate(store.plans, store.planProgress, store.planTaskOverrides, cell.key),
    ])),
    [cells, store.plans, store.planProgress, store.planTaskOverrides],
  )
  const selectedPlanTasks = useMemo(
    () => getPlanTasksForDate(
      store.plans,
      store.planProgress,
      store.planTaskOverrides,
      selectedKey,
      { includeSkipped: true },
    ),
    [store.plans, store.planProgress, store.planTaskOverrides, selectedKey],
  )
  const activePlanCount = useMemo(
    () => getActivePlanCount(store.plans, store.planProgress, store.planTaskOverrides),
    [store.plans, store.planProgress, store.planTaskOverrides],
  )
  const agentCalendarContext = useMemo(() => {
    const recentAvailability = cells.map((cell) => {
      const date = cell.date
      const key = cell.key
      const entry = store.entries[key]
      return {
        date: key,
        weekday: date.getDay(),
        status: entry?.status || '',
        duration: Number(entry?.duration || 0),
        notes: (store.notes[key] || []).map(({ id, text, done }) => ({ id, text, done })).slice(0, 8),
        plannedTasks: getPlanTasksForDate(store.plans, store.planProgress, store.planTaskOverrides, key, { includeSkipped: true })
          .map(({ planId, taskId, progressKey, title, done, skipped }) => ({ planId, taskId, progressKey, title, done, skipped }))
          .slice(0, 8),
      }
    })
    return {
      today: todayKey,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      month: monthLabel(viewDate),
      selectedDate: selectedKey,
      nickname: user.nickname,
      theme: store.theme,
      stats,
      recentAvailability,
      plans: store.plans.map((plan) => ({
        ...plan,
        progress: getPlanProgress(plan, store.planProgress, store.planTaskOverrides),
      })).slice(0, 20),
    }
  }, [cells, selectedKey, stats, store.entries, store.notes, store.planProgress, store.planTaskOverrides, store.plans, store.theme, todayKey, user.nickname, viewDate])

  const changeMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  const selectDate = useCallback((date) => {
    setSelectedDate(date)
    if (date.getMonth() !== viewDate.getMonth() || date.getFullYear() !== viewDate.getFullYear()) {
      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }, [viewDate])

  const changeRangeStart = (value) => {
    if (!value) return
    setRangeStart(value)
    if (value > rangeEnd) setRangeEnd(value)
  }

  const changeRangeEnd = (value) => {
    if (!value) return
    setRangeEnd(value)
    if (value < rangeStart) setRangeStart(value)
  }

  const resetRangeToMonth = () => {
    const range = getMonthRange(viewDate)
    setRangeStart(range.start)
    setRangeEnd(range.end)
  }

  const setDuration = (duration) => updateEntry(selectedKey, { duration, status: 'work' })
  const selectedEntry = store.entries[selectedKey]
  const selectedStatus = STATUS_LABELS[selectedEntry?.status] || '待设置'
  const selectedNotes = store.notes[selectedKey] || []
  const selectedCell = cells.find((cell) => cell.key === selectedKey)
  const selectedFestival = [...new Set([
    ...(selectedCell?.meta.events || []),
    selectedCell?.meta.holiday?.name,
  ].filter(Boolean))].join(' · ')
  const pendingSelectedPlans = selectedPlanTasks.filter((task) => !task.done && !task.skipped).length

  const acceptPrivacy = () => {
    window.localStorage.setItem(PRIVACY_ACCEPTED_KEY, 'true')
    setPrivacyAccepted(true)
  }

  const hideAgent = () => {
    window.localStorage.setItem(AGENT_VISIBLE_KEY, 'false')
    setAgentVisible(false)
  }

  const showAgent = () => {
    window.localStorage.setItem(AGENT_VISIBLE_KEY, 'true')
    setAgentVisible(true)
  }

  const openPlanCenter = () => {
    setPlannerOpen(false)
    setPlanCenterOpen(true)
  }

  const executeAgentAction = useCallback(async (action) => {
    const parseActionDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('日期格式不正确')
      return fromKey(value)
    }
    switch (action.kind) {
      case 'set_day_status':
        updateEntry(action.date, { status: action.status, duration: action.status === 'work' ? action.duration : 0 })
        return `${action.date} 已设为${STATUS_LABELS[action.status] || '指定状态'}`
      case 'set_date_range_status': {
        const count = updateEntriesRange(
          action.startDate,
          action.endDate,
          { status: action.status, duration: action.status === 'work' ? action.duration : 0 },
          action.weekdays,
        )
        return `${action.startDate} 至 ${action.endDate} 已批量设为${STATUS_LABELS[action.status] || '指定状态'}（${count} 天）`
      }
      case 'add_note':
        createNote(action.date, action.text)
        return `${action.date} 的便签已记录`
      case 'update_note':
        updateNote(action.date, action.noteId, {
          ...(action.text !== undefined ? { text: action.text } : {}),
          ...(action.done !== undefined ? { done: action.done } : {}),
        })
        return '便签已更新'
      case 'delete_note':
        removeNote(action.date, action.noteId)
        return '便签已删除'
      case 'add_plan_task':
        addPlanTask(action.planId, action.date, action.title)
        return `${action.date} 已新增每日任务`
      case 'update_plan_task':
        updatePlanTask(action.planId, action.date, action.taskId, { title: action.title })
        return '每日任务已调整'
      case 'set_plan_task_done':
        setPlanTaskDone(action.planId, action.progressKey, action.done)
        return action.done ? '任务已标记完成' : '任务已恢复为待办'
      case 'move_plan_task':
        movePlanTask(action.planId, action.fromDate, action.toDate, action.taskId)
        return `任务已移动到 ${action.toDate}`
      case 'delete_plan_task':
        removePlanTask(action.planId, action.date, action.taskId)
        return '每日任务已移除'
      case 'update_plan':
        updatePlan(action.planId, action.patch)
        return '总规划已更新'
      case 'delete_plan':
        removePlan(action.planId)
        return '规划已删除'
      case 'change_nickname': {
        const response = await authFetch('/api/account/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: action.nickname, currentPassword: '', newPassword: '' }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || '昵称修改失败')
        onUserUpdated(payload.user)
        return `昵称已改为 ${payload.user.nickname}`
      }
      case 'open_profile':
        setProfileSection(action.section === 'password' ? 'password' : 'nickname')
        setProfileOpen(true)
        return action.section === 'password' ? '已打开安全的密码修改表单' : '已打开个人资料'
      case 'open_date':
        selectDate(parseActionDate(action.date))
        setPlannerOpen(true)
        return `已打开 ${action.date}`
      case 'jump_to_date': {
        const target = parseActionDate(action.date)
        selectDate(target)
        setPlannerOpen(false)
        setPlanCenterOpen(false)
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          document.querySelector('.calendar-shell')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }))
        return `已翻到 ${action.date} 所在月份并选中日期`
      }
      case 'open_plans':
        setPlannerOpen(false)
        setPlanCenterOpen(true)
        return '已打开规划中心'
      case 'open_range':
        setRangeOpen(true)
        return '已展开工期统计'
      case 'go_today':
        setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
        setSelectedDate(today)
        return '已回到今天'
      case 'change_month':
        setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + action.offset, 1))
        return `已切换 ${Math.abs(action.offset)} 个月`
      case 'toggle_theme':
        toggleTheme()
        return '主题已切换'
      default:
        throw new Error('这个操作当前不受支持')
    }
  }, [addPlanTask, createNote, movePlanTask, onUserUpdated, removeNote, removePlan, removePlanTask, selectDate, setPlanTaskDone, today, toggleTheme, updateEntriesRange, updateEntry, updateNote, updatePlan, updatePlanTask])

  return (
    <div className="app" data-theme={store.theme}>
      <div className="app-frame">
        <AppHeader
          month={monthLabel(viewDate)}
          onPrevious={() => changeMonth(-1)}
          onNext={() => changeMonth(1)}
          onToday={goToday}
          onPlans={openPlanCenter}
          activePlanCount={activePlanCount}
          theme={store.theme}
          onTheme={toggleTheme}
          user={user}
          onProfile={() => { setProfileSection('nickname'); setProfileOpen(true) }}
          onLogout={onLogout}
        />
        <SummaryStrip stats={stats} />
        <RangeSummary
          start={rangeStart}
          end={rangeEnd}
          stats={rangeStats}
          open={rangeOpen}
          onToggle={() => setRangeOpen((current) => !current)}
          onStart={changeRangeStart}
          onEnd={changeRangeEnd}
          onCurrentMonth={resetRangeToMonth}
        />
        <main className="workspace">
          <CalendarGrid
            cells={cells}
            entries={store.entries}
            notes={store.notes}
            planTasksByDate={planTasksByDate}
            selectedKey={selectedKey}
            todayKey={todayKey}
            onSelect={selectDate}
          />
          <div className="mobile-day-dock">
            <button onClick={() => setPlannerOpen(true)} aria-expanded={plannerOpen}>
              <span>
                <strong>{dateLabel(selectedDate, todayKey)}</strong>
                <small>
                  {selectedEntry?.status ? <i className={`status-dot ${selectedEntry.status}`} /> : null}{selectedStatus}
                  {selectedPlanTasks.some((task) => !task.skipped) ? <span className="dock-plan-count"><BookOpenCheck />{pendingSelectedPlans}项待办</span> : null}
                  {selectedNotes.length ? <span className="dock-note-count">{selectedNotes.length}条便签</span> : null}
                </small>
                {selectedFestival ? <em className="dock-festival">{selectedFestival}</em> : null}
              </span>
              <span className="dock-action">查看详情 <ChevronUp /></span>
            </button>
          </div>
          {plannerOpen ? <button className="planner-backdrop" onClick={() => setPlannerOpen(false)} aria-label="关闭日期编辑" /> : null}
          <DayPlanner
            key={selectedKey}
            label={dateLabel(selectedDate, todayKey)}
            entry={selectedEntry}
            notes={selectedNotes}
            planTasks={selectedPlanTasks}
            plans={store.plans}
            dateKey={selectedKey}
            open={plannerOpen}
            onClose={() => setPlannerOpen(false)}
            onStatus={(status) => updateEntry(selectedKey, { status, duration: status === 'work' ? (store.entries[selectedKey]?.duration || 1) : 0 })}
            onDuration={setDuration}
            onOpenPlans={openPlanCenter}
            onTogglePlanTask={togglePlanTask}
            onUpdatePlanTask={updatePlanTask}
            onAddPlanTask={addPlanTask}
            onRemovePlanTask={removePlanTask}
            onResetPlanTask={resetPlanTask}
            onMovePlanTask={movePlanTask}
            onAddNote={() => addNote(selectedKey)}
            onUpdateNote={(noteId, patch) => updateNote(selectedKey, noteId, patch)}
            onRemoveNote={(noteId) => removeNote(selectedKey, noteId)}
          />
        </main>
      </div>
      {planCenterOpen ? (
        <Suspense fallback={null}>
          <PlanCenter
            open
            todayKey={todayKey}
            plans={store.plans}
            planProgress={store.planProgress}
            planTaskOverrides={store.planTaskOverrides}
            onClose={() => setPlanCenterOpen(false)}
            onCreate={createPlan}
            onUpdate={updatePlan}
            onRemove={removePlan}
          />
        </Suspense>
      ) : null}
      {profileOpen ? (
        <Suspense fallback={null}>
          <ProfileDialog user={user} initialSection={profileSection} onClose={() => setProfileOpen(false)} onUpdated={onUserUpdated} />
        </Suspense>
      ) : null}
      {privacyAccepted ? (
        <Suspense fallback={null}>
          <AgentPet
            calendarContext={agentCalendarContext}
            onApplyPlans={createPlans}
            onExecuteAction={executeAgentAction}
            hidden={!agentVisible}
            onHide={hideAgent}
            onShow={showAgent}
            userId={user.id}
          />
        </Suspense>
      ) : null}
      {!privacyAccepted ? (
        <div className="privacy-gate" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
          <section className="privacy-card">
            <span className="privacy-icon" aria-hidden="true"><BookOpenCheck /></span>
            <div>
              <p className="privacy-eyebrow">快速上手</p>
              <h2 id="privacy-title">欢迎使用小Y日历</h2>
              <ul className="quick-start-list">
                <li>点击日期，记录工作、休息、请假、工期和便签。</li>
                <li>打开规划中心，安排学习或工作计划并调整每日任务。</li>
                <li>点击小Y Agent，说出目标和时间，它会帮你制定方案。</li>
              </ul>
            </div>
            <div className="privacy-actions">
              <button type="button" onClick={acceptPrivacy}>开始使用</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
