const api = require('./utils/api')

const STORAGE_KEYS = {
  token: 'xiaoy-calendar-session-token:v1',
  user: 'xiaoy-calendar-miniprogram-user:v1',
  snapshot: 'xiaoy-calendar-miniprogram-snapshot:v1',
}

function emptySnapshot() {
  return {
    entries: {},
    notes: {},
    plans: [],
    planProgress: {},
    planTaskOverrides: {},
    planTypeDataVersion: 1,
    theme: 'light',
  }
}

function normalizeSnapshot(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    ...emptySnapshot(),
    ...source,
    entries: source.entries && typeof source.entries === 'object' ? source.entries : {},
    notes: source.notes && typeof source.notes === 'object' ? source.notes : {},
    plans: Array.isArray(source.plans) ? source.plans : [],
    planProgress: source.planProgress && typeof source.planProgress === 'object' ? source.planProgress : {},
    planTaskOverrides: source.planTaskOverrides && typeof source.planTaskOverrides === 'object'
      ? source.planTaskOverrides
      : {},
    planTypeDataVersion: 1,
  }
}

App({
  globalData: {
    user: null,
    snapshot: emptySnapshot(),
    syncReady: false,
  },

  onLaunch() {
    this.globalData.user = wx.getStorageSync(STORAGE_KEYS.user) || null
    this.globalData.snapshot = normalizeSnapshot(wx.getStorageSync(STORAGE_KEYS.snapshot))
  },

  hasSession() {
    return Boolean(wx.getStorageSync(STORAGE_KEYS.token))
  },

  async ensureSession() {
    if (!this.hasSession()) return null
    try {
      const payload = await api.request('/api/auth/session')
      this.globalData.user = payload.user
      wx.setStorageSync(STORAGE_KEYS.user, payload.user)
      if (!this.globalData.syncReady) await this.pullSnapshot()
      return payload.user
    } catch (error) {
      if (error.statusCode === 401) this.clearSession()
      throw error
    }
  },

  async login(nickname, password) {
    const payload = await api.request('/api/auth/login', {
      method: 'POST',
      data: { nickname, password },
      auth: false,
    })
    wx.setStorageSync(STORAGE_KEYS.token, payload.token)
    wx.setStorageSync(STORAGE_KEYS.user, payload.user)
    this.globalData.user = payload.user
    await this.pullSnapshot()
    return payload.user
  },

  async register(nickname, password) {
    const payload = await api.request('/api/auth/register', {
      method: 'POST',
      data: { nickname, password },
      auth: false,
    })
    wx.setStorageSync(STORAGE_KEYS.token, payload.token)
    wx.setStorageSync(STORAGE_KEYS.user, payload.user)
    this.globalData.user = payload.user
    await this.pullSnapshot()
    return payload.user
  },

  async pullSnapshot() {
    const payload = await api.request('/api/sync')
    if (payload.snapshot) {
      this.globalData.snapshot = normalizeSnapshot(payload.snapshot)
      wx.setStorageSync(STORAGE_KEYS.snapshot, this.globalData.snapshot)
    }
    this.globalData.syncReady = true
    return this.globalData.snapshot
  },

  updateSnapshot(updater) {
    const current = normalizeSnapshot(this.globalData.snapshot)
    const next = normalizeSnapshot(typeof updater === 'function' ? updater(current) : updater)
    this.globalData.snapshot = next
    wx.setStorageSync(STORAGE_KEYS.snapshot, next)
    this.scheduleSync()
    return next
  },

  scheduleSync() {
    clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => this.pushSnapshot(), 500)
  },

  async pushSnapshot() {
    if (!this.hasSession()) return
    try {
      await api.request('/api/sync', {
        method: 'POST',
        data: { snapshot: this.globalData.snapshot },
      })
    } catch (error) {
      console.warn('小Y日历云端同步暂时失败', error.message)
    }
  },

  async logout() {
    try {
      await api.request('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.warn('退出接口暂时不可用', error.message)
    }
    this.clearSession()
  },

  clearSession() {
    wx.removeStorageSync(STORAGE_KEYS.token)
    wx.removeStorageSync(STORAGE_KEYS.user)
    wx.removeStorageSync(STORAGE_KEYS.snapshot)
    this.globalData.user = null
    this.globalData.snapshot = emptySnapshot()
    this.globalData.syncReady = false
  },
})
