import { memo } from 'react'
import { WEEK_LABELS } from '../date-utils'

const STATUS_LABELS = { work: '工作日', rest: '休息日', leave: '请假' }

const CalendarCell = memo(function CalendarCell({ cell, entry, note, selected, today, onSelect }) {
  return (
    <button
      className={`calendar-cell${cell.isCurrentMonth ? '' : ' outside'}${cell.isWeekend ? ' weekend' : ''}${selected ? ' selected' : ''}`}
      onClick={() => onSelect(cell.date)}
      aria-label={`${cell.date.getMonth() + 1}月${cell.date.getDate()}日${entry?.status ? `，${STATUS_LABELS[entry.status]}` : ''}`}
      aria-pressed={selected}
    >
      <span className={`day-number${today ? ' is-today' : ''}`}>{cell.date.getDate()}</span>
      {entry?.status ? <span className={`status-dot ${entry.status}`} title={STATUS_LABELS[entry.status]} /> : null}
      {note ? <span className="cell-note">{note.done ? '✓ ' : ''}{note.text || '新便签'}</span> : null}
    </button>
  )
})

export default function CalendarGrid({ cells, entries, notes, selectedKey, todayKey, onSelect }) {
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
            note={(notes[cell.key] || [])[0]}
            selected={cell.key === selectedKey}
            today={cell.key === todayKey}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="legend" aria-label="状态图例">
        <span><i className="status-dot work" />工作日</span>
        <span><i className="status-dot rest" />休息日</span>
        <span><i className="status-dot leave" />请假</span>
      </div>
    </section>
  )
}
