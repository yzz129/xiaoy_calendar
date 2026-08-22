const app = getApp()
const api = require('../../utils/api')
const share = require('../../utils/share')
const { WEEK_LABELS, monthCells, toKey, fromKey, dateTitle, rangeStats } = require('../../utils/date')

const QUICK_PROMPTS = ['帮我安排一个学习计划', '根据我的空闲时间规划工作', '看看我这个月的安排']
const DOWNLOAD_PAGE = 'https://calendar.yzzwnw.asia/download/'
const PET_POSITION_KEY = 'xy-calendar-pet-position-v1'
const PET_HIDDEN_KEY = 'xy-calendar-pet-hidden-v1'
const PET_BUBBLE_SIZE_KEY = 'xy-calendar-pet-bubble-size-v1'
const PET_IMAGES = {
  idle: '/assets/pet/empty-mascot.webp',
  focused: '/assets/pet/agent-focused.png',
  thinking: '/assets/pet/agent-thinking.png',
  celebrate: '/assets/pet/agent-celebrate.png',
  sleepy: '/assets/pet/agent-sleepy.png',
}
const PET_STATUS = {
  idle: '待命',
  focused: '专注陪伴',
  thinking: '正在思考',
  celebrate: '开心庆祝',
  sleepy: '正在休息',
}

function ambientPetMoods(date = new Date()) {
  const hour = date.getHours()
  return hour >= 22 || hour < 7
    ? ['sleepy', 'idle']
    : ['idle', 'focused', 'idle', 'thinking']
}

function tasksForDate(snapshot, dateKey) {
  const weekday = fromKey(dateKey).getDay()
  return (snapshot.plans || []).flatMap((plan) => {
    if (plan.start > dateKey || plan.end < dateKey || !(plan.weekdays || []).includes(weekday)) return []
    const override = snapshot.planTaskOverrides?.[plan.id]?.[dateKey] || {}
    if (override.skipped) return []
    return [{
      key: `${plan.id}:${dateKey}`,
      planId: plan.id,
      progressKey: dateKey,
      planTitle: plan.title,
      title: override.title || plan.dailyTask || plan.title,
      type: (plan.planType || plan.type) === 'work' ? 'work' : 'study',
      done: Boolean(snapshot.planProgress?.[plan.id]?.[dateKey]),
    }]
  })
}

function monthBounds(year, month) {
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: toKey(new Date(year, month, 0)),
  }
}

function buildView(year, month, snapshot, selectedKey) {
  const todayKey = toKey(new Date())
  const cells = monthCells(year, month).map((cell) => {
    const entry = snapshot.entries[cell.key] || {}
    const notes = (snapshot.notes[cell.key] || []).filter((note) => String(note.text || '').trim())
    const tasks = tasksForDate(snapshot, cell.key)
    return {
      ...cell,
      today: cell.key === todayKey,
      selected: cell.key === selectedKey,
      status: entry.status || '',
      calendarLabel: cell.meta.eventLabel || cell.meta.lunarLabel,
      event: Boolean(cell.meta.eventLabel),
      holidayType: cell.meta.holiday?.type || '',
      holidayTag: cell.meta.holiday ? (cell.meta.holiday.type === 'work' ? '班' : '休') : '',
      study: tasks.some((task) => task.type === 'study'),
      work: tasks.some((task) => task.type === 'work'),
      studyDone: tasks.filter((task) => task.type === 'study').every((task) => task.done),
      workDone: tasks.filter((task) => task.type === 'work').every((task) => task.done),
      planCount: tasks.length,
      noteCount: notes.length,
    }
  })
  let completed = 0
  let leave = 0
  let duration = 0
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  Object.keys(snapshot.entries || {}).forEach((key) => {
    const entry = snapshot.entries[key]
    if (entry.status === 'work') duration += Number(entry.duration || 0)
    if (!key.startsWith(prefix)) return
    if (entry.status === 'work') completed += 1
    if (entry.status === 'leave') leave += 1
  })
  const selectedEntry = snapshot.entries[selectedKey] || {}
  const selectedTasks = tasksForDate(snapshot, selectedKey)
  const selectedNotes = snapshot.notes[selectedKey] || []
  const selectedDate = fromKey(selectedKey)
  return {
    cells,
    monthTitle: `${year}年${month}月`,
    stats: { completed, leave, duration: Number.isInteger(duration) ? duration : Number(duration.toFixed(1)) },
    activePlanCount: (snapshot.plans || []).filter((plan) => plan.end >= todayKey).length,
    selectedTitle: dateTitle(selectedKey),
    daySheetTitle: `${selectedKey === todayKey ? '今天 · ' : ''}${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`,
    selectedSummary: selectedEntry.status || selectedTasks.length || selectedNotes.length
      ? `${selectedEntry.status === 'work' ? `工作 ${selectedEntry.duration || 0} 天` : selectedEntry.status === 'leave' ? '请假' : selectedEntry.status === 'rest' ? '休息' : '待设置'} · ${selectedTasks.length} 项规划 · ${selectedNotes.length} 条便签`
      : '待设置',
  }
}

function agentCalendarContext(page) {
  const snapshot = app.globalData.snapshot
  return {
    today: toKey(new Date()), timezone: 'Asia/Shanghai', month: page.data.monthTitle,
    nickname: app.globalData.user?.nickname || '', theme: snapshot.theme || 'light', stats: page.data.stats,
    recentAvailability: page.data.cells.filter((cell) => cell.current).map((cell) => ({
      date: cell.key, weekday: fromKey(cell.key).getDay(), status: snapshot.entries[cell.key]?.status || '',
      duration: Number(snapshot.entries[cell.key]?.duration || 0), notes: (snapshot.notes[cell.key] || []).slice(0, 8),
      plannedTasks: tasksForDate(snapshot, cell.key).slice(0, 8),
    })),
    plans: (snapshot.plans || []).slice(0, 20),
  }
}

Page({
  data: {
    user: {}, isAdmin: false, year: 0, month: 0, monthTitle: '', weekLabels: WEEK_LABELS, cells: [],
    stats: { completed: 0, leave: 0, duration: 0 }, activePlanCount: 0,
    selectedKey: '', selectedTitle: '', daySheetTitle: '', selectedSummary: '待设置',
    dayOpen: false, dayTab: 'notes', dayEntry: { status: '', duration: 1 }, dayNotes: [], dayTasks: [], dayNewNote: '', dayComposeOpen: false,
    rangeOpen: false, rangeStart: '', rangeEnd: '', rangeStats: { workDays: 0, duration: 0 },
    theme: 'light', petOpen: false, petInput: '', petBusy: false, petError: '',
    petMood: 'idle', petAmbientMood: 'idle', petCelebrating: false, petStatus: PET_STATUS.idle,
    petImage: PET_IMAGES.idle, petMessages: [], petResult: { questions: [], planDrafts: [] },
    petApplied: false, quickPrompts: QUICK_PROMPTS, petX: 0, petY: 0, petDragging: false,
    petHidden: false, petHiddenX: 0, petDockSide: 'right',
    bubbleX: 8, bubbleY: 8, bubbleWidth: 300, bubbleHeight: 330, bubbleTailX: 40, bubblePlacement: 'above', bubbleResizing: false,
  },

  onLoad() {
    share.enableShareMenu()
    const today = new Date()
    const bounds = monthBounds(today.getFullYear(), today.getMonth() + 1)
    const petAmbientMood = ambientPetMoods(today)[0]
    this.setData({
      year: today.getFullYear(), month: today.getMonth() + 1, selectedKey: toKey(today), rangeStart: bounds.start, rangeEnd: bounds.end,
      petAmbientMood, petMood: petAmbientMood, petImage: PET_IMAGES[petAmbientMood], petStatus: PET_STATUS[petAmbientMood],
    })
    this.initPetPosition()
  },

  onShareAppMessage() {
    return share.appMessage({ title: '小Y日历｜你的日历与规划搭子' })
  },

  onShareTimeline() {
    return share.timeline({ title: '小Y日历｜你的日历与规划搭子' })
  },

  onShow() {
    if (!app.hasSession()) return wx.reLaunch({ url: '/pages/login/login' })
    this.startPetMoodTimer()
    const needsInitialSync = !app.globalData.syncReady
    this.refreshView()
    app.ensureSession({ maxAge: 5 * 60 * 1000 })
      .then(() => { if (needsInitialSync) this.refreshView() })
      .catch(() => {
        if (!app.hasSession()) wx.reLaunch({ url: '/pages/login/login' })
      })
  },

  onHide() { this.stopPetMoodTimer() },
  onUnload() {
    this.stopPetMoodTimer()
    clearTimeout(this._petTapTimer)
    clearTimeout(this._hiddenDragTapTimer)
  },

  async onPullDownRefresh() {
    try { await app.pullSnapshot(); this.refreshView(); wx.showToast({ title: '同步完成', icon: 'success' }) }
    catch (error) { wx.showToast({ title: error.message || '同步失败', icon: 'none' }) }
    finally { wx.stopPullDownRefresh() }
  },

  refreshView() {
    const snapshot = app.globalData.snapshot
    this.setData({
      user: app.globalData.user || {}, isAdmin: app.globalData.user?.role === 'admin', theme: snapshot.theme || 'light',
      ...buildView(this.data.year, this.data.month, snapshot, this.data.selectedKey),
      rangeStats: rangeStats(snapshot.entries, this.data.rangeStart, this.data.rangeEnd),
    })
    if (this.data.dayOpen) this.refreshDaySheet()
  },

  refreshDaySheet() {
    const snapshot = app.globalData.snapshot
    this.setData({
      dayEntry: { status: '', duration: 1, ...(snapshot.entries[this.data.selectedKey] || {}) },
      dayNotes: snapshot.notes[this.data.selectedKey] || [],
      dayTasks: tasksForDate(snapshot, this.data.selectedKey),
    })
  },

  changeMonth(event) {
    const date = new Date(this.data.year, this.data.month - 1 + Number(event.currentTarget.dataset.offset), 1)
    const bounds = monthBounds(date.getFullYear(), date.getMonth() + 1)
    this.setData({ year: date.getFullYear(), month: date.getMonth() + 1, selectedKey: bounds.start, rangeStart: bounds.start, rangeEnd: bounds.end })
    this.refreshView()
  },
  goToday() {
    const today = new Date(); const bounds = monthBounds(today.getFullYear(), today.getMonth() + 1)
    this.setData({ year: today.getFullYear(), month: today.getMonth() + 1, selectedKey: toKey(today), rangeStart: bounds.start, rangeEnd: bounds.end }); this.refreshView()
  },
  selectDay(event) { this.setData({ selectedKey: event.currentTarget.dataset.key }); this.refreshView() },
  openSelected() {
    this.refreshDaySheet()
    this.setData({ dayOpen: true, dayTab: this.data.dayTasks.length ? 'tasks' : 'notes', dayNewNote: '', dayComposeOpen: false }, () => this.fitPetToBounds(true))
  },
  closeDay() { this.setData({ dayOpen: false, dayNewNote: '', dayComposeOpen: false }, () => this.fitPetToBounds(false)); this.refreshView() },
  setDayTab(event) { this.setData({ dayTab: event.currentTarget.dataset.tab }) },
  setDayStatus(event) {
    const requested = event.currentTarget.dataset.status
    const status = this.data.dayEntry.status === requested ? '' : requested
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      entries: {
        ...snapshot.entries,
        [this.data.selectedKey]: {
          ...snapshot.entries[this.data.selectedKey],
          status,
          duration: status === 'work' ? Number(snapshot.entries[this.data.selectedKey]?.duration || 1) : 0,
        },
      },
    }))
    this.refreshView()
  },
  adjustDayDuration(event) {
    const delta = Number(event.currentTarget.dataset.delta || 0)
    const duration = Math.max(0, Math.min(9, Number(this.data.dayEntry.duration || 0) + delta))
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      entries: {
        ...snapshot.entries,
        [this.data.selectedKey]: { ...snapshot.entries[this.data.selectedKey], status: 'work', duration },
      },
    }))
    this.refreshView()
  },
  startDayNote() { this.setData({ dayComposeOpen: true }) },
  inputDayNote(event) { this.setData({ dayNewNote: event.detail.value }) },
  addDayNote() {
    const text = this.data.dayNewNote.trim()
    if (!text) return
    const note = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, done: false }
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      notes: {
        ...snapshot.notes,
        [this.data.selectedKey]: [...(snapshot.notes[this.data.selectedKey] || []), note],
      },
    }))
    this.setData({ dayNewNote: '', dayComposeOpen: false })
    this.refreshView()
  },
  toggleDayNote(event) {
    const id = event.currentTarget.dataset.id
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      notes: {
        ...snapshot.notes,
        [this.data.selectedKey]: (snapshot.notes[this.data.selectedKey] || []).map((note) => note.id === id ? { ...note, done: !note.done } : note),
      },
    }))
    this.refreshView()
  },
  removeDayNote(event) {
    const id = event.currentTarget.dataset.id
    app.updateSnapshot((snapshot) => ({
      ...snapshot,
      notes: {
        ...snapshot.notes,
        [this.data.selectedKey]: (snapshot.notes[this.data.selectedKey] || []).filter((note) => note.id !== id),
      },
    }))
    this.refreshView()
  },
  toggleDayTask(event) {
    const planId = event.currentTarget.dataset.plan
    const progressKey = event.currentTarget.dataset.progress
    app.updateSnapshot((snapshot) => {
      const current = { ...(snapshot.planProgress[planId] || {}) }
      if (current[progressKey]) delete current[progressKey]
      else current[progressKey] = true
      return { ...snapshot, planProgress: { ...snapshot.planProgress, [planId]: current } }
    })
    this.refreshView()
  },
  openPlans() { wx.navigateTo({ url: '/pages/plans/plans' }) },
  openProfile() { wx.navigateTo({ url: '/pages/profile/profile' }) },
  openAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }) },
  copyDownload() { wx.setClipboardData({ data: DOWNLOAD_PAGE, success: () => wx.showToast({ title: '下载地址已复制', icon: 'none' }) }) },
  toggleTheme() {
    const theme = this.data.theme === 'light' ? 'dark' : 'light'
    app.updateSnapshot((snapshot) => ({ ...snapshot, theme })); this.setData({ theme })
  },
  async logout() {
    const result = await new Promise((resolve) => wx.showModal({ title: '退出登录', content: '云端数据会保留，确定退出吗？', success: resolve }))
    if (!result.confirm) return
    await app.logout(); wx.reLaunch({ url: '/pages/login/login' })
  },
  toggleRange() { this.setData({ rangeOpen: !this.data.rangeOpen }) },
  changeRangeStart(event) { this.setData({ rangeStart: event.detail.value }); this.refreshView() },
  changeRangeEnd(event) { this.setData({ rangeEnd: event.detail.value }); this.refreshView() },

  resolvePetMood(overrides = {}) {
    const state = { ...this.data, ...overrides }
    if (state.petBusy) return 'thinking'
    if (state.petCelebrating || state.petDragging) return 'celebrate'
    if (state.petOpen) return state.petMessages.length || String(state.petInput || '').trim() ? 'focused' : 'idle'
    return state.petAmbientMood || ambientPetMoods()[0]
  },
  refreshPetMood(overrides = {}) {
    const petMood = this.resolvePetMood(overrides)
    this.setData({ petMood, petImage: PET_IMAGES[petMood] || PET_IMAGES.idle, petStatus: PET_STATUS[petMood] || PET_STATUS.idle })
  },
  cycleAmbientPetMood() {
    const moods = ambientPetMoods()
    const currentIndex = moods.indexOf(this.data.petAmbientMood)
    const petAmbientMood = moods[(currentIndex + 1) % moods.length] || moods[0]
    this.setData({ petAmbientMood }, () => this.refreshPetMood())
  },
  startPetMoodTimer() {
    this.stopPetMoodTimer()
    const moods = ambientPetMoods()
    const petAmbientMood = moods.includes(this.data.petAmbientMood) ? this.data.petAmbientMood : moods[0]
    this.setData({ petAmbientMood, petCelebrating: false }, () => this.refreshPetMood())
    this._petMoodTimer = setInterval(() => {
      if (this.data.petOpen || this.data.petBusy || this.data.petDragging || this.data.petCelebrating || this.data.petHidden) return
      this.cycleAmbientPetMood()
    }, 7200)
  },
  stopPetMoodTimer() {
    clearInterval(this._petMoodTimer)
    clearTimeout(this._petCelebrateTimer)
    this._petMoodTimer = null
    this._petCelebrateTimer = null
  },
  celebratePet() {
    clearTimeout(this._petCelebrateTimer)
    this.setData({ petCelebrating: true }, () => this.refreshPetMood())
    this._petCelebrateTimer = setTimeout(() => {
      this._petCelebrateTimer = null
      this.setData({ petCelebrating: false }, () => this.refreshPetMood())
    }, 4200)
  },

  getPetBounds(dayOpen = this.data.dayOpen) {
    const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const width = Number(info.windowWidth || 375)
    const height = Number(info.windowHeight || 667)
    const size = Math.round(width * 112 / 750)
    const margin = Math.max(6, Math.round(width * 14 / 750))
    const minY = Math.max(margin, Number(info.safeArea?.top || 0) + 4)
    const sheetTop = Math.round(height * 0.28)
    return {
      width, height, size, margin,
      minX: margin,
      maxX: Math.max(margin, width - size - margin),
      minY,
      maxY: Math.max(minY, (dayOpen ? sheetTop : height) - size - margin),
    }
  },
  clampPetPosition(x, y, dayOpen = this.data.dayOpen) {
    const bounds = this.getPetBounds(dayOpen)
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, Number(x) || 0)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, Number(y) || 0)),
      bounds,
    }
  },
  getHiddenPetState(x = this.data.petX) {
    const bounds = this.getPetBounds(false)
    const side = Number(x) + bounds.size / 2 < bounds.width / 2 ? 'left' : 'right'
    return { petDockSide: side, petHiddenX: Math.round(side === 'left' ? -bounds.size / 2 : bounds.width - bounds.size / 2) }
  },
  getBubbleSizeLimits() {
    const bounds = this.getPetBounds(false)
    return {
      minWidth: Math.min(270, bounds.width - 16),
      maxWidth: Math.max(250, bounds.width - 16),
      minHeight: Math.min(220, bounds.height - 16),
      maxHeight: Math.max(190, Math.min(bounds.height * 0.72, bounds.height - 16)),
      bounds,
    }
  },
  clampBubbleSize(width, height) {
    const limits = this.getBubbleSizeLimits()
    const fallbackWidth = Math.min(limits.maxWidth, limits.bounds.width - 42)
    const fallbackHeight = Math.min(limits.maxHeight, 330)
    return {
      width: Math.round(Math.max(limits.minWidth, Math.min(limits.maxWidth, Number(width) || fallbackWidth))),
      height: Math.round(Math.max(limits.minHeight, Math.min(limits.maxHeight, Number(height) || fallbackHeight))),
    }
  },
  getBubbleLayout(petX = this.data.petX, petY = this.data.petY, width = this.data.bubbleWidth, height = this.data.bubbleHeight) {
    const bounds = this.getPetBounds(false)
    const size = this.clampBubbleSize(width, height)
    const petCenterX = Number(petX) + bounds.size / 2
    const left = Math.max(8, Math.min(bounds.width - size.width - 8, petCenterX - size.width / 2))
    const aboveSpace = Math.max(0, Number(petY) - 12)
    const belowSpace = Math.max(0, bounds.height - Number(petY) - bounds.size - 12)
    const placement = aboveSpace >= belowSpace ? 'above' : 'below'
    const top = placement === 'above'
      ? Math.max(8, Number(petY) - size.height - 12)
      : Math.min(bounds.height - size.height - 8, Number(petY) + bounds.size + 12)
    return {
      bubbleX: Math.round(left), bubbleY: Math.round(top), bubbleWidth: size.width, bubbleHeight: size.height,
      bubbleTailX: Math.round(Math.max(30, Math.min(size.width - 30, petCenterX - left))), bubblePlacement: placement,
    }
  },
  initPetPosition() {
    const bounds = this.getPetBounds(false)
    let saved = null
    let bubble = null
    let hidden = false
    try { saved = wx.getStorageSync(PET_POSITION_KEY) } catch (error) { saved = null }
    try { bubble = wx.getStorageSync(PET_BUBBLE_SIZE_KEY) } catch (error) { bubble = null }
    try { hidden = Boolean(wx.getStorageSync(PET_HIDDEN_KEY)) } catch (error) { hidden = false }
    const x = saved && Number.isFinite(Number(saved.xRatio)) ? bounds.minX + Number(saved.xRatio) * (bounds.maxX - bounds.minX) : bounds.maxX
    const y = saved && Number.isFinite(Number(saved.yRatio)) ? bounds.minY + Number(saved.yRatio) * (bounds.maxY - bounds.minY) : Math.max(bounds.minY, bounds.maxY - Math.round(bounds.width * 96 / 750))
    const next = this.clampPetPosition(x, y, false)
    const bubbleSize = this.clampBubbleSize(bubble?.width, bubble?.height)
    this.setData({
      petX: Math.round(next.x), petY: Math.round(next.y), petHidden: hidden,
      ...this.getHiddenPetState(next.x), ...this.getBubbleLayout(next.x, next.y, bubbleSize.width, bubbleSize.height),
    })
  },
  fitPetToBounds(dayOpen = this.data.dayOpen) {
    const next = this.clampPetPosition(this.data.petX, this.data.petY, dayOpen)
    this.setData({ petX: Math.round(next.x), petY: Math.round(next.y), ...this.getHiddenPetState(next.x), ...this.getBubbleLayout(next.x, next.y) })
  },
  saveBubbleSize() {
    try { wx.setStorageSync(PET_BUBBLE_SIZE_KEY, { width: this.data.bubbleWidth, height: this.data.bubbleHeight }) } catch (error) {}
  },
  savePetPosition() {
    const bounds = this.getPetBounds(false)
    const xRange = Math.max(1, bounds.maxX - bounds.minX)
    const yRange = Math.max(1, bounds.maxY - bounds.minY)
    const position = this.clampPetPosition(this.data.petX, this.data.petY, false)
    try {
      wx.setStorageSync(PET_POSITION_KEY, {
        xRatio: Math.max(0, Math.min(1, (position.x - bounds.minX) / xRange)),
        yRatio: Math.max(0, Math.min(1, (position.y - bounds.minY) / yRange)),
      })
    } catch (error) {}
  },
  startPetDrag(event) {
    if (this.data.petHidden) return
    const touch = event.touches?.[0]
    if (!touch) return
    this._petDrag = {
      startX: touch.clientX,
      startY: touch.clientY,
      offsetX: touch.clientX - this.data.petX,
      offsetY: touch.clientY - this.data.petY,
      moved: false,
    }
    this.setData({ petDragging: true }, () => this.refreshPetMood())
  },
  movePet(event) {
    const touch = event.touches?.[0]
    if (!touch || !this._petDrag) return
    const distance = Math.hypot(touch.clientX - this._petDrag.startX, touch.clientY - this._petDrag.startY)
    if (distance > 4) this._petDrag.moved = true
    const next = this.clampPetPosition(touch.clientX - this._petDrag.offsetX, touch.clientY - this._petDrag.offsetY)
    this.setData({ petX: Math.round(next.x), petY: Math.round(next.y), ...this.getHiddenPetState(next.x), ...this.getBubbleLayout(next.x, next.y) })
  },
  endPetDrag() {
    const moved = Boolean(this._petDrag?.moved)
    this._petDrag = null
    this.setData({ petDragging: false }, () => this.refreshPetMood())
    if (!moved) return
    this._petSuppressTap = true
    clearTimeout(this._petTapTimer)
    this._petTapTimer = setTimeout(() => { this._petSuppressTap = false }, 320)
    this.savePetPosition()
  },
  startHiddenPetDrag(event) {
    const touch = event.touches?.[0]
    if (!touch) return
    this._petHiddenDrag = {
      startX: touch.clientX,
      startY: touch.clientY,
      offsetY: touch.clientY - this.data.petY,
      moved: false,
    }
    this.setData({ petDragging: true }, () => this.refreshPetMood())
  },
  moveHiddenPet(event) {
    const touch = event.touches?.[0]
    if (!touch || !this._petHiddenDrag) return
    const distance = Math.hypot(touch.clientX - this._petHiddenDrag.startX, touch.clientY - this._petHiddenDrag.startY)
    if (distance > 4) this._petHiddenDrag.moved = true
    const bounds = this.getPetBounds(false)
    const side = touch.clientX < bounds.width / 2 ? 'left' : 'right'
    const y = Math.max(bounds.minY, Math.min(bounds.maxY, touch.clientY - this._petHiddenDrag.offsetY))
    const petX = side === 'left' ? bounds.minX : bounds.maxX
    this.setData({
      petX: Math.round(petX),
      petY: Math.round(y),
      petDockSide: side,
      petHiddenX: Math.round(side === 'left' ? -bounds.size / 2 : bounds.width - bounds.size / 2),
      petDragging: true,
    })
  },
  endHiddenPetDrag(event) {
    const finalTouch = event?.changedTouches?.[0]
    const moved = Boolean(this._petHiddenDrag?.moved || (finalTouch && this._petHiddenDrag
      && Math.hypot(finalTouch.clientX - this._petHiddenDrag.startX, finalTouch.clientY - this._petHiddenDrag.startY) > 4))
    this._petHiddenDrag = null
    this.setData({ petDragging: false }, () => this.refreshPetMood())
    if (!moved) return
    this._hiddenDragSuppressTap = true
    clearTimeout(this._hiddenDragTapTimer)
    this._hiddenDragTapTimer = setTimeout(() => { this._hiddenDragSuppressTap = false }, 320)
    this.savePetPosition()
  },
  startBubbleResize(event) {
    const touch = event.touches?.[0]
    if (!touch) return
    this._bubbleResize = { startX: touch.clientX, startY: touch.clientY, width: this.data.bubbleWidth, height: this.data.bubbleHeight }
    this.setData({ bubbleResizing: true })
  },
  resizeBubble(event) {
    const touch = event.touches?.[0]
    if (!touch || !this._bubbleResize) return
    const size = this.clampBubbleSize(
      this._bubbleResize.width + touch.clientX - this._bubbleResize.startX,
      this._bubbleResize.height + touch.clientY - this._bubbleResize.startY,
    )
    this.setData(this.getBubbleLayout(this.data.petX, this.data.petY, size.width, size.height))
  },
  endBubbleResize() {
    if (!this._bubbleResize) return
    this._bubbleResize = null
    this.setData({ bubbleResizing: false })
    this.saveBubbleSize()
  },
  stopPetEvent() {},
  hidePet() {
    clearTimeout(this._petTapTimer)
    this._petDrag = null
    this._petSuppressTap = false
    try { wx.setStorageSync(PET_HIDDEN_KEY, true) } catch (error) {}
    this.setData({ petOpen: false, petDragging: false, petHidden: true, ...this.getHiddenPetState() }, () => this.refreshPetMood())
  },
  showPet() {
    if (this._hiddenDragSuppressTap) return
    try { wx.setStorageSync(PET_HIDDEN_KEY, false) } catch (error) {}
    this.setData({ petHidden: false, petDragging: false }, () => this.refreshPetMood())
  },
  togglePet() {
    if (this._petSuppressTap) return
    if (this.data.petHidden) return this.showPet()
    this.setData({ petOpen: !this.data.petOpen, dayOpen: false, petError: '' }, () => {
      this.fitPetToBounds(false)
      this.refreshPetMood()
    })
  },
  closePet() { this.setData({ petOpen: false }, () => this.refreshPetMood()) },
  inputPet(event) { this.setData({ petInput: event.detail.value.slice(0, 1200), petError: '' }, () => this.refreshPetMood()) },
  async sendPet(event) {
    if (this.data.petBusy) return
    const prompt = String(event?.currentTarget?.dataset?.prompt || this.data.petInput || '').trim()
    if (!prompt) return
    const previous = this.data.petMessages.slice(-18)
    const messages = [...previous, { role: 'user', content: prompt }]
    this.setData({ petInput: '', petBusy: true, petError: '', petCelebrating: false, petMessages: messages, petResult: { questions: [], planDrafts: [] }, petApplied: false }, () => this.refreshPetMood())
    try {
      const payload = await api.request('/api/agent', { method: 'POST', data: { message: prompt, messages: previous, calendar: agentCalendarContext(this), stream: false } })
      const reply = payload.reply || '我已经看过你的日历了。'
      this.setData({ petMessages: [...messages, { role: 'assistant', content: reply }].slice(-20), petResult: payload })
      if (payload.planDrafts?.length) this.celebratePet()
    } catch (error) { this.setData({ petError: error.message || '小Y 暂时没有回应，请稍后重试' }) }
    finally { this.setData({ petBusy: false }, () => this.refreshPetMood()) }
  },
  applyPetPlans() {
    const drafts = this.data.petResult?.planDrafts || []
    if (!drafts.length || this.data.petApplied) return
    const createdAt = new Date().toISOString()
    const plans = drafts.map((draft, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`, title: draft.title, goal: draft.goal || '', dailyTask: draft.dailyTask || draft.title,
      start: draft.start, end: draft.end, weekdays: Array.isArray(draft.weekdays) ? draft.weekdays : [1, 2, 3, 4, 5],
      type: draft.type === 'work' ? 'work' : 'study', planType: draft.type === 'work' ? 'work' : 'study', createdAt,
    }))
    app.updateSnapshot((snapshot) => ({ ...snapshot, plans: [...snapshot.plans, ...plans] }))
    this.setData({ petApplied: true }); this.celebratePet(); this.refreshView(); wx.showToast({ title: '已写入规划中心', icon: 'success' })
  },
})
