const app = getApp()
const { dateTitle, fromKey } = require('../../utils/date')
const share = require('../../utils/share')

function tasksForDate(snapshot, dateKey) {
  const weekday = fromKey(dateKey).getDay()
  return snapshot.plans.flatMap((plan) => {
    if (plan.start > dateKey || plan.end < dateKey || !(plan.weekdays || []).includes(weekday)) return []
    const override = snapshot.planTaskOverrides?.[plan.id]?.[dateKey] || {}
    if (override.skipped) return []
    return [{
      key: `${plan.id}:${dateKey}`,
      planId: plan.id,
      progressKey: dateKey,
      planTitle: plan.title,
      title: override.title || plan.dailyTask || plan.title,
      done: Boolean(snapshot.planProgress?.[plan.id]?.[dateKey]),
    }]
  })
}

Page({
  data: {
    dateKey: '',
    title: '',
    entry: { status: '', duration: 1 },
    notes: [],
    tasks: [],
    newNote: '',
  },

  onLoad(options) {
    share.enableShareMenu()
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(options.date || '') ? options.date : ''
    if (!dateKey) {
      wx.navigateBack()
      return
    }
    this.setData({ dateKey, title: dateTitle(dateKey) })
  },

  onShareAppMessage() {
    const dateKey = this.data.dateKey
    return share.appMessage({
      title: `${this.data.title || '日期详情'}｜小Y日历`,
      path: dateKey ? `/pages/day/day?date=${dateKey}` : share.CALENDAR_PATH,
    })
  },

  onShareTimeline() {
    const dateKey = this.data.dateKey
    return share.timeline({
      title: `${this.data.title || '日期详情'}｜小Y日历`,
      query: dateKey ? `date=${dateKey}` : '',
    })
  },

  onShow() {
    this.refresh()
    app.applyTheme(this)
  },

  refresh() {
    const snapshot = app.globalData.snapshot
    this.setData({
      entry: { status: '', duration: 1, ...(snapshot.entries[this.data.dateKey] || {}) },
      notes: snapshot.notes[this.data.dateKey] || [],
      tasks: tasksForDate(snapshot, this.data.dateKey),
    })
  },

  setStatus(event) {
    const status = event.currentTarget.dataset.status
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      entries: {
        ...snapshot.entries,
        [this.data.dateKey]: {
          ...snapshot.entries[this.data.dateKey],
          status,
          duration: status === 'work' ? Number(snapshot.entries[this.data.dateKey]?.duration || 1) : 0,
        },
      },
    }))
    this.refresh()
  },

  setDuration(event) {
    const duration = Math.max(0, Math.min(365, Number(event.detail.value || 0)))
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      entries: {
        ...snapshot.entries,
        [this.data.dateKey]: { ...snapshot.entries[this.data.dateKey], status: 'work', duration },
      },
    }))
    this.refresh()
  },

  inputNote(event) {
    this.setData({ newNote: event.detail.value })
  },

  addNote() {
    const text = this.data.newNote.trim()
    if (!text) return
    const note = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, done: false }
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      notes: {
        ...snapshot.notes,
        [this.data.dateKey]: [...(snapshot.notes[this.data.dateKey] || []), note],
      },
    }))
    this.setData({ newNote: '' })
    this.refresh()
  },

  toggleNote(event) {
    const id = event.currentTarget.dataset.id
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      notes: {
        ...snapshot.notes,
        [this.data.dateKey]: (snapshot.notes[this.data.dateKey] || []).map((note) => (
          note.id === id ? { ...note, done: !note.done } : note
        )),
      },
    }))
    this.refresh()
  },

  removeNote(event) {
    const id = event.currentTarget.dataset.id
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      notes: {
        ...snapshot.notes,
        [this.data.dateKey]: (snapshot.notes[this.data.dateKey] || []).filter((note) => note.id !== id),
      },
    }))
    this.refresh()
  },

  toggleTask(event) {
    const planId = event.currentTarget.dataset.plan
    const progressKey = event.currentTarget.dataset.progress
    app.updateSnapshot((snapshot) => {
      const current = { ...(snapshot.planProgress[planId] || {}) }
      if (current[progressKey]) delete current[progressKey]
      else current[progressKey] = true
      return { ...snapshot, planProgress: { ...snapshot.planProgress, [planId]: current } }
    })
    this.refresh()
  },

  openPlans() {
    wx.navigateTo({ url: '/pages/plans/plans' })
  },
})
