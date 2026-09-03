const app = getApp()
const share = require('../../utils/share')

Page({
  data: {
    mode: 'login',
    nickname: '',
    password: '',
    showPassword: false,
    agreed: false,
    busy: false,
    error: '',
  },

  onLoad() {
    share.enableShareMenu()
    if (app.hasSession()) wx.reLaunch({ url: '/pages/calendar/calendar' })
  },

  onShareAppMessage() {
    return share.appMessage()
  },

  onShareTimeline() {
    return share.timeline()
  },

  onShow() {
    app.applyTheme(this)
  },

  changeMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode, error: '' })
  },

  inputNickname(event) {
    this.setData({ nickname: event.detail.value.trimStart(), error: '' })
  },

  inputPassword(event) {
    this.setData({ password: event.detail.value, error: '' })
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed, error: '' })
  },

  experienceFirst() {
    wx.reLaunch({ url: '/pages/calendar/calendar' })
  },

  async submit() {
    if (this.data.busy) return
    if (!this.data.agreed) {
      this.setData({ error: '请先阅读并勾选同意《用户服务协议》和《隐私政策》' })
      return
    }
    const nickname = this.data.nickname.trim()
    const password = this.data.password
    this.setData({ busy: true, error: '' })
    try {
      if (this.data.mode === 'register') await app.register(nickname, password)
      else await app.login(nickname, password)
      wx.reLaunch({ url: '/pages/calendar/calendar' })
    } catch (error) {
      this.setData({ error: error.message || '操作失败，请稍后再试' })
    } finally {
      this.setData({ busy: false })
    }
  },
})
