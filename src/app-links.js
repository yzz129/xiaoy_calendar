export const APK_DOWNLOAD_URL = 'https://calendar.yzzwnw.asia/downloads/xiaoy-calendar-latest.apk'
export const APK_DOWNLOAD_PAGE_URL = '/download/'

export const isNativeApp = () => window.Capacitor?.isNativePlatform?.() === true

export const isEmbeddedBrowser = () => /MicroMessenger|QQ\/|Weibo|DingTalk|AlipayClient/i.test(navigator.userAgent)
