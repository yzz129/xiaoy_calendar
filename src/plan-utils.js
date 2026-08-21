import { fromKey, toKey } from './date-utils.js'

export const PLAN_TYPES = {
  study: { label: '学习', color: 'blue' },
  work: { label: '工作', color: 'mint' },
}

export function getPlanType(plan) {
  if (plan?.planType === 'study' || plan?.planType === 'work') return plan.planType
  if (plan?.type === 'study' || plan?.type === 'work') return plan.type
  return 'study'
}

export const PLAN_WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
]

export function getPlanDates(plan) {
  if (!plan?.start || !plan?.end || plan.start > plan.end) return []
  const weekdays = new Set(Array.isArray(plan.weekdays) && plan.weekdays.length ? plan.weekdays : [1, 2, 3, 4, 5])
  const cursor = fromKey(plan.start)
  const end = fromKey(plan.end)
  const keys = []

  while (cursor <= end) {
    if (weekdays.has(cursor.getDay())) keys.push(toKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

function getPlanOverride(planTaskOverrides, planId, dateKey) {
  return planTaskOverrides?.[planId]?.[dateKey] || {}
}

export function getExtraTaskProgressKey(taskId) {
  return `extra:${taskId}`
}

export function getPlanProgress(plan, planProgress = {}, planTaskOverrides = {}) {
  const dates = getPlanDates(plan)
  const progress = planProgress[plan.id] || {}
  const overrides = planTaskOverrides[plan.id] || {}
  const skipped = dates.filter((key) => Boolean(overrides[key]?.skipped)).length
  const activeDates = dates.filter((key) => !overrides[key]?.skipped)
  const extraTasks = Object.values(overrides).flatMap((override) => (
    Array.isArray(override?.extras) ? override.extras : []
  ))
  const completed = activeDates.filter((key) => Boolean(progress[key])).length
    + extraTasks.filter((task) => Boolean(progress[getExtraTaskProgressKey(task.id)])).length
  const total = activeDates.length + extraTasks.length
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    skipped,
    percent: total ? Math.round((completed / total) * 100) : 0,
  }
}

export function getPlanTasksForDate(plans = [], planProgress = {}, planTaskOverrides = {}, dateKey, options = {}) {
  const date = fromKey(dateKey)
  const weekday = date.getDay()
  const includeSkipped = Boolean(options.includeSkipped)

  return plans.flatMap((plan) => {
    const scheduled = (
      plan.start <= dateKey
      && plan.end >= dateKey
      && (plan.weekdays || []).includes(weekday)
    )
    const override = getPlanOverride(planTaskOverrides, plan.id, dateKey)
    const defaultTitle = plan.dailyTask?.trim() || plan.title
    const tasks = []

    if (scheduled && (!override.skipped || includeSkipped)) {
      tasks.push({
        id: `${plan.id}:${dateKey}:base`,
        taskId: 'base',
        progressKey: dateKey,
        planId: plan.id,
        dateKey,
        type: getPlanType(plan),
        planTitle: plan.title,
        title: override.title?.trim() || defaultTitle,
        defaultTitle,
        goal: plan.goal?.trim() || '',
        done: Boolean(planProgress[plan.id]?.[dateKey]),
        skipped: Boolean(override.skipped),
        isExtra: false,
        isCustomized: Boolean(override.title?.trim()),
        planStart: plan.start,
        planEnd: plan.end,
      })
    }

    const extras = Array.isArray(override.extras) ? override.extras : []
    extras.forEach((extra) => {
      const progressKey = getExtraTaskProgressKey(extra.id)
      tasks.push({
        id: `${plan.id}:${dateKey}:${extra.id}`,
        taskId: extra.id,
        progressKey,
        planId: plan.id,
        dateKey,
        type: getPlanType(plan),
        planTitle: plan.title,
        title: extra.title?.trim() || defaultTitle,
        defaultTitle,
        goal: plan.goal?.trim() || '',
        done: Boolean(planProgress[plan.id]?.[progressKey]),
        skipped: false,
        isExtra: true,
        isCustomized: true,
        movedFrom: extra.movedFrom || '',
        planStart: plan.start,
        planEnd: plan.end,
      })
    })

    return tasks
  })
}

export function getActivePlanCount(plans = [], planProgress = {}, planTaskOverrides = {}) {
  return plans.filter((plan) => {
    const progress = getPlanProgress(plan, planProgress, planTaskOverrides)
    return progress.remaining > 0
  }).length
}

export function formatWeekdays(weekdays = []) {
  const normalized = PLAN_WEEKDAYS.filter((item) => weekdays.includes(item.value)).map((item) => item.label)
  if (normalized.length === 7) return '每天'
  if (normalized.join('') === '一二三四五') return '工作日'
  return `周${normalized.join('、')}`
}
