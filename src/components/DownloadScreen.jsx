import { useState } from 'react'
import { ArrowLeft, Check, Clipboard, Download, ExternalLink, ShieldCheck, Smartphone } from 'lucide-react'
import { APK_DOWNLOAD_URL, createAndroidBrowserIntent, isAndroid, isEmbeddedBrowser } from '../app-links'
import mascot from '../assets/illustrations/agent-celebrate.png'
import Logo from './Logo'

export default function DownloadScreen() {
  const [copied, setCopied] = useState(false)
  const [handoffBlocked, setHandoffBlocked] = useState(false)
  const embedded = isEmbeddedBrowser()
  const useBrowserIntent = embedded && isAndroid()
  const downloadTarget = useBrowserIntent ? createAndroidBrowserIntent(APK_DOWNLOAD_URL) : APK_DOWNLOAD_URL

  const openDownload = (event) => {
    if (!useBrowserIntent) return

    event.preventDefault()
    setHandoffBlocked(false)
    window.location.href = downloadTarget

    window.setTimeout(() => {
      if (!document.hidden) setHandoffBlocked(true)
    }, 1400)
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(APK_DOWNLOAD_URL)
    } catch {
      const input = document.createElement('textarea')
      input.value = APK_DOWNLOAD_URL
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="download-page">
      <section className="download-card" aria-labelledby="download-title">
        <div className="download-brand"><Logo /><span>Android 客户端</span></div>
        <div className="download-hero">
          <img src={mascot} alt="小Y Agent" />
          <div>
            <p>随时记录，云端同步</p>
            <h1 id="download-title">下载小Y日历</h1>
            <small>网页版与 Android APP 数据互通，安装后可从手机桌面直接使用。</small>
          </div>
        </div>

        {embedded ? (
          <div className="download-browser-tip" role="note">
            <ExternalLink />
            <span><strong>将自动尝试打开系统浏览器</strong><small>点击下方按钮即可跳转。如微信拦截跳转，请点右上角“…”选择“在浏览器打开”，或复制下载地址。</small></span>
          </div>
        ) : null}

        <a
          className="download-primary"
          href={downloadTarget}
          download={useBrowserIntent ? undefined : true}
          onClick={openDownload}
        >
          {useBrowserIntent ? <ExternalLink /> : <Download />}
          <span><strong>{useBrowserIntent ? '使用系统浏览器下载' : '下载最新版 APK'}</strong><small>约 13 MB · Android 8.0 及以上</small></span>
        </a>
        {handoffBlocked ? (
          <p className="download-handoff-status" role="status">微信阻止了自动跳转，请点右上角“…”选择“在浏览器打开”，或复制下方地址。</p>
        ) : null}
        <button className="download-copy" type="button" onClick={copyAddress}>
          {copied ? <Check /> : <Clipboard />}{copied ? '下载地址已复制' : '复制下载地址'}
        </button>

        <div className="download-features">
          <span><Smartphone /><strong>完整功能</strong><small>日历、工期、规划、便签与 Agent</small></span>
          <span><ShieldCheck /><strong>安全更新</strong><small>使用相同签名，可覆盖安装旧版本</small></span>
        </div>

        <a className="download-back" href="/"><ArrowLeft />返回小Y日历</a>
      </section>
    </main>
  )
}
