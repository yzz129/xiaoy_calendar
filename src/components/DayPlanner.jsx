import { BriefcaseBusiness, Check, Coffee, Minus, Palmtree, Plus, Trash2, X } from 'lucide-react'
import emptyMascot from '../assets/illustrations/empty-mascot.webp'
import DoodleIcon from './DoodleIcon'

const STATUS_OPTIONS = [
  { value: 'work', label: '工作日', icon: BriefcaseBusiness },
  { value: 'rest', label: '休息日', icon: Coffee },
  { value: 'leave', label: '请假', icon: Palmtree },
]

function NoteItem({ note, onUpdate, onRemove }) {
  return (
    <div className={`note-item${note.done ? ' done' : ''}`}>
      <button className="check-button" onClick={() => onUpdate({ done: !note.done })} aria-label={note.done ? '标为未完成' : '标为已完成'}>
        {note.done ? <Check /> : null}
      </button>
      <input
        value={note.text}
        autoFocus={!note.text}
        onChange={(event) => onUpdate({ text: event.target.value })}
        onBlur={() => { if (!note.text.trim()) onRemove() }}
        placeholder="写下一件小事…"
        aria-label="便签内容"
      />
      <button className="delete-note" onClick={onRemove} aria-label="删除便签"><Trash2 /></button>
    </div>
  )
}

export default function DayPlanner({ label, entry, notes, open, onClose, onStatus, onDuration, onAddNote, onUpdateNote, onRemoveNote }) {
  const duration = entry?.status === 'work' ? (entry.duration ?? 1) : 0
  return (
    <aside className={`day-planner${open ? ' is-open' : ''}`} aria-label={`${label}计划`}>
      <div className="planner-heading">
        <h2>{label}</h2>
        <div className="planner-heading-actions">
          <DoodleIcon name="plane" className="planner-plane" />
          <button className="close-planner" onClick={onClose} aria-label="关闭日期编辑"><X /></button>
        </div>
      </div>

      <section className="planner-section">
        <h3>工作状态</h3>
        <div className="status-segmented">
          {STATUS_OPTIONS.map(({ value, label: statusLabel, icon: Icon }) => (
            <button
              key={value}
              className={entry?.status === value ? `active ${value}` : ''}
              onClick={() => onStatus(value)}
              aria-pressed={entry?.status === value}
            >
              <Icon />{statusLabel}
            </button>
          ))}
        </div>
      </section>

      <section className="planner-section duration-section">
        <div className="section-title-row">
          <h3>本日工期</h3>
        </div>
        <div className="duration-control">
          <button disabled={duration <= 0} onClick={() => onDuration(Math.max(0, duration - 0.5))} aria-label="减少半天"><Minus /></button>
          <strong>{duration % 1 === 0 ? duration : duration.toFixed(1)}<small>天</small></strong>
          <button onClick={() => onDuration(Math.min(9, duration + 0.5))} aria-label="增加半天"><Plus /></button>
        </div>
      </section>

      <section className="notes-section">
        <div className="section-title-row">
          <h3>便签</h3>
          <button className="add-note-top" onClick={onAddNote}><Plus />新建便签</button>
        </div>
        <div className="notes-list">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onUpdate={(patch) => onUpdateNote(note.id, patch)}
              onRemove={() => onRemoveNote(note.id)}
            />
          ))}
          {notes.length === 0 ? (
            <button className="notes-empty" onClick={onAddNote}>
              <img src={emptyMascot} alt="" />
              <strong>今天还没有便签</strong>
              <small>把待办写下来，脑袋轻一点</small>
            </button>
          ) : (
            <button className="add-note-bottom" onClick={onAddNote}><Plus />添加便签</button>
          )}
        </div>
      </section>
    </aside>
  )
}
