const app = getApp()
const api = require('../../utils/api')

Page({
  data: { user: {}, isAdmin: false, form: { nickname: '', currentPassword: '', newPassword: '' }, saving: false },
  onShow() {
    const user = app.globalData.user || {}
    this.setData({ user, isAdmin: user.role === 'admin', form: { nickname: user.nickname || '', currentPassword: '', newPassword: '' } })
  },
  inputField(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }) },
  async saveProfile() {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const payload = await api.request('/api/account/profile', { method: 'PATCH', data: this.data.form })
      app.globalData.user = payload.user; wx.setStorageSync('xiaoy-calendar-miniprogram-user:v1', payload.user)
      this.setData({ user: payload.user, form: { nickname: payload.user.nickname, currentPassword: '', newPassword: '' } })
      wx.showToast({ title: '资料已保存', icon: 'success' })
    } catch (error) { wx.showToast({ title: error.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
  openAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }) },
  openPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  logout() {
    wx.showModal({ title: '退出登录', content: '本机登录状态将被清除，云端日历数据不会删除。', success: async (result) => {
      if (!result.confirm) return; await app.logout(); wx.reLaunch({ url: '/pages/login/login' })
    } })
  },
})
