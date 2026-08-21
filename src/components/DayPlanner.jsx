import { useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  Coffee,
  Edit3,
  Minus,
  Palmtree,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import emptyMascot from '../assets/illustrations/empty-mascot.webp'
import DoodleIcon from './DoodleIcon'
import ThemedDatePicker from './ThemedDatePicker'

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

function PlanTaskItem({ task, onToggle, onEdit }) {
  const Icon = task.type === 'work' ? BriefcaseBusiness : BookOpenCheck
  return (
    <article className={`daily-plan-item ${task.type}${task.done ? ' done' : ''}${task.skipped ? ' skipped' : ''}`}>
      <button
        type="button"
        className="daily-plan-toggle"
        onClick={onToggle}
        disabled={task.skipped}
        aria-label={task.done ? `将${task.title}标为未完成` : `完成${task.title}`}
        aria-pressed={task.done}
      >
        <span className="daily-plan-check">{task.done ? <Check /> : null}</span>
      </button>
      <span className="daily-plan-copy">
        <strong>{task.title}</strong>
        <small><Icon />{task.planTitle}{task.skipped ? <em>已跳过</em> : task.isExtra ? <em>当天新增</em> : task.isCustomized ? <em>已调整</em> : null}</small>
      </span>
      <button type="button" className="daily-plan-edit" onClick={onEdit} aria-label={`调整${task.title}`}><Edit3 /></button>
    </article>
  )
}

function TaskEditor({ task, onSave, onSkip, onReset, onRemove, onMove, onCancel }) {
  const [title, setTitle] = useState(task.title)
  const [moveDate, setMoveDate] = useState(task.dateKey)
  const canSave = Boolean(title.trim())
  const canReset = !task.isExtra && (task.isCustomized || task.skipped)

  return (
    <div className={`daily-task-editor ${task.type}`}>
      <div className="daily-task-editor-heading">
        <span><Edit3 />只调整这一天</span>
        <button type="button" onClick={onCancel} aria-label="收起任务编辑"><X /></button>
      </div>
      <label className="daily-task-title-field">
        <span>当天任务</span>
        <input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </label>
      <div className="daily-task-save-row">
        <button type="button" className="daily-task-save" disabled={!canSave} onClick={() => onSave(title.trim())}><Check />保存当天修改</button>
        {canReset ? <button type="button" className="daily-task-reset" onClick={onReset}><RotateCcw />恢复默认</button> : null}
      </div>
      <div className="daily-task-move-row">
        <ThemedDatePicker
          label="移动到"
          value={moveDate}
          min={task.planStart}
          max={task.planEnd}
          onChange={setMoveDate}
        />
        <button type="button" disabled={moveDate === task.dateKey} onClick={() => onMove(moveDate)}><ArrowRight />移期</button>
      </div>
      <button type="button" className="daily-task-danger" onClick={task.isExtra ? onRemove : onSkip}>
        <Trash2 />{task.isExtra ? '删除这条额外任务' : '跳过今天，不影响总规划'}
      </button>
    </div>
  )
}

function ExtraTaskForm({ plans, onAdd, onCancel }) {
  const [planId, setPlanId] = useState(plans[0]?.id || '')
  const [title, setTitle] = useState('')
  return (
    <div className="daily-extra-form">
      <div className="daily-task-editor-heading"><span><Plus />增加当天任务</span><button type="button" onClick={onCancel} aria-label="取消添加任务"><X /></button></div>
      {plans.length > 1 ? (
        <label><span>归属规划</span><select value={planId} onChange={(event) => setPlanId(event.target.value)}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
      ) : null}
      <label><span>任务内容</span><input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} placeholder="今天额外做什么？" autoFocus /></label>
      <button type="button" className="daily-task-save" disabled={!planId || !title.trim()} onClick={() => onAdd(planId, title.trim())}><Plus />添加到今天</button>
    </div>
  )
}

export default function DayPlanner({
  label,
  entry,
  notes,
  planTasks,
  plans,
  dateKey,
  open,
  onClose,
  onStatus,
  onDuration,
  onOpenPlans,
  onTogglePlanTask,
  onUpdatePlanTask,
  onAddPlanTask,
  onRemovePlanTask,
  onResetPlanTask,
  onMovePlanTask,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
}) {
  const duration = entry?.status === 'work' ? (entry.duration ?? 1) : 0
  const pendingPlanTasks = planTasks.filter((task) => !task.done && !task.skipped).length
  const [activeTab, setActiveTab] = useState(() => (planTasks.length ? 'tasks' : 'notes'))
  const [editingTaskId, setEditingTaskId] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const editablePlans = plans.filter((plan) => plan.start <= dateKey && plan.end >= dateKey)
  const editingTask = planTasks.find((task) => task.id === editingTaskId)
  return (
    <aside className={`day-planner${open ? ' is-open' : ''}`} aria-label={`${label}计划`}>
      <div className="planner-heading">
        <h2>{label}</h2>
        <div className="planner-heading-actions">
          <DoodleIcon name="plane" className="planner-plane" />
          <button className="close-planner" onClick={onClose} aria-label="关闭日期编辑"><X /></button>
        </div>
      </div>

      <section className="planner-section day-record-section">
        <div className="section-title-row">
          <h3>日历记录</h3>
          <small className="day-record-summary">{entry?.status ? STATUS_OPTIONS.find((item) => item.value === entry.status)?.label : '选择当天状态'}</small>
        </div>
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
        <div className={`inline-duration${entry?.status === 'work' ? '' : ' is-muted'}`}>
          <span>本日工期</span>
          <button disabled={duration <= 0} onClick={() => onDuration(Math.max(0, duration - 0.5))} aria-label="减少半天"><Minus /></button>
          <strong>{duration % 1 === 0 ? duration : duration.toFixed(1)}<small>天</small></strong>
          <button onClick={() => onDuration(Math.min(9, duration + 0.5))} aria-label="增加半天"><Plus /></button>
        </div>
      </section>

      <div className="day-content-tabs" role="tablist" aria-label="日期内容">
        <button type="button" role="tab" aria-selected={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')}>
          <BookOpenCheck />任务{planTasks.length ? <span>{pendingPlanTasks}</span> : null}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>
          <ClipboardList />便签{notes.length ? <span>{notes.length}</span> : null}
        </button>
      </div>

      {activeTab === 'tasks' ? (
        <section className="day-tab-panel daily-plan-section" role="tabpanel">
          <div className="section-title-row">
            <h3>当天任务</h3>
            <div className="daily-task-toolbar">
              {editablePlans.length ? <button type="button" className="add-daily-task-button" onClick={() => { setEditingTaskId(''); setAddingTask(true) }}><Plus />加任务</button> : null}
              <button type="button" className="manage-plans-button" onClick={onOpenPlans}><ClipboardList />总规划</button>
            </div>
          </div>
          {addingTask ? (
            <ExtraTaskForm
              plans={editablePlans}
              onCancel={() => setAddingTask(false)}
              onAdd={(planId, title) => { onAddPlanTask(planId, dateKey, title); setAddingTask(false) }}
            />
          ) : null}
          {planTasks.length ? (
            <div className="daily-plan-list">
              {planTasks.map((task) => (
                <div className="daily-plan-task-group" key={task.id}>
                  <PlanTaskItem
                    task={task}
                    onToggle={() => onTogglePlanTask(task.planId, task.progressKey)}
                    onEdit={() => { setAddingTask(false); setEditingTaskId((current) => current === task.id ? '' : task.id) }}
                  />
                  {editingTask?.id === task.id ? (
                    <TaskEditor
                      key={`${task.id}:${task.title}:${task.skipped}`}
                      task={task}
                      onCancel={() => setEditingTaskId('')}
                      onSave={(title) => {
                        onUpdatePlanTask(task.planId, task.dateKey, task.taskId, task.isExtra ? { title } : { title, skipped: false })
                        setEditingTaskId('')
                      }}
                      onSkip={() => { onRemovePlanTask(task.planId, task.dateKey, task.taskId); setEditingTaskId('') }}
                      onRemove={() => { onRemovePlanTask(task.planId, task.dateKey, task.taskId); setEditingTaskId('') }}
                      onReset={() => { onResetPlanTask(task.planId, task.dateKey); setEditingTaskId('') }}
                      onMove={(targetDate) => { onMovePlanTask(task.planId, task.dateKey, targetDate, task.taskId); setEditingTaskId('') }}
                    />
                  ) : null}
                </div>
              ))}
              <small className="daily-plan-summary">{pendingPlanTasks ? `还有 ${pendingPlanTasks} 项待完成` : '今天的任务都处理好了'}</small>
            </div>
          ) : (
            <button type="button" className="daily-plan-empty" onClick={onOpenPlans}>
              <BookOpenCheck />
              <span><strong>当天没有规划任务</strong><small>前往规划中心安排节奏</small></span>
              <Plus />
            </button>
          )}
        </section>
      ) : (
        <section className="day-tab-panel notes-section" role="tabpanel">
          <div className="section-title-row">
            <h3>待办与便签</h3>
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
      )}
    </aside>
  )
}
