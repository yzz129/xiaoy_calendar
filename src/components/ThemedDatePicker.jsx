import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { fromKey, getMonthCells, monthLabel, toKey, WEEK_LABELS } from '../date-utils'

function displayDate(value) {
  const date = fromKey(value)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export default function ThemedDatePicker({ label, value, min, max, onChange }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    const current = fromKey(value)
    return new Date(current.getFullYear(), current.getMonth(), 1)
  })
  const cells = useMemo(() => getMonthCells(viewDate), [viewDate])
  const todayKey = toKey(new Date())

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const showPicker = () => {
    const current = fromKey(value)
    setViewDate(new Date(current.getFullYear(), current.getMonth(), 1))
    setOpen((currentOpen) => !currentOpen)
  }

  const selectDate = (key) => {
    onChange(key)
    setOpen(false)
  }

  const changeMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const todayDisabled = todayKey < min || todayKey > max

  return (
    <div className="themed-date-picker" ref={rootRef}>
      <span className="date-field-label">{label}</span>
      <button
        type="button"
        className="date-trigger"
        onClick={showPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays />
        <span>{displayDate(value)}</span>
      </button>

      {open ? (
        <>
          <button type="button" className="date-picker-backdrop" onClick={() => setOpen(false)} aria-label="关闭日期选择" />
          <div className="date-popover" role="dialog" aria-modal="true" aria-label={`${label}日期选择`}>
            <div className="date-popover-heading">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="上个月"><ChevronLeft /></button>
              <strong>{monthLabel(viewDate)}</strong>
              <button type="button" onClick={() => changeMonth(1)} aria-label="下个月"><ChevronRight /></button>
              <button type="button" className="date-popover-close" onClick={() => setOpen(false)} aria-label="关闭"><X /></button>
            </div>
            <div className="date-picker-weekdays">
              {WEEK_LABELS.map((weekday, index) => <span className={index > 4 ? 'weekend' : ''} key={weekday}>{weekday.slice(1)}</span>)}
            </div>
            <div className="date-picker-grid">
              {cells.map((cell) => {
                const disabled = cell.key < min || cell.key > max
                const calendarLabel = cell.meta.eventLabel || cell.meta.lunarLabel
                return (
                  <button
                    type="button"
                    key={cell.key}
                    className={`${cell.isCurrentMonth ? '' : 'outside '}${cell.key === value ? 'selected ' : ''}${cell.key === todayKey ? 'today ' : ''}${cell.meta.eventLabel ? 'has-event ' : ''}`.trim()}
                    disabled={disabled}
                    onClick={() => selectDate(cell.key)}
                    title={`${cell.meta.lunarFullLabel}${cell.meta.events.length ? ` · ${cell.meta.events.join('、')}` : ''}`}
                    aria-label={`${cell.date.getMonth() + 1}月${cell.date.getDate()}日，${cell.meta.lunarFullLabel}${cell.meta.events.length ? `，${cell.meta.events.join('、')}` : ''}`}
                    aria-pressed={cell.key === value}
                  >
                    <b>{cell.date.getDate()}</b>
                    <small>{calendarLabel}</small>
                    {cell.meta.holiday ? <i className={`picker-holiday ${cell.meta.holiday.type}`}>{cell.meta.holiday.type === 'work' ? '班' : '休'}</i> : null}
                  </button>
                )
              })}
            </div>
            <div className="date-popover-footer">
              <span>含农历、节气与法定调休</span>
              <button type="button" disabled={todayDisabled} onClick={() => selectDate(todayKey)}>回到今天</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
