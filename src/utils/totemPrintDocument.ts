import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { copyPdfBytes } from './pdfTextLines'
import type { TotemPrintPapelId } from './totemPrintPapel'
import { labelTotemPrintPapel } from './totemPrintPapel'

let workerConfigured = false

function ensureWorker(): void {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  workerConfigured = true
}

export type PrintFormat = 'A4' | 'A3' | 'A3E'
export type PrintColorMode = 'color' | 'bw'
export type PrintColorDetection = PrintColorMode | 'mixed'

export type PrintDocumentKind = 'pdf' | 'image' | 'unknown'

export type PrintPagePreview = {
  previewUrl: string
  color: PrintColorMode
  label: string
  sourceIndex: number
  pageInSource: number
}

export type PrintDocumentAnalysis = {
  kind: PrintDocumentKind
  pageCount: number
  previews: PrintPagePreview[]
  colorDetection: PrintColorDetection
  colorPages: number
  bwPages: number
  /** Cantidad real de páginas por índice de archivo. */
  pageCountsBySource: number[]
}

export function labelPrintFormat(format: PrintFormat): string {
  if (format === 'A3E') return 'A3 extendido (32×45 cm)'
  return format
}

export function parseTipoImpresion(tipo: string): { format: PrintFormat; color: PrintColorMode } {
  const t = String(tipo || '').toLowerCase()
  const format: PrintFormat =
    t.includes('extend') || t.includes('a3e') || (t.includes('32') && t.includes('45'))
      ? 'A3E'
      : t.includes('a3')
        ? 'A3'
        : 'A4'
  const color: PrintColorMode =
    t.includes('blanco') || t.includes('negro') || t.includes('b/n') || t.includes('bn') ? 'bw' : 'color'
  return { format, color }
}

export function buildTipoImpresionLabel(
  format: PrintFormat,
  detection: PrintColorDetection,
  colorPages: number,
  bwPages: number
): string {
  const f = labelPrintFormat(format)
  if (detection === 'color') return `${f} - Color (detectado)`
  if (detection === 'bw') return `${f} - Blanco y negro (detectado)`
  return `${f} - Mixto (${colorPages} color, ${bwPages} B/N)`
}

/** Cómo cobrar color en el tótem: automático del archivo o forzar todo color / todo B/N. */
export type TotemPrintColorModo = 'auto' | 'color' | 'bn'
export type TotemPrintFaz = 'simple' | 'doble'

function withPapelLabel(base: string, papel?: TotemPrintPapelId | null): string {
  if (!papel) return base
  return `${base} · ${labelTotemPrintPapel(papel)}`
}

function withFazLabel(base: string, faz?: TotemPrintFaz | null): string {
  if (!faz) return base
  return `${base} · ${faz === 'doble' ? 'Doble faz' : 'Simple faz'}`
}

export function resolveTotemPrintColorQuote(params: {
  formato: PrintFormat
  modoColor: TotemPrintColorModo
  cantidadHojas: number
  papel?: TotemPrintPapelId | null
  faz?: TotemPrintFaz | null
  analysis?: Pick<PrintDocumentAnalysis, 'colorDetection' | 'colorPages' | 'bwPages'> | null
}): { tipo_impresion: string; color_pages: number; bw_pages: number } {
  const hojas = Math.max(1, Math.floor(params.cantidadHojas) || 1)
  const { formato, modoColor, analysis, papel, faz } = params

  const label = (base: string) => withFazLabel(withPapelLabel(base, papel), faz)

  if (modoColor === 'color') {
    return {
      tipo_impresion: label(`${labelPrintFormat(formato)} - Color`),
      color_pages: hojas,
      bw_pages: 0
    }
  }

  if (modoColor === 'bn') {
    return {
      tipo_impresion: label(`${labelPrintFormat(formato)} - Blanco y negro`),
      color_pages: 0,
      bw_pages: hojas
    }
  }

  if (analysis) {
    const tipo = label(
      buildTipoImpresionLabel(
        formato,
        analysis.colorDetection,
        analysis.colorPages,
        analysis.bwPages
      )
    )
    if (analysis.colorDetection === 'mixed') {
      return {
        tipo_impresion: tipo,
        color_pages: Math.max(0, analysis.colorPages),
        bw_pages: Math.max(0, analysis.bwPages)
      }
    }
    const esColor = analysis.colorDetection === 'color'
    return {
      tipo_impresion: tipo,
      color_pages: esColor ? hojas : 0,
      bw_pages: esColor ? 0 : hojas
    }
  }

  return {
    tipo_impresion: label(`${labelPrintFormat(formato)} - Color (detectado)`),
    color_pages: hojas,
    bw_pages: 0
  }
}

export function aspectRatioForFormat(format: PrintFormat): number {
  // A3 extendido típico Plot: 32 × 45 cm
  if (format === 'A3E') return 32 / 45
  if (format === 'A3') return 297 / 420
  return 210 / 297
}

function bytesToArrayBuffer(bytes: ArrayBuffer): ArrayBuffer {
  return bytes.slice(0)
}

export async function loadFileBytes(source: string): Promise<ArrayBuffer | null> {
  const src = String(source || '').trim()
  if (!src) return null

  if (src.startsWith('data:')) {
    const m = src.match(/^data:[^;]+;base64,(.+)$/i)
    if (!m) return null
    const bin = atob(m[1])
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out.buffer
  }

  if (src.startsWith('http://') || src.startsWith('https://')) {
    const resp = await fetch(src)
    if (!resp.ok) return null
    return bytesToArrayBuffer(await resp.arrayBuffer())
  }

  return null
}

export function detectKindFromSource(source: string, buffer?: ArrayBuffer | null): PrintDocumentKind {
  const src = String(source || '').trim().toLowerCase()
  if (src.startsWith('data:image/') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(src)) return 'image'
  if (src.startsWith('data:application/pdf') || /\.pdf(\?|$)/i.test(src)) return 'pdf'
  if (buffer && buffer.byteLength >= 4) {
    const head = new Uint8Array(buffer.slice(0, 4))
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf'
    if (head[0] === 0xff && head[1] === 0xd8) return 'image'
    if (head[0] === 0x89 && head[1] === 0x50) return 'image'
  }
  return 'unknown'
}

export async function countPdfPages(buffer: ArrayBuffer): Promise<number> {
  ensureWorker()
  const pdf = await pdfjsLib.getDocument({ data: copyPdfBytes(buffer) }).promise
  try {
    return pdf.numPages
  } finally {
    await pdf.destroy()
  }
}

export async function renderPdfPagePreview(
  buffer: ArrayBuffer,
  pageNumber: number,
  maxWidth: number
): Promise<string> {
  ensureWorker()
  const pdf = await pdfjsLib.getDocument({ data: copyPdfBytes(buffer) }).promise
  try {
    const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages))
    const viewport = page.getViewport({ scale: 1 })
    const scale = maxWidth / viewport.width
    const scaled = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(scaled.width)
    canvas.height = Math.floor(scaled.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    await page.render({ canvasContext: ctx, viewport: scaled }).promise
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    await pdf.destroy()
  }
}

const COLOR_DELTA_THRESHOLD = 22
const COLOR_PIXEL_RATIO = 0.007

export function detectColorFromImageData(data: Uint8ClampedArray): PrintColorMode {
  let colorPixels = 0
  let total = 0
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 16) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max - min > COLOR_DELTA_THRESHOLD) colorPixels++
    total++
  }
  if (total === 0) return 'bw'
  return colorPixels / total > COLOR_PIXEL_RATIO ? 'color' : 'bw'
}

export async function detectColorFromPreviewUrl(previewUrl: string): Promise<PrintColorMode> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const w = Math.min(220, img.naturalWidth || img.width)
      const h = Math.min(220, img.naturalHeight || img.height)
      canvas.width = Math.max(1, w)
      canvas.height = Math.max(1, h)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve('bw')
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(detectColorFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height).data))
    }
    img.onerror = () => resolve('bw')
    img.src = previewUrl
  })
}

function aggregateColorDetection(pages: PrintPagePreview[]): {
  colorDetection: PrintColorDetection
  colorPages: number
  bwPages: number
} {
  const colorPages = pages.filter((p) => p.color === 'color').length
  const bwPages = pages.length - colorPages
  let colorDetection: PrintColorDetection = 'bw'
  if (colorPages > 0 && bwPages > 0) colorDetection = 'mixed'
  else if (colorPages > 0) colorDetection = 'color'
  return { colorDetection, colorPages, bwPages }
}

async function analyzeSingleSource(
  source: string,
  fileName: string,
  sourceIndex: number,
  maxThumbWidth: number,
  maxThumbsPerFile: number
): Promise<{ kind: PrintDocumentKind; pages: PrintPagePreview[] }> {
  const buffer = await loadFileBytes(source)
  const kind = detectKindFromSource(source, buffer)
  const labelBase = fileName.trim() || `Archivo ${sourceIndex + 1}`

  if (kind === 'image') {
    const url = source.startsWith('data:') || source.startsWith('http') ? source : null
    let previewUrl = url
    if (!previewUrl && buffer) {
      const blob = new Blob([buffer])
      previewUrl = URL.createObjectURL(blob)
    }
    if (!previewUrl) return { kind: 'unknown', pages: [] }
    const color = await detectColorFromPreviewUrl(previewUrl)
    return {
      kind: 'image',
      pages: [{ previewUrl, color, label: labelBase, sourceIndex, pageInSource: 1 }]
    }
  }

  if (kind === 'pdf' && buffer) {
    const pageCount = await countPdfPages(buffer)
    const thumbs = Math.min(pageCount, maxThumbsPerFile)
    const pages: PrintPagePreview[] = []
    for (let p = 1; p <= thumbs; p++) {
      const previewUrl = await renderPdfPagePreview(buffer, p, maxThumbWidth)
      const color = await detectColorFromPreviewUrl(previewUrl)
      pages.push({
        previewUrl,
        color,
        label: pageCount > 1 ? `${labelBase} · pág. ${p}` : labelBase,
        sourceIndex,
        pageInSource: p
      })
    }
    return { kind: 'pdf', pages }
  }

  return { kind: 'unknown', pages: [] }
}

export async function analyzePrintSources(
  sources: Array<{ source: string; name?: string }>,
  maxThumbWidth = 400,
  maxThumbsPerFile = 5
): Promise<PrintDocumentAnalysis> {
  if (sources.length === 0) {
    return {
      kind: 'unknown',
      pageCount: 0,
      previews: [],
      colorDetection: 'bw',
      colorPages: 0,
      bwPages: 0,
      pageCountsBySource: []
    }
  }

  const allPages: PrintPagePreview[] = []
  const pageCountsBySource: number[] = []
  let kind: PrintDocumentKind = 'unknown'
  let pageCount = 0

  for (let i = 0; i < sources.length; i++) {
    const item = sources[i]
    const doc = await analyzeSingleSource(item.source, item.name || '', i, maxThumbWidth, maxThumbsPerFile)
    if (doc.kind !== 'unknown') kind = doc.kind
    allPages.push(...doc.pages)

    const buffer = await loadFileBytes(item.source)
    const k = detectKindFromSource(item.source, buffer)
    let filePages = 0
    if (k === 'image') filePages = 1
    else if (k === 'pdf' && buffer) filePages = await countPdfPages(buffer)
    else filePages = doc.pages.length
    pageCountsBySource.push(filePages)
    pageCount += filePages
  }

  const { colorDetection, colorPages, bwPages } = aggregateColorDetection(allPages)

  return {
    kind,
    pageCount: Math.max(pageCount, allPages.length, 1),
    previews: allPages,
    colorDetection,
    colorPages,
    bwPages,
    pageCountsBySource
  }
}

/** @deprecated Usar analyzePrintSources */
export async function buildPrintDocumentPreview(
  source: string,
  maxThumbWidth = 320,
  maxThumbs = 4
): Promise<{ kind: PrintDocumentKind; pageCount: number; previews: string[] }> {
  const doc = await analyzePrintSources([{ source }], maxThumbWidth, maxThumbs)
  return {
    kind: doc.kind,
    pageCount: doc.pageCount,
    previews: doc.previews.map((p) => p.previewUrl)
  }
}
