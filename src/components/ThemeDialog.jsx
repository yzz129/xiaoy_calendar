import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Layers3, LoaderCircle, Palette, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { authFetch } from '../auth'
import { normalizeFocus, prepareThemeImage } from '../theme-image'

const SKINS = [
  { id: 'light', name: '云朵晴空', note: '清新明亮', className: 'skin-light' },
  { id: 'berry-night', name: '莓果夜色', note: '柔和护眼', className: 'skin-night' },
]

export default function ThemeDialog({ settings, skinUrl, onChange, onPreviewSkin, onClose }) {
  const fileInputRef = useRef(null)
  const uploadSerialRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState(skinUrl || '')

  useEffect(() => {
    setPreviewUrl(skinUrl || '')
  }, [skinUrl])

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const uploadSkin = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const uploadSerial = ++uploadSerialRef.current
    const sourcePreviewUrl = URL.createObjectURL(file)
    setPreviewUrl((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
      return sourcePreviewUrl
    })
    onPreviewSkin?.({ source: file, focus: { x: .5, y: .5 }, palette: null })
    setBusy(true)
    setMessage('图片已显示，正在本机快速适配…')
    try {
      const prepared = await prepareThemeImage(file)
      let focus = prepared.localFocus
      let adaptivePalette = prepared.localPalette
      let aiAssisted = false
      const processedPreviewUrl = URL.createObjectURL(prepared.blob)
      setPreviewUrl((current) => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
        return processedPreviewUrl
      })
      onPreviewSkin?.({ source: prepared.blob, focus, palette: adaptivePalette })
      setMessage('本机预览与配色已生效，正在同步高清皮肤…')

      const analysisPromise = (async () => {
        const controller = new AbortController()
        const timer = window.setTimeout(() => controller.abort(), 7000)
        try {
          const analysisResponse = await authFetch('/api/theme/analyze', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: prepared.analysisDataUrl, width: prepared.width, height: prepared.height }),
          })
          const analysisPayload = await analysisResponse.json().catch(() => ({}))
          if (analysisResponse.ok) {
            focus = normalizeFocus(analysisPayload.focus, focus)
            aiAssisted = true
          }
        } catch {
          // 免费视觉模型忙碌时，继续使用设备端显著性与人脸检测结果。
        } finally {
          window.clearTimeout(timer)
        }
      })()

      const revision = `${Date.now()}`
      const [uploadResponse] = await Promise.all([
        authFetch(`/api/theme/skin?width=${prepared.width}&height=${prepared.height}&revision=${revision}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/webp' },
          body: prepared.blob,
        }),
        analysisPromise,
      ])
      const uploadPayload = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok) throw new Error(uploadPayload.error || '皮肤上传失败')
      onChange({
        theme: adaptivePalette.mode === 'dark' ? 'berry-night' : 'light',
        fontTheme: settings.fontTheme,
        skin: { enabled: true, revision: uploadPayload.revision || revision, focusX: focus.x, focusY: focus.y, palette: adaptivePalette },
      })
      setBusy(false)
      setMessage(`${aiAssisted ? 'AI 取景' : '本机取景'}与配色已生效；壁纸原图正在后台归档…`)

      authFetch(`/api/theme/original?filename=${encodeURIComponent(file.name || 'wallpaper')}`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      }).then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || '壁纸原图归档失败')
        if (uploadSerialRef.current === uploadSerial) setMessage('主题与壁纸原图已同步到三端')
      }).catch(() => {
        if (uploadSerialRef.current === uploadSerial) setMessage('主题已生效；原图归档失败，请在网络稳定后重新上传')
      })
    } catch (error) {
      onPreviewSkin?.(null)
      setMessage(error?.message || '图片处理失败，请换一张试试')
    } finally {
      setBusy(false)
    }
  }

  const removeSkin = async () => {
    setBusy(true)
    setMessage('正在移除自定义皮肤…')
    try {
      const response = await authFetch('/api/theme/skin', { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '移除失败')
      onPreviewSkin?.(null)
      setPreviewUrl('')
      onChange({ ...settings, skin: { enabled: false, revision: '', focusX: .5, focusY: .45, palette: null } })
      setMessage('已恢复内置皮肤')
    } catch (error) {
      setMessage(error?.message || '移除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="theme-dialog" role="dialog" aria-modal="true" aria-labelledby="theme-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section className="theme-card">
        <header className="theme-card-header">
          <span className="theme-card-icon"><Palette /></span>
          <span><strong id="theme-dialog-title">主题设置</strong><small>字体和皮肤会自动同步到手机、电脑和 PWA</small></span>
          <button type="button" onClick={onClose} disabled={busy} aria-label="关闭主题设置"><X /></button>
        </header>

        <div className="theme-section">
          <div className="theme-section-heading"><span><strong>选择字体</strong><small>决定整个应用的文字样式</small></span></div>
          <div className="font-theme-options" role="radiogroup" aria-label="字体主题">
            <button type="button" className={settings.fontTheme === 'cloud' ? 'selected' : ''} onClick={() => onChange({ ...settings, fontTheme: 'cloud' })} role="radio" aria-checked={settings.fontTheme === 'cloud'}>
              <span className="font-theme-label font-cloud-preview">云朵体</span><small>默认的手写云朵字体</small>{settings.fontTheme === 'cloud' ? <span className="theme-current"><Check />当前使用</span> : null}
            </button>
            <button type="button" className={`font-system-option ${settings.fontTheme === 'system' ? 'selected' : ''}`} onClick={() => onChange({ ...settings, fontTheme: 'system' })} role="radio" aria-checked={settings.fontTheme === 'system'}>
              <span className="font-theme-label">跟随系统字体</span><small>跟随当前主题字体</small>{settings.fontTheme === 'system' ? <span className="theme-current"><Check />当前使用</span> : null}
            </button>
          </div>
        </div>

        <div className="theme-section opacity-theme-section">
          <div className="theme-section-heading"><span><strong>内容透明度</strong><small>调整全部前景内容，只有背景图片保持不变</small></span><Layers3 /></div>
          <div className="opacity-control">
            <div className="opacity-value"><span>背景更突出</span><strong>{settings.surfaceOpacity}%</strong></div>
            <input
              type="range"
              min="45"
              max="100"
              step="1"
              value={settings.surfaceOpacity}
              onChange={(event) => onChange({ ...settings, surfaceOpacity: Number(event.target.value) })}
              aria-label="内容透明度"
              aria-valuetext={`${settings.surfaceOpacity}%`}
            />
            <div className="opacity-labels"><span>45% 通透</span><span>100% 实色</span></div>
          </div>
        </div>

        <div className="theme-section">
          <div className="theme-section-heading"><span><strong>选择皮肤</strong><small>选择内置配色，或上传自己的图片</small></span><Sparkles /></div>
          <div className="skin-options" role="radiogroup" aria-label="内置皮肤">
            {SKINS.map((skin) => (
              <button type="button" key={skin.id} className={`${skin.className} ${!settings.skin.enabled && settings.theme === skin.id ? 'selected' : ''}`} onClick={() => { onPreviewSkin?.(null); onChange({ ...settings, theme: skin.id, skin: { ...settings.skin, enabled: false } }) }} role="radio" aria-checked={!settings.skin.enabled && settings.theme === skin.id}>
                <span className="skin-swatch"><i /><b /></span><span><strong>{skin.name}</strong><small>{skin.note}</small></span>{!settings.skin.enabled && settings.theme === skin.id ? <span className="theme-current"><Check />当前使用</span> : null}
              </button>
            ))}
          </div>

          <div className={`custom-skin-panel ${settings.skin.enabled ? 'active' : ''}`}>
            <div className="custom-skin-preview" style={previewUrl ? { backgroundImage: `url("${previewUrl}")`, backgroundPosition: `${settings.skin.focusX * 100}% ${settings.skin.focusY * 100}%` } : undefined}>
              {!previewUrl ? <><ImagePlus /><span>图片预览</span></> : <span className="smart-crop-badge"><Sparkles />完整画面＋智能配色</span>}
            </div>
            <div className="custom-skin-copy"><strong>自定义图片皮肤</strong><span>选图立即预览，完整保留画面并智能匹配按钮、卡片和文字</span></div>
            {settings.skin.enabled && settings.skin.palette ? (
              <div className="adaptive-palette" aria-label="壁纸自适应配色">
                <span style={{ background: settings.skin.palette.primary }} /><span style={{ background: settings.skin.palette.secondary }} /><span style={{ background: settings.skin.palette.blue }} />
                <strong><Sparkles />自适应 UI 配色已启用</strong>
              </div>
            ) : null}
            <div className="custom-skin-actions">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}><Upload />{settings.skin.enabled ? '更换并智能适配' : '上传并智能适配'}</button>
              {settings.skin.enabled ? <button type="button" className="remove-skin" onClick={removeSkin} disabled={busy} aria-label="删除自定义皮肤"><Trash2 /></button> : null}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadSkin} hidden />
            </div>
            <small className="skin-help">上传图片 → AI 选取主体 → 本机按像素面积精准取色 → 生成清晰可读的 UI 主题 → 同步到三端。支持 JPG、PNG、WebP，最大 15MB。</small>
          </div>
          {message ? <p className={`theme-message ${busy ? 'busy' : ''}`} aria-live="polite">{busy ? <LoaderCircle /> : <Check />}{message}</p> : null}
        </div>
      </section>
    </div>
  )
}
