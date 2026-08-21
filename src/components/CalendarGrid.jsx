import { memo } from 'react'
import { BookOpenCheck, BriefcaseBusiness, StickyNote } from 'lucide-react'
import { WEEK_LABELS } from '../date-utils'

const STATUS_LABELS = { work: '工作日', rest: '休息日', leave: '请假' }
const EMPTY_ITEMS = []

const CalendarCell = memo(function CalendarCell({ cell, entry, notes, planTasks, selected, today, onSelect }) {
  const hasNote = notes.some((item) => item.text?.trim())
  const planSummary = planTasks.reduce((summary, task) => {
    summary[task.type] += 1
    if (!task.done) summary.pending += 1
    if (task.type === 'study' && !task.done) summary.studyDone = false
    if (task.type === 'work' && !task.done) summary.workDone = false
    return summary
  }, { study: 0, work: 0, pending: 0, studyDone: true, workDone: true })
  const calendarLabel = cell.meta.eventLabel || cell.meta.lunarLabel
  const calendarDetails = [
    cell.meta.lunarFullLabel,
    ...cell.meta.events,
    cell.meta.holiday ? `${cell.meta.holiday.name}${cell.meta.holiday.type === 'work' ? '调休上班' : '放假'}` : '',
  ].filter(Boolean)
  return (
    <button
      className={`calendar-cell${cell.isCurrentMonth ? '' : ' outside'}${cell.isWeekend ? ' weekend' : ''}${selected ? ' selected' : ''}${cell.meta.holiday ? ' has-official-holiday' : ''}`}
      onClick={() => onSelect(cell.date)}
      aria-label={`${cell.date.getMonth() + 1}月${cell.date.getDate()}日，${calendarDetails.join('，')}${entry?.status ? `，${STATUS_LABELS[entry.status]}` : ''}${planTasks.length ? `，${planTasks.length}项规划任务，${planSummary.pending}项待完成` : ''}${hasNote ? '，有便签' : ''}`}
      aria-pressed={selected}
    >
      <span className={`day-number${today ? ' is-today' : ''}`}>{cell.date.getDate()}</span>
      {entry?.status ? <span className={`status-dot ${entry.status}`} title={STATUS_LABELS[entry.status]} /> : null}
      {cell.meta.holiday ? (
        <span className={`official-holiday ${cell.meta.holiday.type}`} title={`${cell.meta.holiday.name}${cell.meta.holiday.type === 'work' ? '调休上班' : '放假'}`}>
          {cell.meta.holiday.type === 'work' ? '班' : '休'}
        </span>
      ) : null}
      <span className={`lunar-label${cell.meta.eventLabel ? ' event' : ''}`} title={calendarDetails.join(' · ')}>{calendarLabel}</span>
      {planTasks.length ? (
        <span className="plan-markers" title={`${planTasks.length}项规划任务，${planSummary.pending}项待完成`} aria-hidden="true">
          {planSummary.study ? <i className={planSummary.studyDone ? 'study done' : 'study'}><BookOpenCheck /></i> : null}
          {planSummary.work ? <i className={planSummary.workDone ? 'work done' : 'work'}><BriefcaseBusiness /></i> : null}
          {planTasks.length > 1 ? <b>{planTasks.length}</b> : null}
        </span>
      ) : null}
      {hasNote ? <span className="note-marker" title="有便签" aria-hidden="true"><StickyNote /></span> : null}
    </button>
  )
})

export default function CalendarGrid({ cells, entries, notes, planTasksByDate, selectedKey, todayKey, onSelect }) {
  return (
    <section className="calendar-shell" aria-label="月历">
      <div className="weekday-row">
        {WEEK_LABELS.map((label, index) => <span className={index > 4 ? 'weekend-label' : ''} key={label}>{label}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((cell) => (
          <CalendarCell
            key={cell.key}
            cell={cell}
            entry={entries[cell.key]}
            notes={notes[cell.key] || EMPTY_ITEMS}
            planTasks={planTasksByDate[cell.key] || EMPTY_ITEMS}
            selected={cell.key === selectedKey}
            today={cell.key === todayKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
