import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { copyPdfBytes } from './pdfTextLines'

/** Planilla oficial en /public (diseño Plot Center). */
export const PRESUPUESTO_PLANILLA_URL = '/PRESUPUESTO.pdf'

/** Tamaño nativo de la planilla (pt). */
export const PLANILLA_W = 1080
export const PLANILLA_H = 1920

const MARGIN_X = 72
const CONTENT_TOP = 370
const CONTENT_BOTTOM = 1780
const ACCENT = { r: 234, g: 88, b: 12 }
const INK = { r: 15, g: 23, b: 42 }
const MUTED = { r: 71, g: 85, b: 105 }

export type PresupuestoPlanillaItem = {
  codigo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
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
  notas?: string | null
  vendedor?: string | null
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

function nuevaPagina(doc: jsPDF, fondo: string, esPrimera: boolean) {
  if (!esPrimera) doc.addPage([PLANILLA_W, PLANILLA_H], 'p')
  pintarFondo(doc, fondo)
}

/**
 * Genera el PDF de presupuesto sobre la planilla oficial PRESUPUESTO.pdf.
 * Misma plantilla para ventas, chat widget y /presupuesto.
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

  nuevaPagina(doc, fondo, true)

  const right = PLANILLA_W - MARGIN_X
  const tableRight = right
  const colSub = tableRight
  const colUnit = tableRight - 130
  const colCant = tableRight - 230
  const colDesc = MARGIN_X
  const colDescWidth = colCant - colDesc - 24

  let y = CONTENT_TOP

  // Meta (número / fechas) a la derecha, debajo del título de la planilla.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(pdfText(presupuesto.numero), right, y, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text(pdfText(`Fecha: ${presupuesto.fecha}`), MARGIN_X, y)
  y += 18
  if (presupuesto.validez_hasta) {
    doc.text(pdfText(`Valido hasta: ${presupuesto.validez_hasta}`), MARGIN_X, y)
  }
  if (presupuesto.lista_label) {
    doc.text(pdfText(presupuesto.lista_label), right, y, { align: 'right' })
  }
  y += 28

  // Cliente
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text('CLIENTE', MARGIN_X, y)
  y += 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(pdfText(presupuesto.cliente_nombre || '-'), MARGIN_X, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const clienteExtra = [
    presupuesto.cliente_empresa ? `Empresa: ${presupuesto.cliente_empresa}` : '',
    presupuesto.cliente_dni_cuit ? `DNI/CUIT: ${presupuesto.cliente_dni_cuit}` : '',
    presupuesto.cliente_telefono ? `Tel / WhatsApp: ${presupuesto.cliente_telefono}` : '',
    presupuesto.cliente_email ? `Email: ${presupuesto.cliente_email}` : '',
    presupuesto.cliente_direccion ? `Direccion: ${presupuesto.cliente_direccion}` : ''
  ].filter(Boolean)

  for (const linea of clienteExtra) {
    doc.text(pdfText(linea), MARGIN_X, y)
    y += 16
  }
  y += 18

  // Encabezado de tabla
  const headerH = 28
  const ensureSpace = (need: number) => {
    if (y + need <= CONTENT_BOTTOM) return
    nuevaPagina(doc, fondo, false)
    y = CONTENT_TOP
    // Mini cabecera en páginas siguientes
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(INK.r, INK.g, INK.b)
    doc.text(pdfText(`PRESUPUESTO ${presupuesto.numero} (cont.)`), MARGIN_X, y)
    y += 28
  }

  ensureSpace(headerH + 40)
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.roundedRect(MARGIN_X - 8, y - 6, tableRight - MARGIN_X + 16, headerH, 8, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('Descripcion', colDesc, y + 13)
  doc.text('Cant.', colCant, y + 13, { align: 'right' })
  doc.text('P. unit.', colUnit, y + 13, { align: 'right' })
  doc.text('Subtotal', colSub, y + 13, { align: 'right' })
  y += headerH + 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(INK.r, INK.g, INK.b)

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

  for (const item of items) {
    const titulo = item.codigo
      ? `${item.codigo} — ${item.descripcion}`
      : item.descripcion
    const lines = doc.splitTextToSize(pdfText(titulo), colDescWidth) as string[]
    const rowH = Math.max(22, lines.length * 15 + 8)
    ensureSpace(rowH + 8)

    doc.text(lines, colDesc, y + 12)
    doc.text(String(item.cantidad), colCant, y + 12, { align: 'right' })
    doc.text(formatArs(item.precio_unitario), colUnit, y + 12, { align: 'right' })
    doc.text(formatArs(item.subtotal), colSub, y + 12, { align: 'right' })
    y += rowH
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.8)
    doc.line(MARGIN_X - 4, y, tableRight + 4, y)
    y += 6
  }

  // Total
  ensureSpace(56)
  y += 8
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(colUnit - 40, y - 8, tableRight - (colUnit - 40) + 8, 40, 10, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL', colUnit - 24, y + 18)
  doc.setTextColor(255, 180, 120)
  doc.setFontSize(16)
  doc.text(formatArs(presupuesto.total), colSub - 8, y + 18, { align: 'right' })
  y += 56

  if (presupuesto.vendedor) {
    ensureSpace(24)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(pdfText(`Asesor: ${presupuesto.vendedor}`), MARGIN_X, y)
    y += 20
  }

  if (presupuesto.notas?.trim()) {
    const notasLines = doc.splitTextToSize(pdfText(presupuesto.notas), tableRight - MARGIN_X) as string[]
    ensureSpace(notasLines.length * 14 + 28)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
    doc.text('Notas', MARGIN_X, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(notasLines, MARGIN_X, y)
  }

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
