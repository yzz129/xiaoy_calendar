const SHARE_IMAGE_URL = '/assets/app-icon.png'
const CALENDAR_PATH = '/pages/calendar/calendar'

function enableShareMenu() {
  if (typeof wx.showShareMenu !== 'function') return
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline'],
    fail() {},
  })
}

function appMessage({ title = '小Y日历｜你的日历与规划搭子', path = CALENDAR_PATH } = {}) {
  return { title, path, imageUrl: SHARE_IMAGE_URL }
}

function timeline({ title = '小Y日历｜你的日历与规划搭子', query = '' } = {}) {
  return { title, query, imageUrl: SHARE_IMAGE_URL }
}

module.exports = {
  CALENDAR_PATH,
  enableShareMenu,
  appMessage,
  timeline,
}
