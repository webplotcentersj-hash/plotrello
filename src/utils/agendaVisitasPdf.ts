import jsPDF from 'jspdf'
import { parseISO } from 'date-fns'
import type { CitaAsesorTecnico } from '../types/api'
import {
  formatArgentinaDate,
  getArgentinaDateString,
  isoToArgentinaTime
} from './dateUtils'

function displayVisitaCliente(cita: CitaAsesorTecnico): string {
  const raw = (cita.cliente_nombre || cita.titulo || '').trim()
  return raw.toLowerCase().startsWith('visita - ') ? raw.slice(9).trim() : raw
}

/** Etiqueta: Ficha (No OP) vs OP ya emitida */
function labelReferenciaOrden(cita: CitaAsesorTecnico): string {
  if (!cita.ficha_numero?.trim()) return ''
  if (cita.es_ficha_no_op === false) return 'OP'
  return 'Ficha'
}

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth)
}

/**
 * Genera y descarga un PDF con las visitas del día (lista ya filtrada a “hoy”).
 */
export function exportAgendaVisitasHoyPdf(visitas: CitaAsesorTecnico[]): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 18
  const contentW = pageWidth - margin * 2
  let y = margin

  const nuevaPaginaSiHaceFalta = (extra: number) => {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (y + extra > pageHeight - 16) {
      doc.addPage()
      y = margin
    }
  }

  const fechaKey = getArgentinaDateString()
  const fechaLabel = formatArgentinaDate(parseISO(`${fechaKey}T12:00:00-03:00`))

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Visitas del día — Asesor técnico', pageWidth / 2, y, { align: 'center' })
  y += 9

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Fecha: ${fechaLabel}`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 12

  if (visitas.length === 0) {
    doc.setFontSize(11)
    doc.text('No hay visitas programadas para hoy.', margin, y)
    doc.save(`visitas-hoy-${fechaKey}.pdf`)
    return
  }

  visitas.forEach((cita, idx) => {
    nuevaPaginaSiHaceFalta(42)

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`${idx + 1}. ${isoToArgentinaTime(cita.fecha_cita)} — ${displayVisitaCliente(cita)}`, margin, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    const line = (label: string, value: string | null | undefined) => {
      if (!value || !String(value).trim()) return
      nuevaPaginaSiHaceFalta(8)
      const t = `${label}: ${String(value).trim()}`
      const lines = splitLines(doc, t, contentW)
      lines.forEach((ln) => {
        nuevaPaginaSiHaceFalta(6)
        doc.text(ln, margin + 2, y)
        y += 5
      })
    }

    line('Teléfono', cita.cliente_telefono)
    line('Dirección', cita.direccion)
    line('Duración', cita.duracion_minutos ? `${cita.duracion_minutos} min` : undefined)
    line('Estado', cita.estado)
    line(
      labelReferenciaOrden(cita) || 'Referencia',
      cita.ficha_numero || undefined
    )
    line('Ubicación (enlace)', cita.ubicacion_link)
    if (cita.descripcion?.trim()) {
      nuevaPaginaSiHaceFalta(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Descripción:', margin + 2, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      splitLines(doc, cita.descripcion.trim(), contentW - 4).forEach((ln) => {
        nuevaPaginaSiHaceFalta(6)
        doc.text(ln, margin + 4, y)
        y += 5
      })
    }
    if (cita.notas?.trim()) {
      nuevaPaginaSiHaceFalta(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Notas:', margin + 2, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      splitLines(doc, cita.notas.trim(), contentW - 4).forEach((ln) => {
        nuevaPaginaSiHaceFalta(6)
        doc.text(ln, margin + 4, y)
        y += 5
      })
    }

    y += 6
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8
  })

  doc.save(`visitas-hoy-${fechaKey}.pdf`)
}
