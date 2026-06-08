import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import type { RrhhNovedad } from '../types/api'
import {
  RRHH_NOVEDAD_GRUPOS,
  etiquetaCodigoRrhhNovedad
} from './rrhhNovedadCatalog'

type ExportInput = {
  novedades: RrhhNovedad[]
  empleadoLabel: (idUsuario: number) => string
  fechaDesde: string
  fechaHasta: string
}

const MARGIN = 12
const PAGE_H = 210
const PAGE_W = 297
const HEADER_H = 9
const ROW_PAD = 2.2
const LINE_H = 3.6

const COLS = [
  { key: 'fechas', header: 'Fechas', width: 30 },
  { key: 'empleado', header: 'Empleado', width: 34 },
  { key: 'grupo', header: 'Grupo', width: 36 },
  { key: 'categoria', header: 'Categoría', width: 40 },
  { key: 'detalle', header: 'Detalle', width: 110 },
  { key: 'firma', header: 'Firma', width: 10 }
] as const

function grupoLabel(grupo: string) {
  return RRHH_NOVEDAD_GRUPOS.find((g) => g.value === grupo)?.label ?? grupo
}

function detalleCelda(n: RrhhNovedad) {
  const partes: string[] = []
  if (n.grupo === 'tardanza_retiro' && n.duracion_minutos != null) {
    partes.push(`${n.duracion_minutos} min`)
  }
  if (n.grupo === 'horas_extra' && n.horas_extra_cantidad != null) {
    partes.push(`${n.horas_extra_cantidad} h`)
  }
  if (n.observaciones?.trim()) partes.push(n.observaciones.trim())
  return partes.join(' · ') || '—'
}

function fechasCelda(n: RrhhNovedad) {
  return n.fecha_hasta !== n.fecha_desde
    ? `${n.fecha_desde} → ${n.fecha_hasta}`
    : n.fecha_desde
}

function resumenPorGrupo(novedades: RrhhNovedad[]) {
  const map = new Map<string, number>()
  for (const n of novedades) {
    map.set(n.grupo, (map.get(n.grupo) ?? 0) + 1)
  }
  return RRHH_NOVEDAD_GRUPOS.map((g) => ({
    label: g.label,
    count: map.get(g.value) ?? 0
  })).filter((x) => x.count > 0)
}

function cellLines(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text, width - 2) as string[]
}

function drawPageHeader(doc: jsPDF, page: number) {
  doc.setFillColor(249, 115, 22)
  doc.rect(0, 0, PAGE_W, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PLOT LAB — NOVEDADES RRHH', MARGIN, 6.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(`Pág. ${page}`, PAGE_W - MARGIN, 6.5, { align: 'right' })
}

function measureRow(doc: jsPDF, row: string[]) {
  let maxLines = 1
  COLS.forEach((col, i) => {
    const lines = cellLines(doc, row[i] ?? '', col.width)
    maxLines = Math.max(maxLines, lines.length)
  })
  return maxLines * LINE_H + ROW_PAD * 2
}

export function downloadRrhhNovedadesListadoPdf(input: ExportInput) {
  const { novedades, empleadoLabel, fechaDesde, fechaHasta } = input
  const rows = novedades.map((n) => [
    fechasCelda(n),
    empleadoLabel(n.id_usuario),
    grupoLabel(n.grupo),
    etiquetaCodigoRrhhNovedad(n.codigo),
    detalleCelda(n),
    n.firma_data_url ? 'Sí' : '—'
  ])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const resumen = resumenPorGrupo(novedades)

  let page = 1
  let y = 18

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage()
      page++
      y = 22
      drawPageHeader(doc, page)
      drawTableHead(doc, y)
      y += HEADER_H + 2
    }
  }

  drawPageHeader(doc, page)

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Listado de novedades laborales', MARGIN, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`Período: ${fechaDesde} al ${fechaHasta}`, MARGIN, y)
  y += 4.5
  doc.text(
    `Generado: ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })} · ${novedades.length} registro${novedades.length === 1 ? '' : 's'}`,
    MARGIN,
    y
  )
  y += 7

  if (resumen.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text('Resumen por grupo:', MARGIN, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    const resumenTxt = resumen.map((r) => `${r.label}: ${r.count}`).join('   ·   ')
    const resumenLines = cellLines(doc, resumenTxt, PAGE_W - MARGIN * 2)
    resumenLines.forEach((line) => {
      doc.text(line, MARGIN, y)
      y += 4
    })
    y += 3
  }

  drawTableHead(doc, y)
  y += HEADER_H + 2

  doc.setFontSize(7.5)
  rows.forEach((row, idx) => {
    const rowH = measureRow(doc, row)
    newPageIfNeeded(rowH)

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(MARGIN, y - ROW_PAD, PAGE_W - MARGIN * 2, rowH, 'F')
    }

    let x = MARGIN
    COLS.forEach((col, colIdx) => {
      const lines = cellLines(doc, row[colIdx] ?? '', col.width)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', colIdx === 0 ? 'bold' : 'normal')
      lines.forEach((line, lineIdx) => {
        doc.text(line, x + 1, y + ROW_PAD + lineIdx * LINE_H + 2.5)
      })
      x += col.width
    })

    doc.setDrawColor(226, 232, 240)
    doc.line(MARGIN, y + rowH - 0.5, PAGE_W - MARGIN, y + rowH - 0.5)
    y += rowH
  })

  doc.save(`rrhh-novedades-${fechaDesde}_${fechaHasta}.pdf`)
}

function drawTableHead(doc: jsPDF, y: number) {
  doc.setFillColor(30, 41, 59)
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, HEADER_H, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  let x = MARGIN
  for (const col of COLS) {
    doc.text(col.header, x + 1.5, y + 6)
    x += col.width
  }
}
