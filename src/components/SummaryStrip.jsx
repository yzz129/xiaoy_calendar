import DoodleIcon from './DoodleIcon'

const ITEMS = [
  { key: 'completed', label: '已完成', icon: 'leaf', tone: 'mint' },
  { key: 'leave', label: '请假', icon: 'mascot', tone: 'blue' },
  { key: 'duration', label: '本月工期', icon: 'clock', tone: 'yellow' },
]

export default function SummaryStrip({ stats }) {
  return (
    <section className="summary-strip" aria-label="本月工期统计">
      {ITEMS.map(({ key, label, icon, tone }) => (
        <div className={`summary-item ${tone}`} key={key}>
          <DoodleIcon name={icon} />
          <span className="summary-label">{label}</span>
          <span className="summary-value">
            <strong>{stats[key]}</strong>
            <small>天</small>
          </span>
        </div>
      ))}
    </section>
  )
}
