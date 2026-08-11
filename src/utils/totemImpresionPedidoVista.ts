import { parseTotemArchivoManifest, type TotemArchivoItem } from './totemArchivoManifest'
import { labelTotemPrintPapel, type TotemPrintPapelId } from './totemPrintPapel'
import type { PrintFormat, TotemPrintColorModo, TotemPrintFaz } from './totemPrintDocument'
import { labelPrintFormat, parseTipoImpresion } from './totemPrintDocument'

export type TotemImpresionDetalle = {
  formato_impresion?: string | null
  papel_impresion?: string | null
  faz_impresion?: string | null
  modo_color?: string | null
  color_pages?: number | null
  bw_pages?: number | null
  descripcion?: string | null
  tipo_impresion?: string | null
  archivo_url?: string | null
  archivo_nombre?: string | null
  cantidad_hojas?: number | null
  origen_archivo?: string | null
  valor_total?: number | null
  cliente_nombre?: string | null
  cliente_dni?: string | null
  cliente_telefono?: string | null
}

export type TotemImpresionPedidoVista = {
  formato: PrintFormat
  papelId: TotemPrintPapelId | null
  papelLabel: string | null
  faz: TotemPrintFaz
  modoColor: TotemPrintColorModo
  esBlancoNegro: boolean
  colorPages: number | null
  bwPages: number | null
  descripcion: string | null
  tipoLabel: string
  archivos: TotemArchivoItem[]
}

function asDetalle(raw: unknown): TotemImpresionDetalle | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as TotemImpresionDetalle
}

function parseFormato(raw: string | null | undefined, tipo: string): PrintFormat {
  const f = String(raw || '').toUpperCase()
  if (f === 'A3E' || f.includes('EXTEND')) return 'A3E'
  if (f === 'A3') return 'A3'
  if (f === 'A4') return 'A4'
  return parseTipoImpresion(tipo).format
}

function parseFaz(raw: string | null | undefined, tipo: string): TotemPrintFaz {
  const t = `${raw || ''} ${tipo}`.toLowerCase()
  return t.includes('doble') ? 'doble' : 'simple'
}

function parseModoColor(
  raw: string | null | undefined,
  tipo: string,
  colorPages: number | null,
  bwPages: number | null
): TotemPrintColorModo {
  const m = String(raw || '').toLowerCase()
  if (m === 'bn' || m === 'b/n' || m === 'bw') return 'bn'
  if (m === 'color') return 'color'
  if (m === 'auto') return 'auto'
  const tipoL = tipo.toLowerCase()
  if (tipoL.includes('mixto')) return 'auto'
  if (tipoL.includes('blanco') || tipoL.includes('negro') || tipoL.includes('b/n')) return 'bn'
  if (colorPages != null && bwPages != null) {
    if (colorPages > 0 && bwPages > 0) return 'auto'
    if (bwPages > 0 && colorPages === 0) return 'bn'
    if (colorPages > 0 && bwPages === 0) return 'color'
  }
  return parseTipoImpresion(tipo).color === 'bw' ? 'bn' : 'color'
}

function parsePapel(raw: string | null | undefined): TotemPrintPapelId | null {
  const v = String(raw || '').trim()
  if (!v) return null
  const known: TotemPrintPapelId[] = [
    'obra_80',
    'obra_120',
    'obra_180',
    'obra_240',
    'ilust_115',
    'ilust_170',
    'ilust_300',
    'ilust_350',
    'adh_ilust',
    'adh_obra',
    'esp_texturado',
    'esp_metalizado',
    'esp_perlado'
  ]
  if ((known as string[]).includes(v)) return v as TotemPrintPapelId
  return null
}

function extractNotas(tipo: string, detalleDescripcion?: string | null): string | null {
  if (detalleDescripcion?.trim()) return detalleDescripcion.trim()
  const m = tipo.match(/\|\s*Notas:\s*(.+)$/i)
  return m?.[1]?.trim() || null
}

export function resolveTotemImpresionPedidoVista(params: {
  tipo_impresion: string
  archivo_url: string
  archivo_nombre?: string | null
  detalle?: unknown
}): TotemImpresionPedidoVista {
  const d = asDetalle(params.detalle)
  const tipo = String(d?.tipo_impresion || params.tipo_impresion || '').trim()
  const formato = parseFormato(d?.formato_impresion, tipo)
  const papelId = parsePapel(d?.papel_impresion)
  const faz = parseFaz(d?.faz_impresion, tipo)
  const colorPages = d?.color_pages != null ? Number(d.color_pages) : null
  const bwPages = d?.bw_pages != null ? Number(d.bw_pages) : null
  const modoColor = parseModoColor(d?.modo_color, tipo, colorPages, bwPages)
  const esBlancoNegro =
    modoColor === 'bn' || (modoColor === 'auto' && (bwPages ?? 0) > 0 && (colorPages ?? 0) === 0)

  const archivos = parseTotemArchivoManifest(String(d?.archivo_url || params.archivo_url || ''))
  if (archivos.files.length === 1 && !archivos.files[0].nombre && params.archivo_nombre) {
    archivos.files[0].nombre = String(params.archivo_nombre)
  }

  return {
    formato,
    papelId,
    papelLabel: papelId ? labelTotemPrintPapel(papelId) : d?.papel_impresion || null,
    faz,
    modoColor,
    esBlancoNegro,
    colorPages: Number.isFinite(colorPages as number) ? colorPages : null,
    bwPages: Number.isFinite(bwPages as number) ? bwPages : null,
    descripcion: extractNotas(tipo, d?.descripcion),
    tipoLabel: tipo || `${labelPrintFormat(formato)}`,
    archivos: archivos.files
  }
}

/** Descarga una imagen aplicando grayscale si el pedido es B/N. */
export async function openTotemArchivoParaImprimir(
  url: string,
  opts: { nombre?: string; forzarBn?: boolean }
): Promise<void> {
  const src = String(url || '').trim()
  if (!src) return

  const isImage = /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(src) || src.startsWith('data:image/')
  if (!opts.forzarBn || !isImage) {
    window.open(src, '_blank', 'noopener,noreferrer')
    return
  }

  try {
    const img = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      window.open(src, '_blank', 'noopener,noreferrer')
      return
    }
    ctx.filter = 'grayscale(1)'
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
    )
    if (!blob) {
      window.open(src, '_blank', 'noopener,noreferrer')
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    window.open(objectUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
  } catch {
    window.open(src, '_blank', 'noopener,noreferrer')
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}
