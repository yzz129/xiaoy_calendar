const app = getApp()
const api = require('../../utils/api')
const { buildAdaptivePalette, extractPaletteSeed } = require('../../utils/theme-palette')

const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_UPLOAD_BYTES = 900 * 1024
const MAX_ANALYSIS_BYTES = 280 * 1024

function chooseImage() {
  return new Promise((resolve, reject) => wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    sizeType: ['original'],
    success: (result) => resolve(result.tempFiles?.[0] || null),
    fail: (result) => (/cancel/i.test(result.errMsg || '') ? resolve(null) : reject(new Error(result.errMsg || '选择图片失败'))),
  }))
}

function getFileSize(filePath) {
  return new Promise((resolve, reject) => wx.getFileInfo({
    filePath,
    success: (result) => resolve(Number(result.size || 0)),
    fail: (result) => reject(new Error(result.errMsg || '无法读取图片大小')),
  }))
}

function getImageInfo(filePath) {
  return new Promise((resolve, reject) => wx.getImageInfo({
    src: filePath,
    success: resolve,
    fail: (result) => reject(new Error(result.errMsg || '无法识别图片')),
  }))
}

function compressImage(filePath, image, quality, maxWidth) {
  const scale = Math.min(1, maxWidth / Math.max(1, image.width))
  return new Promise((resolve, reject) => wx.compressImage({
    src: filePath,
    quality,
    compressedWidth: Math.max(1, Math.round(image.width * scale)),
    compressedHeight: Math.max(1, Math.round(image.height * scale)),
    success: (result) => resolve(result.tempFilePath),
    fail: (result) => reject(new Error(result.errMsg || '图片压缩失败')),
  }))
}

function readBase64(filePath) {
  return new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
    filePath,
    encoding: 'base64',
    success: (result) => resolve(result.data),
    fail: (result) => reject(new Error(result.errMsg || '图片读取失败')),
  }))
}

async function extractLocalPalette(filePath) {
  if (!wx.createOffscreenCanvas) return null
  try {
    const canvas = wx.createOffscreenCanvas({ type: '2d', width: 64, height: 64 })
    const context = canvas.getContext('2d')
    const image = canvas.createImage()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('本地配色分析失败'))
      image.src = filePath
    })
    context.drawImage(image, 0, 0, 64, 64)
    const seed = extractPaletteSeed(context.getImageData(0, 0, 64, 64))
    return seed ? buildAdaptivePalette(seed) : null
  } catch {
    return null
  }
}

function normalizeFocus(value) {
  const x = Number(value?.x ?? value?.focusX)
  const y = Number(value?.y ?? value?.focusY)
  return {
    x: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5,
    y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.45,
  }
}

async function prepareImage(file) {
  if (!file?.tempFilePath) throw new Error('没有读取到图片')
  const sourceSize = Number(file.size || await getFileSize(file.tempFilePath))
  if (!sourceSize || sourceSize > MAX_SOURCE_BYTES) throw new Error('请选择 15MB 以内的图片')
  const sourceInfo = await getImageInfo(file.tempFilePath)
  const sourceType = sourceInfo.type === 'png' ? 'image/png' : sourceInfo.type === 'webp' ? 'image/webp' : 'image/jpeg'
  let uploadPath = file.tempFilePath
  let uploadType = sourceInfo.type === 'png' ? 'image/png' : sourceInfo.type === 'webp' ? 'image/webp' : 'image/jpeg'
  let uploadSize = sourceSize

  if (uploadSize > 700 * 1024 || sourceInfo.width > 1600) {
    uploadPath = await compressImage(file.tempFilePath, sourceInfo, 72, 1440)
    uploadType = 'image/jpeg'
    uploadSize = await getFileSize(uploadPath)
  }
  if (uploadSize > MAX_UPLOAD_BYTES) {
    uploadPath = await compressImage(file.tempFilePath, sourceInfo, 52, 1200)
    uploadType = 'image/jpeg'
    uploadSize = await getFileSize(uploadPath)
  }
  if (uploadSize > MAX_UPLOAD_BYTES) throw new Error('图片细节较多，请先适当裁剪后再上传')

  let analysisPath = await compressImage(file.tempFilePath, sourceInfo, 32, 640)
  if (await getFileSize(analysisPath) > MAX_ANALYSIS_BYTES) analysisPath = await compressImage(file.tempFilePath, sourceInfo, 18, 480)
  return {
    sourcePath: file.tempFilePath,
    sourceType,
    uploadPath,
    uploadType,
    width: sourceInfo.width,
    height: sourceInfo.height,
    analysisPath: await getFileSize(analysisPath) <= MAX_ANALYSIS_BYTES ? analysisPath : '',
  }
}

Page({
  data: {
    theme: 'light',
    fontTheme: 'cloud',
    surfaceOpacity: 88,
    skin: { enabled: false, revision: '', focusX: 0.5, focusY: 0.45, palette: null },
    paletteSwatches: [],
    previewPath: '',
    previewStyle: '',
    busy: false,
    status: '',
    fontClass: 'font-cloud',
    skinClass: '',
    skinStyle: '',
  },

  async onShow() {
    if (app.hasSession()) {
      try { await app.ensureSession({ maxAge: 5 * 60 * 1000 }) } catch { /* 使用本地主题 */ }
    }
    await this.refresh()
  },

  async refresh() {
    const snapshot = app.globalData.snapshot
    const previewPath = snapshot.skin?.enabled ? await app.ensureThemeSkin() : ''
    this.setData({
      theme: snapshot.theme || 'light',
      fontTheme: snapshot.fontTheme || 'cloud',
      surfaceOpacity: snapshot.surfaceOpacity || 88,
      skin: snapshot.skin || { enabled: false, revision: '', focusX: 0.5, focusY: 0.45, palette: null },
      paletteSwatches: snapshot.skin?.palette ? [snapshot.skin.palette.primary, snapshot.skin.palette.secondary, snapshot.skin.palette.blue] : [],
      previewPath,
      previewStyle: previewPath
        ? `background-image: url('${previewPath}'); background-position: ${snapshot.skin.focusX * 100}% ${snapshot.skin.focusY * 100}%; background-size: contain; background-repeat: no-repeat;`
        : '',
    })
    await app.applyTheme(this)
  },

  async selectFont(event) {
    const fontTheme = event.currentTarget.dataset.font === 'system' ? 'system' : 'cloud'
    if (fontTheme === 'cloud') await app.ensureBrandFontPreviews(true)
    app.updateSnapshot((snapshot) => ({ ...snapshot, fontTheme }))
    await app.pushSnapshot()
    await this.refresh()
    wx.showToast({ title: fontTheme === 'cloud' ? '已使用云朵体' : '已跟随系统字体', icon: 'none' })
  },

  async changeOpacity(event) {
    const surfaceOpacity = Math.round(Math.max(45, Math.min(100, Number(event.detail.value) || 88)))
    app.updateSnapshot((snapshot) => ({ ...snapshot, surfaceOpacity }))
    await app.pushSnapshot()
    await this.refresh()
    wx.showToast({ title: `内容透明度 ${surfaceOpacity}%`, icon: 'none' })
  },

  async selectBuiltInSkin(event) {
    const theme = event.currentTarget.dataset.theme === 'berry-night' ? 'berry-night' : 'light'
    app.setThemeSkinAsset('', '')
    app.updateSnapshot((snapshot) => ({ ...snapshot, theme, skin: { ...snapshot.skin, enabled: false } }))
    await app.pushSnapshot()
    await this.refresh()
    wx.showToast({ title: app.hasSession() ? '皮肤已同步' : '已保存到本机', icon: 'success' })
  },

  requireLogin() {
    if (app.hasSession()) return true
    wx.showModal({
      title: '登录后上传皮肤',
      content: '自定义图片需要登录，才能安全保存并同步到手机和电脑。',
      confirmText: '去登录',
      success: (result) => { if (result.confirm) wx.navigateTo({ url: '/pages/login/login' }) },
    })
    return false
  },

  async uploadSkin() {
    if (this.data.busy || !this.requireLogin()) return
    try {
      const file = await chooseImage()
      if (!file) return
      const draftSkin = { enabled: true, revision: 'local-preview', focusX: 0.5, focusY: 0.5, palette: null }
      this.setData({
        busy: true,
        status: '图片已显示，正在本机快速适配…',
        previewPath: file.tempFilePath,
        previewStyle: `background-image: url('${file.tempFilePath}'); background-position: 50% 50%; background-size: contain; background-repeat: no-repeat;`,
      })
      app.setThemeSkinDraft(file.tempFilePath, draftSkin, this.data.theme)
      await app.applyTheme(this)

      const prepared = await prepareImage(file)
      let focus = { x: 0.5, y: 0.45 }
      let adaptivePalette = await extractLocalPalette(prepared.analysisPath || prepared.uploadPath)
      if (!adaptivePalette) adaptivePalette = buildAdaptivePalette({ mode: this.data.theme === 'berry-night' ? 'dark' : 'light' })
      const draftTheme = adaptivePalette.mode === 'dark' ? 'berry-night' : 'light'
      app.setThemeSkinDraft(prepared.uploadPath, { ...draftSkin, palette: adaptivePalette }, draftTheme)
      this.setData({
        status: '本机预览与配色已生效，正在同步高清皮肤…',
        previewPath: prepared.uploadPath,
        previewStyle: `background-image: url('${prepared.uploadPath}'); background-position: 50% 45%; background-size: contain; background-repeat: no-repeat;`,
        paletteSwatches: [adaptivePalette.primary, adaptivePalette.secondary, adaptivePalette.blue],
      })
      await app.applyTheme(this)

      let aiAssisted = false
      const analysisPromise = (async () => {
        if (!prepared.analysisPath) return
        try {
          const base64 = await readBase64(prepared.analysisPath)
          const analysis = await api.request('/api/theme/analyze', {
            method: 'POST',
            data: { image: `data:image/jpeg;base64,${base64}`, width: prepared.width, height: prepared.height },
            timeout: 7000,
          })
          focus = normalizeFocus(analysis.focus)
          aiAssisted = true
        } catch { /* 免费模型忙碌时使用居中焦点 */ }
      })()

      const revision = `${Date.now()}`
      const query = `width=${prepared.width}&height=${prepared.height}&revision=${revision}`
      const [result] = await Promise.all([
        api.putFile(`/api/theme/skin?${query}`, prepared.uploadPath, prepared.uploadType, { timeout: 120000 }),
        analysisPromise,
      ])
      const nextRevision = result.revision || revision
      app.setThemeSkinAsset(prepared.uploadPath, nextRevision)
      app.clearThemeSkinDraft()
      app.updateSnapshot((snapshot) => ({
        ...snapshot,
        theme: adaptivePalette.mode === 'dark' ? 'berry-night' : 'light',
        skin: { enabled: true, revision: nextRevision, focusX: focus.x, focusY: focus.y, palette: adaptivePalette },
      }))
      await app.pushSnapshot()
      await this.refresh()
      this.setData({ busy: false, status: `${aiAssisted ? 'AI 取景' : '本机取景'}与配色已生效；壁纸原图正在后台归档…` })

      const sourceExtension = prepared.sourceType === 'image/png' ? 'png' : prepared.sourceType === 'image/webp' ? 'webp' : 'jpg'
      api.putFile(`/api/theme/original?filename=wallpaper.${sourceExtension}`, prepared.sourcePath, prepared.sourceType, { timeout: 600000 })
        .then(() => {
          if (app.globalData.snapshot.skin?.revision === nextRevision) this.setData({ status: '主题与壁纸原图已同步到三端' })
        })
        .catch(() => {
          if (app.globalData.snapshot.skin?.revision === nextRevision) this.setData({ status: '主题已生效；原图归档失败，请在网络稳定后重新上传' })
        })
    } catch (error) {
      app.clearThemeSkinDraft()
      await this.refresh()
      this.setData({ status: error.message || '图片处理失败，请换一张试试' })
      wx.showToast({ title: error.message || '图片处理失败', icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },

  async removeSkin() {
    if (this.data.busy) return
    this.setData({ busy: true, status: '正在移除自定义皮肤…' })
    try {
      await api.request('/api/theme/skin', { method: 'DELETE' })
      app.setThemeSkinAsset('', '')
      app.updateSnapshot((snapshot) => ({ ...snapshot, skin: { enabled: false, revision: '', focusX: 0.5, focusY: 0.45, palette: null } }))
      await app.pushSnapshot()
      this.setData({ status: '已恢复内置皮肤' })
      await this.refresh()
    } catch (error) { this.setData({ status: error.message || '移除失败' }) }
    finally { this.setData({ busy: false }) }
  },
})
