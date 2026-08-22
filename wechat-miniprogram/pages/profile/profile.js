const app = getApp()

Page({
  data: { user: {} },

  onShow() {
    this.setData({ user: app.globalData.user || {} })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '本机登录状态将被清除，云端日历数据不会删除。',
      success: async (result) => {
        if (!result.confirm) return
        await app.logout()
        wx.reLaunch({ url: '/pages/login/login' })
      },
    })
  },
})
