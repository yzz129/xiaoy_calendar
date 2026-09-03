const app = getApp()
const share = require('../../utils/share')

Page({
  onLoad() { share.enableShareMenu() },
  onShow() { app.applyTheme(this) },
  onShareAppMessage() {
    return share.appMessage({ title: '小Y日历｜用户服务协议', path: '/pages/terms/terms' })
  },
  onShareTimeline() {
    return share.timeline({ title: '小Y日历｜用户服务协议' })
  },
})
