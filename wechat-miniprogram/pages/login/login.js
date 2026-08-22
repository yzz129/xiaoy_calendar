const app = getApp()

Page({
  data: {
    mode: 'login',
    nickname: '',
    password: '',
    showPassword: false,
    busy: false,
    error: '',
  },

  onLoad() {
    if (app.hasSession()) wx.reLaunch({ url: '/pages/calendar/calendar' })
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

  async submit() {
    if (this.data.busy) return
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
