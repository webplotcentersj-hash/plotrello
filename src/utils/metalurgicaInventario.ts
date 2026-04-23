import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

export type MetalInvEstado = 'ok' | 'reparacion' | 'fuera' | 'baja'

export const METAL_INV_ESTADOS: { value: MetalInvEstado; label: string }[] = [
  { value: 'ok', label: 'OK' },
  { value: 'reparacion', label: 'En reparación' },
  { value: 'fuera', label: 'Fuera del pañol' },
  { value: 'baja', label: 'Baja' }
]

export type MetalInvItemRow = {
  id: number
  cantidad: number
  herramienta: string
  tipo_marca: string | null
  descripcion: string | null
  foto_url: string | null
  slot_pañol: string | null
  umbral_minimo: number
  created_at: string
  updated_at: string
  codigo_interno?: string | null
  estado?: MetalInvEstado | string | null
  prestado_a?: string | null
  fecha_prestamo?: string | null
  proveedor?: string | null
  fecha_compra?: string | null
  observaciones?: string | null
  fotos_urls?: unknown
  metadata?: unknown
}

export type MetalInvMovRow = {
  id: number
  herramienta_id: number | null
  herramienta_nombre: string
  cantidad_anterior: number | null
  cantidad_nueva: number | null
  usuario_nombre: string | null
  detalle: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

/** Lista de URLs de fotos válidas (principal = índice 0). */
export function parseFotosUrls(row: Pick<MetalInvItemRow, 'fotos_urls' | 'foto_url'>): string[] {
  const raw = row.fotos_urls
  if (Array.isArray(raw)) {
    return raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
  }
  if (row.foto_url && row.foto_url.trim()) return [row.foto_url.trim()]
  return []
}

export function primaryPhoto(row: Pick<MetalInvItemRow, 'fotos_urls' | 'foto_url'>): string | null {
  const urls = parseFotosUrls(row)
  return urls[0] ?? row.foto_url ?? null
}

/** Sincroniza foto_url (primera imagen) con el array para la base. */
export function syncFotoFieldsFromUrls(urls: string[]): {
  foto_url: string | null
  fotos_urls: string[]
} {
  const clean = urls.map((u) => u.trim()).filter(Boolean)
  return {
    foto_url: clean[0] ?? null,
    fotos_urls: clean
  }
}

export function normalizeMetalInvRow(raw: Record<string, unknown>): MetalInvItemRow {
  const base = raw as MetalInvItemRow
  const urls = parseFotosUrls(base)
  const synced = syncFotoFieldsFromUrls(urls)
  const est = base.estado
  const estadoNorm: MetalInvEstado =
    est === 'reparacion' || est === 'fuera' || est === 'baja' || est === 'ok' ? est : 'ok'

  return {
    ...base,
    estado: estadoNorm,
    fotos_urls: synced.fotos_urls,
    foto_url: synced.foto_url ?? base.foto_url ?? null,
    codigo_interno: base.codigo_interno ?? null,
    prestado_a: base.prestado_a ?? null,
    fecha_prestamo: base.fecha_prestamo ?? null,
    proveedor: base.proveedor ?? null,
    fecha_compra: base.fecha_compra ?? null,
    observaciones: base.observaciones ?? null
  }
}

/** Comprime JPEG/PNG/WebP grandes antes de subir a Storage. */
export async function compressMetalInvImage(file: File, maxSide = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < 350 * 1024) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.naturalWidth || img.width
      let h = img.naturalHeight || img.height
      if (w < 1 || h < 1) {
        resolve(file)
        return
      }
      if (w <= maxSide && h <= maxSide) {
        resolve(file)
        return
      }
      const ratio = Math.min(maxSide / w, maxSide / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

export function slugEstado(est: string | null | undefined): string {
  const e = (est || 'ok').toLowerCase()
  const found = METAL_INV_ESTADOS.find((x) => x.value === e)
  return found?.label ?? est ?? 'OK'
}

export type ExportMetalRow = MetalInvItemRow & { fotos_urls?: unknown }

export function exportMetalInvCsv(rows: ExportMetalRow[], filename = `metal-inv-${new Date().toISOString().slice(0, 10)}.csv`) {
  const cols = [
    'codigo_interno',
    'herramienta',
    'tipo_marca',
    'cantidad',
    'umbral_minimo',
    'estado',
    'slot_pañol',
    'proveedor',
    'fecha_compra',
    'prestado_a',
    'fecha_prestamo',
    'descripcion',
    'observaciones'
  ]
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v).replace(/"/g, '""')
    return `"${s}"`
  }
  const lines = [
    cols.join(','),
    ...rows.map((r) =>
      cols
        .map((c) =>
          esc(
            c === 'estado'
              ? slugEstado(r.estado as string)
              : (r as Record<string, unknown>)[c]
          )
        )
        .join(',')
    )
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportMetalInvXlsx(rows: ExportMetalRow[], filename = `metal-inv-${new Date().toISOString().slice(0, 10)}.xlsx`) {
  const flat = rows.map((r) => ({
    Codigo: r.codigo_interno ?? '',
    Herramienta: r.herramienta,
    Marca: r.tipo_marca ?? '',
    Cantidad: r.cantidad,
    Umbral: r.umbral_minimo,
    Estado: slugEstado(r.estado as string),
    Slot: r.slot_pañol ?? '',
    Proveedor: r.proveedor ?? '',
    FechaCompra: r.fecha_compra ?? '',
    PrestadoA: r.prestado_a ?? '',
    FechaPrestamo: r.fecha_prestamo ?? '',
    Descripcion: r.descripcion ?? '',
    Observaciones: r.observaciones ?? ''
  }))
  const ws = XLSX.utils.json_to_sheet(flat)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  XLSX.writeFile(wb, filename)
}

export function exportMetalInvPdf(rows: ExportMetalRow[], titulo = 'Inventario Metalúrgica · Pañol') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFontSize(14)
  doc.text(titulo, 14, 16)
  doc.setFontSize(8)
  let y = 24
  const lh = 4.2
  const maxY = 195

  for (const r of rows) {
    const line = [
      r.codigo_interno ? `[${r.codigo_interno}] ` : '',
      r.herramienta,
      ` · ${r.cantidad} u.`,
      r.tipo_marca ? ` · ${r.tipo_marca}` : '',
      r.slot_pañol ? ` · ${r.slot_pañol}` : '',
      ` · ${slugEstado(r.estado as string)}`
    ].join('')
    const wrapped = doc.splitTextToSize(line, 270)
    for (const wline of wrapped) {
      if (y > maxY) {
        doc.addPage()
        y = 14
      }
      doc.text(wline, 14, y)
      y += lh
    }
    y += 1
  }

  doc.save(`metal-inv-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function qrPayloadForTool(row: Pick<MetalInvItemRow, 'id' | 'codigo_interno' | 'herramienta'>): string {
  const code = row.codigo_interno?.trim() || `ID-${row.id}`
  return `PlotLab:MetalInv:${code}:${row.herramienta}`
}
