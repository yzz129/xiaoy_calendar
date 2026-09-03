const app = getApp()
const { toKey, fromKey } = require('../../utils/date')
const share = require('../../utils/share')

const WEEKDAYS = [
  { value: 1, label: '一' }, { value: 2, label: '二' }, { value: 3, label: '三' },
  { value: 4, label: '四' }, { value: 5, label: '五' }, { value: 6, label: '六' },
  { value: 0, label: '日' },
]

function addDays(date, count) {
  const next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}

function planDates(plan) {
  if (!plan.start || !plan.end || plan.start > plan.end) return []
  const allowed = new Set(plan.weekdays || [])
  const keys = []
  const cursor = fromKey(plan.start)
  const end = fromKey(plan.end)
  while (cursor <= end) {
    if (allowed.has(cursor.getDay())) keys.push(toKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

function presentPlans(snapshot) {
  return snapshot.plans.map((plan) => {
    const dates = planDates(plan)
    const progress = snapshot.planProgress[plan.id] || {}
    const completed = dates.filter((key) => progress[key]).length
    return {
      ...plan,
      typeLabel: (plan.planType || plan.type) === 'work' ? '工作' : '学习',
      total: dates.length,
      completed,
      percent: dates.length ? Math.round((completed / dates.length) * 100) : 0,
    }
  })
}

Page({
  data: {
    form: { title: '', dailyTask: '', start: '', end: '', type: 'study' },
    weekdays: WEEKDAYS.map((item) => ({ ...item, active: item.value > 0 && item.value < 6 })),
    plans: [],
  },

  onLoad() {
    share.enableShareMenu()
    const today = new Date()
    this.setData({
      'form.start': toKey(today),
      'form.end': toKey(addDays(today, 29)),
    })
  },

  onShow() {
    this.refresh()
    app.applyTheme(this)
  },

  refresh() {
    this.setData({ plans: presentPlans(app.globalData.snapshot) })
  },

  inputField(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value })
  },

  onShareAppMessage() {
    return share.appMessage({ title: '小Y日历｜规划中心', path: '/pages/plans/plans' })
  },

  onShareTimeline() {
    return share.timeline({ title: '小Y日历｜规划中心' })
  },

  setType(event) {
    this.setData({ 'form.type': event.currentTarget.dataset.type })
  },

  setStart(event) {
    const start = event.detail.value
    this.setData({ 'form.start': start, ...(start > this.data.form.end ? { 'form.end': start } : {}) })
  },

  setEnd(event) {
    const end = event.detail.value
    this.setData({ 'form.end': end, ...(end < this.data.form.start ? { 'form.start': end } : {}) })
  },

  toggleWeekday(event) {
    const value = Number(event.currentTarget.dataset.value)
    this.setData({ weekdays: this.data.weekdays.map((item) => item.value === value ? { ...item, active: !item.active } : item) })
  },

  createPlan() {
    const title = this.data.form.title.trim()
    const dailyTask = this.data.form.dailyTask.trim()
    const weekdays = this.data.weekdays.filter((item) => item.active).map((item) => item.value)
    if (!title || !dailyTask || !weekdays.length) {
      wx.showToast({ title: '请填写完整并选择执行日', icon: 'none' })
      return
    }
    const plan = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      dailyTask,
      goal: '',
      start: this.data.form.start,
      end: this.data.form.end,
      weekdays,
      type: this.data.form.type === 'work' ? 'work' : 'study',
      planType: this.data.form.type === 'work' ? 'work' : 'study',
      createdAt: new Date().toISOString(),
    }
    app.updateSnapshot((snapshot) => ({ ...snapshot, plans: [...snapshot.plans, plan] }))
    this.setData({ 'form.title': '', 'form.dailyTask': '' })
    this.refresh()
    wx.showToast({ title: '规划已创建', icon: 'success' })
  },

  removePlan(event) {
    const planId = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除规划',
      content: '规划及其完成记录将被删除，是否继续？',
      success: (result) => {
        if (!result.confirm) return
        app.updateSnapshot((snapshot) => {
          const progress = { ...snapshot.planProgress }
          const overrides = { ...snapshot.planTaskOverrides }
          delete progress[planId]
          delete overrides[planId]
          return {
            ...snapshot,
            plans: snapshot.plans.filter((plan) => plan.id !== planId),
            planProgress: progress,
            planTaskOverrides: overrides,
          }
        })
        this.refresh()
      },
    })
  },
})
