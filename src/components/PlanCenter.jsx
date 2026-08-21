import { useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardList,
  Edit3,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import { fromKey, toKey } from '../date-utils'
import { formatWeekdays, getPlanProgress, getPlanType, PLAN_TYPES, PLAN_WEEKDAYS } from '../plan-utils'
import ThemedDatePicker from './ThemedDatePicker'

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'study', label: '学习' },
  { value: 'work', label: '工作' },
  { value: 'completed', label: '已完成' },
]

function addDays(dateKey, amount) {
  const date = fromKey(dateKey)
  date.setDate(date.getDate() + amount)
  return toKey(date)
}

function createDraft(todayKey) {
  return {
    id: '',
    type: 'study',
    title: '',
    goal: '',
    dailyTask: '',
    start: todayKey,
    end: addDays(todayKey, 29),
    weekdays: [1, 2, 3, 4, 5],
  }
}

function PlanIcon({ type }) {
  return type === 'work' ? <BriefcaseBusiness /> : <BookOpenCheck />
}

function PlanForm({ draft, onChange, onCancel, onSave }) {
  const toggleWeekday = (weekday) => {
    const weekdays = draft.weekdays.includes(weekday)
      ? draft.weekdays.filter((item) => item !== weekday)
      : [...draft.weekdays, weekday]
    onChange({ weekdays })
  }
  const valid = draft.title.trim() && draft.start <= draft.end && draft.weekdays.length > 0

  return (
    <form className="plan-form" onSubmit={(event) => { event.preventDefault(); if (valid) onSave() }}>
      <div className="plan-form-heading">
        <div>
          <small>{draft.id ? '编辑已有规划' : '建立一个新节奏'}</small>
          <h3>{draft.id ? '修改规划' : '新建规划'}</h3>
        </div>
        <span className={`plan-form-sticker ${draft.type}`}><PlanIcon type={draft.type} /></span>
      </div>

      <fieldset className="plan-type-switch">
        <legend>规划类型</legend>
        {Object.entries(PLAN_TYPES).map(([value, option]) => (
          <button
            type="button"
            key={value}
            className={draft.type === value ? `active ${value}` : ''}
            onClick={() => onChange({ type: value })}
            aria-pressed={draft.type === value}
          >
            <PlanIcon type={value} />{option.label}规划
          </button>
        ))}
      </fieldset>

      <div className="plan-form-grid">
        <label className="plan-field plan-title-field">
          <span>计划名称</span>
          <input
            value={draft.title}
            maxLength={30}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder={draft.type === 'study' ? '例如：30天英语提升' : '例如：完成作品集改版'}
            autoFocus
          />
        </label>
        <label className="plan-field">
          <span><Target />最终目标</span>
          <input
            value={draft.goal}
            maxLength={60}
            onChange={(event) => onChange({ goal: event.target.value })}
            placeholder="完成后想达到什么结果？"
          />
        </label>
        <label className="plan-field plan-daily-field">
          <span><Check />默认每日任务</span>
          <input
            value={draft.dailyTask}
            maxLength={60}
            onChange={(event) => onChange({ dailyTask: event.target.value })}
            placeholder={draft.type === 'study' ? '例如：背单词30分钟' : '例如：完成一个页面'}
          />
          <small>作为每天的默认内容，可在当天单独修改、跳过或移期。</small>
        </label>
      </div>

      <div className="plan-date-range">
        <ThemedDatePicker
          label="开始日期"
          value={draft.start}
          min="1900-01-01"
          max={draft.end}
          onChange={(start) => onChange({ start, end: start > draft.end ? start : draft.end })}
        />
        <span aria-hidden="true">到</span>
        <ThemedDatePicker
          label="结束日期"
          value={draft.end}
          min={draft.start}
          max="2100-12-31"
          onChange={(end) => onChange({ end, start: end < draft.start ? end : draft.start })}
        />
      </div>

      <fieldset className="plan-weekdays">
        <legend>每周安排</legend>
        <div>
          {PLAN_WEEKDAYS.map((weekday) => (
            <button
              type="button"
              key={weekday.value}
              className={draft.weekdays.includes(weekday.value) ? 'active' : ''}
              onClick={() => toggleWeekday(weekday.value)}
              aria-pressed={draft.weekdays.includes(weekday.value)}
            >
              {weekday.label}
            </button>
          ))}
        </div>
        <small>{draft.weekdays.length ? `${formatWeekdays(draft.weekdays)}自动生成默认任务` : '至少选择一天'}</small>
      </fieldset>

      <div className="plan-form-actions">
        <button type="button" className="plan-cancel" onClick={onCancel}>取消</button>
        <button type="submit" className="plan-save" disabled={!valid}>{draft.id ? '保存修改' : '创建规划'}</button>
      </div>
    </form>
  )
}

function PlanCard({ plan, progress, deleteArmed, onEdit, onDelete }) {
  const planType = getPlanType(plan)
  return (
    <article className={`plan-card ${planType}${progress.total && progress.completed === progress.total ? ' completed' : ''}`}>
      <div className="plan-card-icon"><PlanIcon type={planType} /></div>
      <div className="plan-card-main">
        <div className="plan-card-title">
          <span>{PLAN_TYPES[planType].label}规划</span>
          <h3>{plan.title}</h3>
        </div>
        {plan.goal ? <p><Target />{plan.goal}</p> : null}
        <div className="plan-card-meta">
          <span><CalendarDays />{plan.start.replaceAll('-', '.')}—{plan.end.replaceAll('-', '.')}</span>
          <span>{formatWeekdays(plan.weekdays)}</span>
        </div>
        <div className="plan-progress-row">
          <div className="plan-progress"><i style={{ width: `${progress.percent}%` }} /></div>
          <strong>{progress.completed}/{progress.total}</strong>
          <small>{progress.percent}%{progress.skipped ? ` · 跳过${progress.skipped}` : ''}</small>
        </div>
        <div className="plan-card-daily"><Check /><span><small>默认每日任务</small>{plan.dailyTask || plan.title}</span></div>
      </div>
      <div className="plan-card-actions">
        <button type="button" onClick={onEdit} aria-label={`编辑${plan.title}`}><Edit3 /></button>
        <button type="button" className={deleteArmed ? 'confirm-delete' : ''} onClick={onDelete} aria-label={deleteArmed ? `确认删除${plan.title}` : `删除${plan.title}`}>
          {deleteArmed ? <span>确认</span> : <Trash2 />}
        </button>
      </div>
    </article>
  )
}

export default function PlanCenter({ open, todayKey, plans, planProgress, planTaskOverrides, onClose, onCreate, onUpdate, onRemove }) {
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState(null)
  const [deleteArmed, setDeleteArmed] = useState('')

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      setDraft(null)
      setDeleteArmed('')
    }
    // The close callback is intentionally captured for this open session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const progressByPlan = useMemo(
    () => Object.fromEntries(plans.map((plan) => [plan.id, getPlanProgress(plan, planProgress, planTaskOverrides)])),
    [plans, planProgress, planTaskOverrides],
  )
  const visiblePlans = plans.filter((plan) => {
    const progress = progressByPlan[plan.id]
    if (filter === 'completed') return progress.total > 0 && progress.completed === progress.total
    if (filter === 'study' || filter === 'work') return getPlanType(plan) === filter
    return true
  })
  const totals = Object.values(progressByPlan).reduce((result, progress) => ({
    tasks: result.tasks + progress.total,
    completed: result.completed + progress.completed,
    skipped: result.skipped + progress.skipped,
  }), { tasks: 0, completed: 0, skipped: 0 })

  if (!open) return null

  const saveDraft = () => {
    const payload = {
      type: draft.type,
      planType: draft.type,
      title: draft.title.trim(),
      goal: draft.goal.trim(),
      dailyTask: draft.dailyTask.trim(),
      start: draft.start,
      end: draft.end,
      weekdays: [...draft.weekdays],
    }
    if (draft.id) onUpdate(draft.id, payload)
    else onCreate(payload)
    setDraft(null)
  }

  const closeHeaderView = () => {
    if (draft) {
      setDraft(null)
      return
    }
    onClose()
  }

  return (
    <div className="plan-center-layer">
      <button className="plan-center-backdrop" type="button" onClick={onClose} aria-label="关闭规划中心" />
      <section className="plan-center" role="dialog" aria-modal="true" aria-labelledby="plan-center-title">
        <header className="plan-center-header">
          <span className="plan-center-mark"><ClipboardList /></span>
          <div>
            <small>把目标放进日历</small>
            <h2 id="plan-center-title">规划中心</h2>
          </div>
          {!draft ? <button type="button" className="new-plan-button" onClick={() => setDraft(createDraft(todayKey))}><Plus />新建规划</button> : null}
          <button
            type="button"
            className="plan-center-close"
            onClick={closeHeaderView}
            aria-label={draft ? '返回规划列表' : '关闭规划中心'}
          >
            <X />
          </button>
        </header>

        <div className="plan-center-body">
          {draft ? (
            <PlanForm
              draft={draft}
              onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              onCancel={() => setDraft(null)}
              onSave={saveDraft}
            />
          ) : (
            <>
              <div className="plan-overview">
                <span><strong>{plans.length}</strong><small>个规划</small></span>
                <span><strong>{totals.completed}</strong><small>已完成任务</small></span>
                <span><strong>{Math.max(0, totals.tasks - totals.completed)}</strong><small>待完成任务</small></span>
              </div>

              <nav className="plan-filters" aria-label="筛选规划">
                {FILTERS.map((item) => (
                  <button type="button" key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="plan-list">
                {visiblePlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    progress={progressByPlan[plan.id]}
                    deleteArmed={deleteArmed === plan.id}
                    onEdit={() => {
                      setDraft({
                        ...plan,
                        type: getPlanType(plan),
                        weekdays: [...(plan.weekdays || [1, 2, 3, 4, 5])],
                      })
                      setDeleteArmed('')
                    }}
                    onDelete={() => {
                      if (deleteArmed === plan.id) {
                        onRemove(plan.id)
                        setDeleteArmed('')
                      } else setDeleteArmed(plan.id)
                    }}
                  />
                ))}
                {visiblePlans.length === 0 ? (
                  <button type="button" className="plan-empty" onClick={() => setDraft(createDraft(todayKey))}>
                    <span><BookOpenCheck /></span>
                    <strong>{plans.length ? '这里暂时没有符合的规划' : '从一个小目标开始'}</strong>
                    <small>设置时间和执行星期，小Y会自动安排到每天。</small>
                    <em><Plus />新建第一个规划</em>
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
