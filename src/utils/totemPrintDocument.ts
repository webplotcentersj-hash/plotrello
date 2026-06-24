import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { copyPdfBytes } from './pdfTextLines'

let workerConfigured = false

function ensureWorker(): void {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  workerConfigured = true
}

export type PrintFormat = 'A4' | 'A3'
export type PrintColorMode = 'color' | 'bw'

export type PrintDocumentKind = 'pdf' | 'image' | 'unknown'

export function parseTipoImpresion(tipo: string): { format: PrintFormat; color: PrintColorMode } {
  const t = String(tipo || '').toLowerCase()
  const format: PrintFormat = t.includes('a3') ? 'A3' : 'A4'
  const color: PrintColorMode =
    t.includes('blanco') || t.includes('negro') || t.includes('b/n') || t.includes('bn') ? 'bw' : 'color'
  return { format, color }
}

export function aspectRatioForFormat(format: PrintFormat): number {
  return format === 'A3' ? 297 / 420 : 210 / 297
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

export async function buildPrintDocumentPreview(
  source: string,
  maxThumbWidth = 320,
  maxThumbs = 4
): Promise<{ kind: PrintDocumentKind; pageCount: number; previews: string[] }> {
  const buffer = await loadFileBytes(source)
  const kind = detectKindFromSource(source, buffer)

  if (kind === 'image') {
    const url = source.startsWith('data:') || source.startsWith('http') ? source : null
    if (!url && buffer) {
      const blob = new Blob([buffer])
      const obj = URL.createObjectURL(blob)
      return { kind: 'image', pageCount: 1, previews: [obj] }
    }
    if (!url) return { kind: 'unknown', pageCount: 1, previews: [] }
    return { kind: 'image', pageCount: 1, previews: [url] }
  }

  if (kind === 'pdf' && buffer) {
    const pageCount = await countPdfPages(buffer)
    const thumbs = Math.min(pageCount, maxThumbs)
    const previews: string[] = []
    for (let p = 1; p <= thumbs; p++) {
      previews.push(await renderPdfPagePreview(buffer, p, maxThumbWidth))
    }
    return { kind: 'pdf', pageCount, previews }
  }

  return { kind: 'unknown', pageCount: 1, previews: [] }
}
