const api = require('./utils/api')
const { normalizeAdaptivePalette, paletteOverlay, paletteStyleText } = require('./utils/theme-palette')

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
    fontTheme: 'cloud',
    surfaceOpacity: 88,
    skin: { enabled: false, revision: '', focusX: 0.5, focusY: 0.45, palette: null },
  }
}

function normalizeSnapshot(value) {
  const source = value && typeof value === 'object' ? value : {}
  const skin = source.skin && typeof source.skin === 'object' ? source.skin : {}
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
    theme: source.theme === 'berry-night' || source.theme === 'dark' ? 'berry-night' : 'light',
    fontTheme: source.fontTheme === 'system' ? 'system' : 'cloud',
    surfaceOpacity: Math.round(Math.max(45, Math.min(100, Number.isFinite(Number(source.surfaceOpacity)) ? Number(source.surfaceOpacity) : 88))),
    skin: {
      enabled: Boolean(skin.enabled && skin.revision),
      revision: String(skin.revision || '').replace(/[^\w.-]/g, '').slice(0, 40),
      focusX: Math.max(0, Math.min(1, Number.isFinite(Number(skin.focusX)) ? Number(skin.focusX) : 0.5)),
      focusY: Math.max(0, Math.min(1, Number.isFinite(Number(skin.focusY)) ? Number(skin.focusY) : 0.45)),
      palette: normalizeAdaptivePalette(skin.palette),
    },
    planTypeDataVersion: 1,
  }
}

const BRAND_FONTS = [
  ['XY Doodle', 'XY Doodle Preview', 'xy-doodle-full.woff', 'xy-doodle-miniprogram.woff'],
  ['XY Rounded', 'XY Rounded Preview', 'xy-rounded-full.woff', 'xy-rounded-miniprogram.woff'],
]

function loadFontFile(family, filename, quiet = false) {
  if (!wx.loadFontFace) return Promise.resolve(false)
  const origin = 'https://calendar.yzzwnw.asia/fonts'
  return new Promise((resolve) => wx.loadFontFace({
    family,
    source: `url("${origin}/${filename}?v=2.3.9")`,
    global: true,
    desc: { style: 'normal', weight: 'normal' },
    success: () => resolve(true),
    fail: (error) => {
      if (!quiet) console.warn(`${family} 字体加载失败`, error.errMsg || error)
      resolve(false)
    },
  }))
}

function loadBrandFontPreviews(quiet = false) {
  return Promise.all(BRAND_FONTS.map(([, previewFamily, , previewFile]) => loadFontFile(previewFamily, previewFile, quiet)))
    .then((results) => results.every(Boolean))
}

function loadBrandFontFulls() {
  return Promise.all(BRAND_FONTS.map(([family, , fullFile]) => loadFontFile(family, fullFile)))
    .then((results) => results.every(Boolean))
}

function loadBrandFonts() {
  // 小字库只用于全量字体下载完成前的首屏占位。页面实际使用的正式
  // family 必须绑定全量字库，否则长文本会永久混入系统回退字体。
  // 真机网络较慢时先完整等待两个轻量预览字库，再在后台加载全量字库。
  // 这样不会让 4—6MB 的全量文件抢占带宽，导致界面先回退到手机系统字体。
  return loadBrandFontPreviews().then((previewLoaded) => loadBrandFontFulls()
    .then((fullLoaded) => previewLoaded && fullLoaded))
}

const PET_ASSETS = [
  '/assets/pet/agent-focused.png',
  '/assets/pet/agent-thinking.png',
  '/assets/pet/agent-celebrate.png',
  '/assets/pet/agent-sleepy.png',
]

function preloadPetAssets() {
  if (!wx.getImageInfo) return Promise.resolve(false)
  return Promise.all(PET_ASSETS.map((src) => new Promise((resolve) => {
    wx.getImageInfo({ src, success: () => resolve(true), fail: () => resolve(false) })
  })))
}

App({
  globalData: {
    user: null,
    snapshot: emptySnapshot(),
    syncReady: false,
    sessionCheckedAt: 0,
    brandFontsReady: null,
    brandFontsLoaded: false,
    brandFontPreviewsReady: null,
    brandFontPreviewsLoaded: false,
    petAssetsReady: null,
    skinLocalPath: '',
    skinRevision: '',
    themeSkinDraft: null,
  },

  onLaunch() {
    this.globalData.user = wx.getStorageSync(STORAGE_KEYS.user) || null
    this.globalData.snapshot = normalizeSnapshot(wx.getStorageSync(STORAGE_KEYS.snapshot))
    this.globalData.brandFontPreviewsReady = this.ensureBrandFontPreviews()
    this.globalData.brandFontsReady = this.globalData.brandFontPreviewsReady.then((previewLoaded) => loadBrandFontFulls().then((fullLoaded) => {
      const loaded = previewLoaded && fullLoaded
      this.globalData.brandFontsLoaded = loaded
      return loaded
    }))
    this.globalData.petAssetsReady = preloadPetAssets()
  },

  ensureBrandFontPreviews(force = false) {
    if (!force && this.globalData.brandFontPreviewsLoaded) return Promise.resolve(true)
    if (!force && this.globalData.brandFontPreviewsReady) return this.globalData.brandFontPreviewsReady
    const request = loadBrandFontPreviews(!force).then((loaded) => {
      this.globalData.brandFontPreviewsLoaded = loaded
      return loaded
    })
    this.globalData.brandFontPreviewsReady = request
    return request
  },

  async ensureThemeSkin() {
    const skin = normalizeSnapshot(this.globalData.snapshot).skin
    if (!skin.enabled || !this.hasSession()) return ''
    if (this.globalData.skinRevision === skin.revision && this.globalData.skinLocalPath) return this.globalData.skinLocalPath
    try {
      const path = await api.download(`/api/theme/skin?revision=${encodeURIComponent(skin.revision)}`)
      this.globalData.skinRevision = skin.revision
      this.globalData.skinLocalPath = path
      return path
    } catch {
      return ''
    }
  },

  setThemeSkinAsset(path, revision) {
    this.globalData.skinLocalPath = path || ''
    this.globalData.skinRevision = revision || ''
  },

  setThemeSkinDraft(path, skin, theme) {
    this.globalData.themeSkinDraft = path ? { path, skin, theme } : null
  },

  clearThemeSkinDraft() {
    this.globalData.themeSkinDraft = null
  },

  async applyTheme(page) {
    if (!page?.setData) return
    const snapshot = normalizeSnapshot(this.globalData.snapshot)
    const draft = this.globalData.themeSkinDraft
    const effectiveSkin = draft?.skin || snapshot.skin
    const effectiveTheme = draft?.theme || snapshot.theme
    const skinPath = draft?.path || (snapshot.skin.enabled ? await this.ensureThemeSkin() : '')
    const night = effectiveTheme === 'berry-night'
    const overlay = paletteOverlay(effectiveSkin.palette) || (night ? 'rgba(8,25,42,.76), rgba(14,34,57,.88)' : 'rgba(255,255,255,.72), rgba(247,253,251,.84)')
    const contentAlpha = snapshot.surfaceOpacity / 100
    if (snapshot.fontTheme !== 'system') {
      this.ensureBrandFontPreviews().then((loaded) => {
        if (loaded && page?.setData) page.setData({ fontClass: 'font-cloud font-cloud-loaded' })
      })
    }
    const surfaceVars = `--content-opacity:${contentAlpha};${skinPath ? paletteStyleText(effectiveSkin.palette) : ''}`
    page.setData({
      theme: effectiveTheme,
      surfaceOpacity: snapshot.surfaceOpacity,
      fontClass: snapshot.fontTheme === 'system' ? 'font-system' : 'font-cloud',
      skinClass: skinPath ? 'skin-active' : '',
      skinStyle: `${skinPath
        ? `background-color: ${effectiveSkin.palette?.paper || (night ? '#0e2239' : '#f7f9f6')}; background-image: linear-gradient(${overlay}), url('${skinPath}'); background-position: center, ${effectiveSkin.focusX * 100}% ${effectiveSkin.focusY * 100}%; background-size: cover, contain; background-repeat: no-repeat;`
        : ''} ${surfaceVars}`,
    })
    wx.setNavigationBarColor({
      frontColor: night ? '#ffffff' : '#000000',
      backgroundColor: night ? '#0e2239' : '#f4fbff',
      animation: { duration: 180, timingFunc: 'easeIn' },
    })
  },

  applyThemeToCurrentPage() {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (page) this.applyTheme(page)
  },

  hasSession() {
    return Boolean(wx.getStorageSync(STORAGE_KEYS.token))
  },

  async ensureSession(options = {}) {
    if (!this.hasSession()) return null
    const maxAge = Number(options.maxAge ?? 60000)
    const cachedUser = this.globalData.user
    if (cachedUser && Date.now() - this.globalData.sessionCheckedAt < maxAge) {
      if (!this.globalData.syncReady) await this.pullSnapshot()
      return cachedUser
    }
    if (this.sessionPromise) return this.sessionPromise
    this.sessionPromise = (async () => {
      try {
        const payload = await api.request('/api/auth/session')
        this.globalData.user = payload.user
        this.globalData.sessionCheckedAt = Date.now()
        wx.setStorageSync(STORAGE_KEYS.user, payload.user)
        if (!this.globalData.syncReady) await this.pullSnapshot()
        return payload.user
      } catch (error) {
        if (error.statusCode === 401) this.clearSession()
        throw error
      } finally {
        this.sessionPromise = null
      }
    })()
    return this.sessionPromise
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
    this.globalData.sessionCheckedAt = Date.now()
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
    this.globalData.sessionCheckedAt = Date.now()
    await this.pullSnapshot()
    return payload.user
  },

  async pullSnapshot() {
    const payload = await api.request('/api/sync')
    if (payload.snapshot) {
      const nextSnapshot = normalizeSnapshot(payload.snapshot)
      if (nextSnapshot.skin.revision !== this.globalData.skinRevision) this.setThemeSkinAsset('', '')
      this.globalData.snapshot = nextSnapshot
      wx.setStorageSync(STORAGE_KEYS.snapshot, this.globalData.snapshot)
    }
    this.globalData.syncReady = true
    this.applyThemeToCurrentPage()
    return this.globalData.snapshot
  },

  updateSnapshot(updater) {
    const current = normalizeSnapshot(this.globalData.snapshot)
    const next = normalizeSnapshot(typeof updater === 'function' ? updater(current) : updater)
    this.globalData.snapshot = next
    wx.setStorageSync(STORAGE_KEYS.snapshot, next)
    this.scheduleSync()
    this.applyThemeToCurrentPage()
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
    this.globalData.sessionCheckedAt = 0
    this.setThemeSkinAsset('', '')
  },
})
