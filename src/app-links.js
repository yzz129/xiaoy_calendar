export const APK_DOWNLOAD_URL = 'https://calendar.yzzwnw.asia/downloads/xiaoy-calendar-1.9-109004.apk'
export const APK_DOWNLOAD_PAGE_URL = '/download/'

export const isNativeApp = () => window.Capacitor?.isNativePlatform?.() === true

export const isEmbeddedBrowser = () => /MicroMessenger|QQ\/|Weibo|DingTalk|AlipayClient/i.test(navigator.userAgent)

export const isAndroid = () => /Android/i.test(navigator.userAgent)

export const createAndroidBrowserIntent = (url) => {
  const parsed = new URL(url)
  const target = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
  const fallback = encodeURIComponent(url)

  return `intent://${target}#Intent;scheme=${parsed.protocol.replace(':', '')};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${fallback};end`
}
