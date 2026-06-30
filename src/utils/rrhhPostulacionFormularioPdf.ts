import jsPDF from 'jspdf'
import type { RrhhPostulacion } from '../types/api'
import {
  FORMULARIO_FIELD_LABELS,
  formatFormularioField,
  formularioSlug,
  getFormularioRespuestas
} from './rrhhFormularioExternoDisplay'

const MARGIN = 14
const PAGE_W = 210
const LINE = 5.5

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function drawHeader(doc: jsPDF, title: string) {
  doc.setFillColor(242, 113, 28)
  doc.rect(0, 0, PAGE_W, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PLOT CENTER — POSTULACIÓN', MARGIN, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(title, PAGE_W - MARGIN, 8, { align: 'right' })
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need <= 287) return y
  doc.addPage()
  drawHeader(doc, 'Formulario extendido')
  doc.setTextColor(30, 30, 30)
  return 18
}

function writeParagraph(doc: jsPDF, text: string, x: number, y: number, maxW: number): number {
  const lines = doc.splitTextToSize(text, maxW) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, y, LINE)
    doc.text(line, x, y)
    y += LINE
  }
  return y
}

export function downloadPostulacionFormularioPdf(row: RrhhPostulacion): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const slug = formularioSlug(row)
  const respuestas = getFormularioRespuestas(row)
  const meta = (row.metadata_ia || {}) as Record<string, unknown>
  const maxW = PAGE_W - MARGIN * 2

  drawHeader(doc, row.puesto)
  let y = 20

  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(row.nombre, MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y = writeParagraph(doc, `Puesto: ${row.puesto}`, MARGIN, y, maxW)
  y = writeParagraph(doc, `Email: ${row.email}`, MARGIN, y, maxW)
  y = writeParagraph(doc, `Teléfono: ${row.telefono || '—'}`, MARGIN, y, maxW)
  y = writeParagraph(doc, `Recibido: ${fmtFecha(row.created_at)}`, MARGIN, y, maxW)
  y += 3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(230, 90, 10)
  doc.text('Respuestas del formulario', MARGIN, y)
  y += 7
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(9)

  for (const [key, label] of Object.entries(FORMULARIO_FIELD_LABELS)) {
    const raw = respuestas[key]
    if (!raw?.trim()) continue
    const val = formatFormularioField(key, raw, slug)
    y = ensureSpace(doc, y, LINE * 2)
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, MARGIN, y)
    y += LINE
    doc.setFont('helvetica', 'normal')
    y = writeParagraph(doc, val, MARGIN + 2, y, maxW - 2)
    y += 2
  }

  if (typeof meta.resumen === 'string' && meta.resumen.trim()) {
    y += 4
    y = ensureSpace(doc, y, LINE * 3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(230, 90, 10)
    doc.text('Análisis PlotAI', MARGIN, y)
    y += 7
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    y = writeParagraph(doc, meta.resumen, MARGIN, y, maxW)

    if (row.score_ia != null) {
      y += 2
      y = writeParagraph(doc, `Score Plot: ${Math.round(row.score_ia)}%`, MARGIN, y, maxW)
    }
    if (Array.isArray(meta.habilidades) && meta.habilidades.length) {
      y = writeParagraph(doc, `Habilidades: ${(meta.habilidades as string[]).join(', ')}`, MARGIN, y, maxW)
    }
    if (Array.isArray(meta.fortalezas_plot) && meta.fortalezas_plot.length) {
      y = writeParagraph(
        doc,
        `Fortalezas: ${(meta.fortalezas_plot as string[]).join(', ')}`,
        MARGIN,
        y,
        maxW
      )
    }
    if (Array.isArray(meta.gaps_plot) && (meta.gaps_plot as string[]).length) {
      y = writeParagraph(doc, `A mejorar: ${(meta.gaps_plot as string[]).join(', ')}`, MARGIN, y, maxW)
    }
    if (typeof meta.recomendacion_rrhh === 'string' && meta.recomendacion_rrhh.trim()) {
      y += 2
      doc.setFont('helvetica', 'bold')
      y = writeParagraph(doc, 'Recomendación RRHH:', MARGIN, y, maxW)
      doc.setFont('helvetica', 'normal')
      y = writeParagraph(doc, meta.recomendacion_rrhh, MARGIN, y, maxW)
    }
  }

  const safeName = row.nombre.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'candidato'
  doc.save(`postulacion_${safeName}_${row.id}.pdf`)
}
