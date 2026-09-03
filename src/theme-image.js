import { buildAdaptivePalette, extractPaletteSeed } from './theme-palette'

const MAX_SOURCE_EDGE = 2200
const ANALYSIS_EDGE = 640

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

async function loadBitmap(file) {
  if (globalThis.createImageBitmap) return createImageBitmap(file)
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片处理失败')), type, quality)
  })
}

function drawScaled(source, maxEdge) {
  const ratio = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * ratio))
  const height = Math.max(1, Math.round(source.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return { canvas, context, width, height }
}

async function detectFaceFocus(source) {
  if (!globalThis.FaceDetector) return null
  try {
    const faces = await new FaceDetector({ fastMode: true, maxDetectedFaces: 8 }).detect(source)
    if (!faces.length) return null
    const totalArea = faces.reduce((total, face) => total + face.boundingBox.width * face.boundingBox.height, 0)
    const weighted = faces.reduce((result, face) => {
      const area = face.boundingBox.width * face.boundingBox.height
      return {
        x: result.x + (face.boundingBox.x + face.boundingBox.width / 2) * area,
        y: result.y + (face.boundingBox.y + face.boundingBox.height * .42) * area,
      }
    }, { x: 0, y: 0 })
    return { x: weighted.x / totalArea / source.width, y: weighted.y / totalArea / source.height }
  } catch {
    return null
  }
}

function findSalientFocus(context, width, height) {
  const sampleWidth = Math.min(72, width)
  const sampleHeight = Math.min(72, height)
  const sample = document.createElement('canvas')
  sample.width = sampleWidth
  sample.height = sampleHeight
  const sampleContext = sample.getContext('2d', { alpha: false, willReadFrequently: true })
  sampleContext.drawImage(context.canvas, 0, 0, sampleWidth, sampleHeight)
  const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data
  let best = { score: -Infinity, x: .5, y: .45 }

  for (let y = 1; y < sampleHeight - 1; y += 1) {
    for (let x = 1; x < sampleWidth - 1; x += 1) {
      const index = (y * sampleWidth + x) * 4
      const left = index - 4
      const right = index + 4
      const top = index - sampleWidth * 4
      const bottom = index + sampleWidth * 4
      const edge = Math.abs(pixels[right] - pixels[left]) + Math.abs(pixels[right + 1] - pixels[left + 1])
        + Math.abs(pixels[bottom] - pixels[top]) + Math.abs(pixels[bottom + 1] - pixels[top + 1])
      const maxChannel = Math.max(pixels[index], pixels[index + 1], pixels[index + 2])
      const minChannel = Math.min(pixels[index], pixels[index + 1], pixels[index + 2])
      const saturation = maxChannel - minChannel
      const nx = x / (sampleWidth - 1)
      const ny = y / (sampleHeight - 1)
      const centerBias = 1 - Math.min(1, Math.hypot(nx - .5, ny - .44) / .72)
      const score = edge * .72 + saturation * .42 + centerBias * 115
      if (score > best.score) best = { score, x: nx, y: ny }
    }
  }
  return { x: best.x, y: best.y }
}

export function normalizeFocus(value, fallback = { x: .5, y: .45 }) {
  return {
    x: clamp(value?.x ?? value?.focusX ?? fallback.x),
    y: clamp(value?.y ?? value?.focusY ?? fallback.y),
  }
}

export async function prepareThemeImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择 JPG、PNG 或 WebP 图片')
  if (file.size > 15 * 1024 * 1024) throw new Error('原图不能超过 15MB')

  const source = await loadBitmap(file)
  const faceFocus = await detectFaceFocus(source)
  let processed = drawScaled(source, MAX_SOURCE_EDGE)
  const analysis = drawScaled(source, ANALYSIS_EDGE)
  const localFocus = faceFocus || findSalientFocus(analysis.context, analysis.width, analysis.height)
  const localPalette = buildAdaptivePalette(extractPaletteSeed(
    analysis.context.getImageData(0, 0, analysis.width, analysis.height),
  ))
  let blob = await canvasToBlob(processed.canvas, 'image/webp', .86)
  if (blob.size > 1.9 * 1024 * 1024) {
    processed = drawScaled(source, 1600)
    blob = await canvasToBlob(processed.canvas, 'image/webp', .78)
  }
  if (blob.size > 1.9 * 1024 * 1024) throw new Error('图片细节过多，请换一张或先适当裁剪')
  const analysisBlob = await canvasToBlob(analysis.canvas, 'image/jpeg', .76)
  const analysisDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('无法读取图片'))
    reader.readAsDataURL(analysisBlob)
  })
  source.close?.()
  return {
    blob,
    analysisDataUrl,
    width: processed.width,
    height: processed.height,
    localFocus: normalizeFocus(localFocus),
    localPalette,
  }
}
