import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { copyPdfBytes } from './pdfTextLines'
import { etiquetaUnidadCorta, unidadDesdeDescripcionItem } from './unidadPrecio'

/** Planilla oficial en /public (diseño Plot Center). */
export const PRESUPUESTO_PLANILLA_URL = '/PRESUPUESTO.pdf'

/** Tamaño nativo de la planilla (pt). */
export const PLANILLA_W = 1080
export const PLANILLA_H = 1920

const MARGIN_X = 72
const CONTENT_TOP = 360
/** Límite del cuerpo: todo entra en 1 hoja, arriba del recuadro FORMAS DE PAGO. */
const CONTENT_BOTTOM = 1565
/** Primera línea de ítems dentro del recuadro FORMAS DE PAGO (plantilla 1080×1920). */
const FORMAS_PAGO_Y0 = 1600
const FORMAS_PAGO_X0 = 100
const FORMAS_PAGO_COL2 = 560
/** Separación vertical entre medios (compacta, sin amontonar). */
const FORMAS_PAGO_LINE = 20
const FORMAS_PAGO_BOX = 11
const ACCENT = { r: 234, g: 88, b: 12 }
const INK = { r: 15, g: 23, b: 42 }
const MUTED = { r: 71, g: 85, b: 105 }

export type PresupuestoPlanillaItem = {
  codigo?: string | null
  descripcion: string
  cantidad: number
  /** m2, m, un, hoja o kg. Si falta, se lee del final de la descripción o queda m2. */
  unidad?: string | null
  precio_unitario: number
  subtotal: number
}

export type PresupuestoPlanillaDesglose = {
  neto: number
  iva: number
  iva_porcentaje: number
  recargos?: Array<{ nombre: string; porcentaje: number; monto: number }>
}

export type PresupuestoPlanillaPayload = {
  numero: string
  fecha: string
  validez_hasta?: string | null
  cliente_nombre: string
  cliente_telefono?: string | null
  cliente_email?: string | null
  cliente_dni_cuit?: string | null
  cliente_empresa?: string | null
  cliente_direccion?: string | null
  lista_label?: string | null
  items: PresupuestoPlanillaItem[]
  total: number
  /** Si viene, el PDF muestra Subtotal / IVA / TOTAL. */
  desglose?: PresupuestoPlanillaDesglose | null
  notas?: string | null
  vendedor?: string | null
  /** Etiquetas de medios de pago a marcar en el recuadro FORMAS DE PAGO. */
  formas_pago?: string[] | null
}

/** Helvetica de jsPDF no soporta bien Unicode. */
export function pdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map: Record<string, string> = { Ñ: 'N', ñ: 'n' }
      return map[ch] ?? ''
    })
}

function formatArs(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/** m² no entra en Helvetica; en el PDF se escribe m2, m o un. */
function unidadEnPdf(item: PresupuestoPlanillaItem): string {
  const id = item.unidad?.trim()
    ? item.unidad
    : unidadDesdeDescripcionItem(item.descripcion) ?? 'm2'
  return pdfText(etiquetaUnidadCorta(id).replace('²', '2'))
}

function descripcionSinUnidad(descripcion: string): string {
  return descripcion.replace(/\s*\((?:m²|m2|m|un|hoja|kg)\)\s*$/i, '').trim()
}

let workerConfigured = false
function ensurePdfWorker() {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  workerConfigured = true
}

let fondoCache: Promise<string> | null = null

/** Renderiza la 1ª página de la planilla a JPEG (fondo). Se cachea en memoria. */
async function cargarFondoPlanilla(): Promise<string> {
  if (!fondoCache) {
    fondoCache = (async () => {
      ensurePdfWorker()
      const res = await fetch(`${window.location.origin}${PRESUPUESTO_PLANILLA_URL}`)
      if (!res.ok) throw new Error(`No se pudo cargar la planilla (${res.status})`)
      const buffer = await res.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: copyPdfBytes(buffer), verbosity: 0 }).promise
      const page = await pdf.getPage(1)
      // Escala alta para que el diseño se vea nítido al imprimir / zoom.
      const scale = 1.5
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo crear el canvas de la planilla')
      await page.render({ canvasContext: ctx, viewport }).promise
      return canvas.toDataURL('image/jpeg', 0.92)
    })().catch((err) => {
      fondoCache = null
      throw err
    })
  }
  return fondoCache
}

function pintarFondo(doc: jsPDF, fondo: string) {
  doc.addImage(fondo, 'JPEG', 0, 0, PLANILLA_W, PLANILLA_H)
}

/** Checklist de formas de pago: bien separadas dentro del recuadro de la planilla. */
function pintarFormasPago(doc: jsPDF, formas: string[]) {
  const labels = formas.map((f) => f.trim()).filter(Boolean)
  if (!labels.length) return

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.setDrawColor(INK.r, INK.g, INK.b)

  const half = Math.ceil(labels.length / 2)
  labels.forEach((label, i) => {
    const col = i < half ? 0 : 1
    const row = i < half ? i : i - half
    const x = col === 0 ? FORMAS_PAGO_X0 : FORMAS_PAGO_COL2
    const y = FORMAS_PAGO_Y0 + row * FORMAS_PAGO_LINE
    const box = FORMAS_PAGO_BOX
    doc.setLineWidth(1.2)
    doc.rect(x, y - box + 2, box, box, 'S')
    doc.setLineWidth(1.5)
    doc.line(x + 2, y - 3, x + 4.5, y + 1)
    doc.line(x + 4.5, y + 1, x + 9, y - 7)
    doc.text(pdfText(label), x + box + 8, y)
  })
}

/**
 * Genera el PDF de presupuesto sobre la planilla oficial PRESUPUESTO.pdf.
 * Una sola hoja: el cuerpo se comprime para no pasar al recuadro FORMAS DE PAGO.
 */
export async function buildPresupuestoPlanillaPdf(
  presupuesto: PresupuestoPlanillaPayload
): Promise<jsPDF> {
  const fondo = await cargarFondoPlanilla()
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: [PLANILLA_W, PLANILLA_H],
    compress: true
  })

  pintarFondo(doc, fondo)

  const right = PLANILLA_W - MARGIN_X
  const tableRight = right
  const colSub = tableRight
  const colUnit = tableRight - 145
  const colMedida = tableRight - 250
  const colCant = tableRight - 330
  const colDesc = MARGIN_X
  const colDescWidth = colCant - colDesc - 16

  const desglose = presupuesto.desglose
  const mostrarIva = Boolean(desglose && desglose.iva > 0.009)
  const recargos = (desglose?.recargos || []).filter((r) => r.monto > 0.009)
  const conIva = mostrarIva || recargos.length > 0
  const filasTotales =
    1 + (mostrarIva || recargos.length ? 1 : 0) + (mostrarIva ? 1 : 0) + recargos.length
  const blockH = Math.max(32, filasTotales * 14 + 12)

  const items = presupuesto.items.length
    ? presupuesto.items
    : [
        {
          descripcion: 'Consulta / a cotizar',
          cantidad: 1,
          precio_unitario: 0,
          subtotal: 0
        }
      ]

  const notasRaw = presupuesto.notas?.trim() || ''
  const tieneNotas = Boolean(notasRaw)
  // Reserva fija del pie del cuerpo (totales + notas cortas) para calcular alto de filas.
  const reserveFooter = blockH + 10 + (tieneNotas ? 28 : 0)
  const headerH = 20

  let y = CONTENT_TOP

  // Meta en una/dos líneas.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(pdfText(presupuesto.numero), right, y, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const metaParts = [`Fecha: ${presupuesto.fecha}`]
  if (presupuesto.validez_hasta) metaParts.push(`Valido: ${presupuesto.validez_hasta}`)
  if (presupuesto.vendedor) metaParts.push(`Asesor: ${presupuesto.vendedor}`)
  doc.text(pdfText(metaParts.join('  ·  ')), MARGIN_X, y)
  y += 12
  if (presupuesto.lista_label) {
    doc.text(pdfText(presupuesto.lista_label), right, y, { align: 'right' })
    y += 11
  } else {
    y += 4
  }

  // Cliente: nombre + una línea de contacto.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text('CLIENTE', MARGIN_X, y)
  y += 11

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(pdfText(presupuesto.cliente_nombre || '-'), MARGIN_X, y)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const contacto: string[] = []
  if (presupuesto.cliente_empresa) contacto.push(presupuesto.cliente_empresa)
  if (presupuesto.cliente_dni_cuit) contacto.push(`DNI/CUIT ${presupuesto.cliente_dni_cuit}`)
  if (presupuesto.cliente_telefono) contacto.push(presupuesto.cliente_telefono)
  if (presupuesto.cliente_email) contacto.push(presupuesto.cliente_email)
  if (presupuesto.cliente_direccion) contacto.push(presupuesto.cliente_direccion)
  if (contacto.length) {
    const line = doc.splitTextToSize(pdfText(contacto.join('  ·  ')), tableRight - MARGIN_X) as string[]
    doc.text(line.slice(0, 2), MARGIN_X, y)
    y += Math.min(line.length, 2) * 11
  }
  y += 6

  // Alto de fila: se ajusta para que ítems + totales + notas entren en la hoja.
  const espacioItems = Math.max(80, CONTENT_BOTTOM - y - headerH - 8 - reserveFooter)
  const rowH = Math.max(14, Math.min(20, Math.floor(espacioItems / items.length)))
  const maxDescLines = rowH >= 18 ? 2 : 1
  const itemFont = rowH >= 18 ? 10.5 : 9.5

  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.roundedRect(MARGIN_X - 8, y - 3, tableRight - MARGIN_X + 16, headerH, 5, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('Descripcion', colDesc, y + 10)
  doc.text('Cant.', colCant, y + 10, { align: 'right' })
  doc.text('Unidad', colMedida, y + 10, { align: 'right' })
  doc.text(conIva ? 'P. neto' : 'P. unit.', colUnit, y + 10, { align: 'right' })
  doc.text(conIva ? 'Neto' : 'Subtotal', colSub, y + 10, { align: 'right' })
  y += headerH + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(itemFont)
  doc.setTextColor(INK.r, INK.g, INK.b)

  for (const item of items) {
    if (y + rowH > CONTENT_BOTTOM - reserveFooter) break
    const titulo = item.codigo
      ? `${item.codigo} — ${descripcionSinUnidad(item.descripcion)}`
      : descripcionSinUnidad(item.descripcion)
    let lines = doc.splitTextToSize(pdfText(titulo), colDescWidth) as string[]
    if (lines.length > maxDescLines) {
      lines = lines.slice(0, maxDescLines)
      const last = lines[maxDescLines - 1]
      lines[maxDescLines - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : `${last}...`
    }

    doc.text(lines, colDesc, y + 9)
    doc.text(String(item.cantidad), colCant, y + 9, { align: 'right' })
    doc.text(unidadEnPdf(item), colMedida, y + 9, { align: 'right' })
    doc.text(formatArs(item.precio_unitario), colUnit, y + 9, { align: 'right' })
    doc.text(formatArs(item.subtotal), colSub, y + 9, { align: 'right' })
    y += rowH
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(MARGIN_X - 4, y - 1, tableRight + 4, y - 1)
  }

  // Totales pegados al final del cuerpo (siempre en hoja 1).
  y = Math.min(y + 4, CONTENT_BOTTOM - reserveFooter)

  const boxLeft = colUnit - 50
  const boxW = tableRight - boxLeft + 8
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(boxLeft, y - 4, boxW, blockH, 6, 6, 'F')

  let ty = y + 9
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  if (mostrarIva || recargos.length) {
    doc.setTextColor(203, 213, 225)
    doc.text('Subtotal', boxLeft + 12, ty)
    doc.text(formatArs(desglose!.neto), colSub - 8, ty, { align: 'right' })
    ty += 13

    for (const r of recargos) {
      doc.text(pdfText(`${r.nombre} (${r.porcentaje}%)`), boxLeft + 12, ty)
      doc.text(formatArs(r.monto), colSub - 8, ty, { align: 'right' })
      ty += 13
    }

    if (mostrarIva) {
      doc.text(pdfText(`IVA ${desglose!.iva_porcentaje}%`), boxLeft + 12, ty)
      doc.text(formatArs(desglose!.iva), colSub - 8, ty, { align: 'right' })
      ty += 13
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL', boxLeft + 12, ty)
  doc.setTextColor(255, 180, 120)
  doc.setFontSize(13)
  doc.text(formatArs(presupuesto.total), colSub - 8, ty, { align: 'right' })
  y += blockH + 6

  if (tieneNotas && y < CONTENT_BOTTOM - 16) {
    const notasWidth = Math.max(160, boxLeft - MARGIN_X - 12)
    const notasLines = (doc.splitTextToSize(pdfText(notasRaw), notasWidth) as string[]).slice(0, 2)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
    doc.text('Notas', MARGIN_X, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(notasLines, MARGIN_X, y + 11)
  }

  const formas = (presupuesto.formas_pago || []).map((f) => f.trim()).filter(Boolean)
  if (formas.length) pintarFormasPago(doc, formas)

  return doc
}

export async function downloadPresupuestoPlanillaPdf(
  presupuesto: PresupuestoPlanillaPayload,
  fileName?: string
): Promise<void> {
  const doc = await buildPresupuestoPlanillaPdf(presupuesto)
  const safe =
    (fileName || `presupuesto-${presupuesto.numero}`).replace(/[^\w.\-]+/g, '_').slice(0, 120) ||
    'presupuesto'
  doc.save(safe.endsWith('.pdf') ? safe : `${safe}.pdf`)
}

export async function getPresupuestoPlanillaPdfBlob(
  presupuesto: PresupuestoPlanillaPayload
): Promise<Blob> {
  const doc = await buildPresupuestoPlanillaPdf(presupuesto)
  return doc.output('blob')
}
