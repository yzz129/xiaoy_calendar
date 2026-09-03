const app = getApp()
const share = require('../../utils/share')

Page({
  onLoad() { share.enableShareMenu() },
  onShow() { app.applyTheme(this) },
  onShareAppMessage() {
    return share.appMessage({ title: '小Y日历｜隐私保护说明', path: '/pages/privacy/privacy' })
  },
  onShareTimeline() {
    return share.timeline({ title: '小Y日历｜隐私保护说明' })
  },
})
