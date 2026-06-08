import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import type { RrhhNovedad } from '../types/api'

type PdfInput = {
  novedad: RrhhNovedad
  empleadoNombre: string
  grupoLabel: string
  codigoLabel: string
  firmaDataUrl?: string | null
  firmadoAt?: string | null
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

export function downloadRrhhNovedadNotificacionPdf(input: PdfInput) {
  const { novedad, empleadoNombre, grupoLabel, codigoLabel, firmaDataUrl, firmadoAt } = input
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 18
  const pageW = doc.internal.pageSize.getWidth()
  const contentW = pageW - margin * 2
  let y = margin

  doc.setFillColor(249, 115, 22)
  doc.rect(0, 0, pageW, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('PLOT LAB — RECURSOS HUMANOS', margin, 9)

  y = 24
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(16)
  doc.text('NOTIFICACIÓN DE NOVEDAD LABORAL', margin, y)
  y += 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Nº ${novedad.id} · Generado ${format(new Date(), 'd/MM/yyyy HH:mm', { locale: es })}`, margin, y)
  y += 10

  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, contentW, 52, 2, 2, 'FD')

  const field = (label: string, value: string, col: 0 | 1, row: number) => {
    const colW = contentW / 2 - 6
    const fx = margin + 6 + col * (colW + 6)
    const fy = y + 8 + row * 14
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), fx, fy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(value, fx, fy + 5)
  }

  const periodo =
    novedad.fecha_hasta !== novedad.fecha_desde
      ? `${novedad.fecha_desde} al ${novedad.fecha_hasta}`
      : novedad.fecha_desde

  field('Empleado', empleadoNombre, 0, 0)
  field('Grupo', grupoLabel, 1, 0)
  field('Tipo', codigoLabel, 0, 1)
  field('Período', periodo, 1, 1)
  if (novedad.grupo === 'tardanza_retiro' && novedad.duracion_minutos != null) {
    field('Duración', `${novedad.duracion_minutos} minutos`, 0, 2)
  } else if (novedad.grupo === 'horas_extra' && novedad.horas_extra_cantidad != null) {
    field('Horas extra', `${novedad.horas_extra_cantidad} h`, 0, 2)
  }

  y += 60
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  const intro =
    'Por medio de la presente se deja constancia de la novedad laboral detallada, registrada en el sistema interno de la empresa. El/La empleado/a firma en señal de conformidad y toma conocimiento de la misma.'
  y = wrapText(doc, intro, margin, y, contentW, 5.5) + 6

  if (novedad.observaciones?.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('OBSERVACIONES', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    y = wrapText(doc, novedad.observaciones.trim(), margin, y, contentW, 5.5) + 8
  }

  const registro = novedad.created_at
    ? format(parseISO(novedad.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })
    : '—'
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Registro en sistema: ${registro}`, margin, y)
  y += 14

  doc.setDrawColor(203, 213, 225)
  doc.line(margin, y, margin + contentW, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text('FIRMA DEL EMPLEADO', margin, y)
  y += 6

  const firma = firmaDataUrl || novedad.firma_data_url
  if (firma) {
    try {
      doc.addImage(firma, 'PNG', margin, y, 70, 28)
      y += 32
      const cuando = firmadoAt || novedad.firmado_at
      if (cuando) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(
          `Firmado el ${format(parseISO(cuando), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`,
          margin,
          y
        )
        y += 6
      }
    } catch {
      doc.setFontSize(9)
      doc.text('(Firma registrada — no se pudo incrustar en el PDF)', margin, y)
      y += 8
    }
  } else {
    doc.setDrawColor(203, 213, 225)
    doc.rect(margin, y, 80, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text('Sin firma', margin + 4, y + 17)
    y += 36
  }

  doc.line(margin, y, margin + 80, y)
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text(empleadoNombre, margin, y)
  y += 4
  doc.setTextColor(100, 116, 139)
  doc.text('Aclaración / Nombre y apellido', margin, y)

  const safeName = empleadoNombre.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40)
  doc.save(`notificacion-rrhh-${novedad.id}-${safeName || 'empleado'}.pdf`)
}
