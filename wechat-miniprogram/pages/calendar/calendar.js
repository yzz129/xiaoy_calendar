const app = getApp()
const { WEEK_LABELS, monthCells, toKey } = require('../../utils/date')

function buildView(year, month, snapshot) {
  const todayKey = toKey(new Date())
  const cells = monthCells(year, month).map((cell) => {
    const entry = snapshot.entries[cell.key] || {}
    return {
      ...cell,
      today: cell.key === todayKey,
      status: entry.status || '',
      noteCount: (snapshot.notes[cell.key] || []).length,
    }
  })
  let workDays = 0
  let duration = 0
  let notes = 0
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  Object.keys(snapshot.entries).forEach((key) => {
    const entry = snapshot.entries[key]
    if (!key.startsWith(prefix) || entry.status !== 'work') return
    workDays += 1
    duration += Number(entry.duration || 0)
  })
  Object.keys(snapshot.notes).forEach((key) => {
    if (key.startsWith(prefix)) notes += (snapshot.notes[key] || []).length
  })
  return {
    cells,
    monthTitle: `${year}年${month}月`,
    stats: { workDays, duration, notes },
    planCount: snapshot.plans.length,
  }
}

Page({
  data: {
    user: {},
    year: 0,
    month: 0,
    monthTitle: '',
    weekLabels: WEEK_LABELS,
    cells: [],
    stats: { workDays: 0, duration: 0, notes: 0 },
    planCount: 0,
  },

  onLoad() {
    const today = new Date()
    this.setData({ year: today.getFullYear(), month: today.getMonth() + 1 })
  },

  async onShow() {
    if (!app.hasSession()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.refreshView()
    try {
      await app.ensureSession()
      this.refreshView()
    } catch (error) {
      if (!app.hasSession()) wx.reLaunch({ url: '/pages/login/login' })
      else wx.showToast({ title: '已显示本地数据', icon: 'none' })
    }
  },

  async onPullDownRefresh() {
    try {
      await app.pullSnapshot()
      this.refreshView()
      wx.showToast({ title: '同步完成', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '同步失败', icon: 'none' })
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  refreshView() {
    this.setData({
      user: app.globalData.user || {},
      ...buildView(this.data.year, this.data.month, app.globalData.snapshot),
    })
  },

  changeMonth(event) {
    const offset = Number(event.currentTarget.dataset.offset)
    const date = new Date(this.data.year, this.data.month - 1 + offset, 1)
    this.setData({ year: date.getFullYear(), month: date.getMonth() + 1 })
    this.refreshView()
  },

  goToday() {
    const today = new Date()
    this.setData({ year: today.getFullYear(), month: today.getMonth() + 1 })
    this.refreshView()
  },

  openDay(event) {
    wx.navigateTo({ url: `/pages/day/day?date=${event.currentTarget.dataset.key}` })
  },

  openToday() {
    wx.navigateTo({ url: `/pages/day/day?date=${toKey(new Date())}` })
  },

  openPlans() {
    wx.navigateTo({ url: '/pages/plans/plans' })
  },

  openProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },
})
