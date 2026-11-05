import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import type { SaldoVacacionesEmpleado, VacacionesPeriodoCalendario } from './rrhhVacacionesSaldo'
import { etiquetaBaseLegalVacaciones, periodoGoceVacaciones } from './rrhhVacacionesSaldo'

type ExportInput = {
  anioLiquidado: number
  saldos: SaldoVacacionesEmpleado[]
  periodos: VacacionesPeriodoCalendario[]
  /** Si viene, el PDF se limita a ese empleado. */
  filtroUsuarioId?: number | null
}

const MARGIN = 14
const PAGE_H = 297
const PAGE_W = 210

function drawHeader(doc: jsPDF, page: number, titulo: string) {
  doc.setFillColor(15, 118, 110)
  doc.rect(0, 0, PAGE_W, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(titulo, MARGIN, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Pág. ${page}`, PAGE_W - MARGIN, 8, { align: 'right' })
}

export function downloadVacacionesPeriodosPdf(input: ExportInput) {
  const { anioLiquidado, saldos, periodos, filtroUsuarioId = null } = input
  const goce = periodoGoceVacaciones(anioLiquidado)
  const saldosFiltrados =
    filtroUsuarioId == null ? saldos : saldos.filter((s) => s.id_usuario === filtroUsuarioId)
  const periodosFiltrados =
    filtroUsuarioId == null ? periodos : periodos.filter((p) => p.idUsuario === filtroUsuarioId)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let page = 1
  let y = 20

  const ensure = (need: number) => {
    if (y + need <= PAGE_H - MARGIN) return
    doc.addPage()
    page += 1
    drawHeader(doc, page, 'PLOT LAB — VACACIONES')
    y = 20
  }

  drawHeader(doc, page, 'PLOT LAB — VACACIONES')

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`Vacaciones ${anioLiquidado} — períodos detallados`, MARGIN, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  const alcance =
    filtroUsuarioId != null && saldosFiltrados[0]
      ? `Empleado: ${saldosFiltrados[0].nombre}`
      : `Equipo completo · ${saldosFiltrados.length} personas`
  doc.text(alcance, MARGIN, y)
  y += 5
  doc.text(
    `Temporada de goce: ${goce.desde} → ${goce.hasta} · Emitido ${format(new Date(), "d 'de' MMMM yyyy HH:mm", { locale: es })}`,
    MARGIN,
    y
  )
  y += 10

  // Resumen de saldos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('Saldos', MARGIN, y)
  y += 6

  doc.setFontSize(8)
  const saldoHead = ['Empleado', 'Ingreso', 'Cupo', 'Tomados', 'Ajustes', 'Saldo', 'Base']
  const saldoW = [48, 22, 14, 16, 14, 14, 48]
  let x = MARGIN
  doc.setFillColor(241, 245, 249)
  doc.rect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 6, 'F')
  doc.setTextColor(51, 65, 85)
  saldoHead.forEach((h, i) => {
    doc.text(h, x, y)
    x += saldoW[i]
  })
  y += 5

  doc.setFont('helvetica', 'normal')
  for (const s of [...saldosFiltrados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    ensure(7)
    x = MARGIN
    const row = [
      s.nombre,
      s.fecha_ingreso || '—',
      String(s.corresponden),
      String(s.tomados),
      String(s.ajustes || 0),
      String(s.saldo),
      etiquetaBaseLegalVacaciones(s.baseLegal)
    ]
    row.forEach((cell, i) => {
      const lines = doc.splitTextToSize(cell, saldoW[i] - 1) as string[]
      doc.text(lines[0] || '', x, y)
      x += saldoW[i]
    })
    y += 5
  }

  y += 6
  ensure(12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('Períodos tomados (detalle)', MARGIN, y)
  y += 6

  if (periodosFiltrados.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text('No hay períodos cargados en la temporada de goce.', MARGIN, y)
  } else {
    doc.setFontSize(8)
    const perHead = ['Empleado', 'Desde', 'Hasta', 'Días', 'Fuente']
    const perW = [62, 28, 28, 14, 44]
    x = MARGIN
    doc.setFillColor(241, 245, 249)
    doc.rect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(51, 65, 85)
    perHead.forEach((h, i) => {
      doc.text(h, x, y)
      x += perW[i]
    })
    y += 5
    doc.setFont('helvetica', 'normal')

    const ordenados = [...periodosFiltrados].sort(
      (a, b) =>
        a.fecha_desde.localeCompare(b.fecha_desde) || a.nombre.localeCompare(b.nombre, 'es')
    )
    for (const p of ordenados) {
      ensure(7)
      x = MARGIN
      const row = [p.nombre, p.fecha_desde, p.fecha_hasta, String(p.dias), p.fuente]
      row.forEach((cell, i) => {
        const lines = doc.splitTextToSize(cell, perW[i] - 1) as string[]
        doc.text(lines[0] || '', x, y)
        x += perW[i]
      })
      y += 5
    }

    y += 4
    ensure(8)
    const totalDias = ordenados.reduce((a, p) => a + p.dias, 0)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(
      `Total: ${ordenados.length} período${ordenados.length === 1 ? '' : 's'} · ${totalDias} días corridos`,
      MARGIN,
      y
    )
  }

  // Detalle por empleado con tomadosDetalle del saldo (incluye fuera de ventana goce visual)
  const conTomados = saldosFiltrados.filter((s) => s.tomadosDetalle.length > 0)
  if (conTomados.length > 0) {
    y += 10
    ensure(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text(`Detalle por empleado (año ${anioLiquidado})`, MARGIN, y)
    y += 7

    for (const s of conTomados) {
      ensure(14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(15, 118, 110)
      doc.text(
        `${s.nombre} · cupo ${s.corresponden} · tomados ${s.tomados} · saldo ${s.saldo}`,
        MARGIN,
        y
      )
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(51, 65, 85)
      for (const t of s.tomadosDetalle) {
        ensure(5)
        doc.text(
          `• ${t.fecha_desde} → ${t.fecha_hasta} · ${t.dias} d · ${t.fuente}${
            t.titulo ? ` · ${t.titulo}` : ''
          }`,
          MARGIN + 2,
          y
        )
        y += 4.5
      }
      y += 3
    }
  }

  const suffix =
    filtroUsuarioId != null && saldosFiltrados[0]
      ? saldosFiltrados[0].nombre.replace(/\s+/g, '_')
      : 'equipo'
  doc.save(`vacaciones_${anioLiquidado}_${suffix}.pdf`)
}
