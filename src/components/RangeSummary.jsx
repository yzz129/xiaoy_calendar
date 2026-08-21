import { CalendarRange, ChevronDown, RotateCcw } from 'lucide-react'
import ThemedDatePicker from './ThemedDatePicker'

function displayDuration(value) {
  return Number.isInteger(value) ? value : value.toFixed(1)
}

export default function RangeSummary({ start, end, stats, open, onToggle, onStart, onEnd, onCurrentMonth }) {
  return (
    <section className={`range-summary${open ? ' is-open' : ''}`} aria-label="时间段工期统计">
      <button type="button" className="range-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="range-heading">
          <span className="range-icon" aria-hidden="true"><CalendarRange /></span>
          <span>
            <strong>工期统计</strong>
            <small>{open ? '选择起止日期查看合计' : '按时间段查看总工期'}</small>
          </span>
        </span>
        <span className="range-compact-result"><strong>{displayDuration(stats.duration)}</strong> 天</span>
        <ChevronDown className="range-chevron" />
      </button>

      {open ? (
        <div className="range-details">
          <div className="range-fields">
            <ThemedDatePicker label="开始" value={start} min="1900-01-01" max={end} onChange={onStart} />
            <span className="range-separator" aria-hidden="true">至</span>
            <ThemedDatePicker label="结束" value={end} min={start} max="2100-12-31" onChange={onEnd} />
          </div>

          <div className="range-result" aria-live="polite">
            <span>合计</span>
            <strong>{displayDuration(stats.duration)}<small>天</small></strong>
            <em>{stats.workDays} 个工作日</em>
            <button type="button" onClick={onCurrentMonth} title="切换为当前查看月份">
              <RotateCcw />本月
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
