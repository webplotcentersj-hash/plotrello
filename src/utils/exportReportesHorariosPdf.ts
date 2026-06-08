import { jsPDF } from 'jspdf'
import type { RelojResumenCompacto } from './relojReporteSnapshot'
import { formatHoras } from '../services/relojBiometricoService'

export type ExportReportesHorariosInput = {
  periodoDesde: string
  periodoHasta: string
  kpis: {
    empleados: number
    horas: number
    extra: number
    tardanzas: number
    anomalias: number
    informesReloj: number
  }
  filas: RelojResumenCompacto[]
  informesIa: { periodo: string; titulo: string; extracto: string }[]
}

export function exportReportesHorariosPdf(input: ExportReportesHorariosInput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 14

  doc.setFontSize(16)
  doc.text('Reporte de asistencia — Plot Lab', 14, y)
  y += 8
  doc.setFontSize(10)
  doc.text(`Período: ${input.periodoDesde} → ${input.periodoHasta}`, 14, y)
  y += 10

  doc.setFontSize(12)
  doc.text('Indicadores', 14, y)
  y += 7
  doc.setFontSize(9)
  const k = input.kpis
  doc.text(
    `Empleados: ${k.empleados} · Horas: ${formatHoras(k.horas)} · Extra: ${formatHoras(k.extra)} · Tardanzas: ${k.tardanzas} · Anomalías: ${k.anomalias} · Informes reloj: ${k.informesReloj}`,
    14,
    y,
    { maxWidth: 180 }
  )
  y += 12

  doc.setFontSize(11)
  doc.text('Detalle por colaborador', 14, y)
  y += 6
  doc.setFontSize(8)
  doc.text('Empleado | Hs | Extra | Tard. | Punt.% | Anom.', 14, y)
  y += 5

  for (const r of input.filas.slice(0, 40)) {
    if (y > 270) {
      doc.addPage()
      y = 14
    }
    const line = `${r.nombre.slice(0, 28)} | ${formatHoras(r.totalHoras)} | ${formatHoras(r.totalExtra)} | ${r.tardanzas} | ${r.puntualidadPct}% | ${r.anomalias}`
    doc.text(line, 14, y)
    y += 4.5
  }

  if (input.informesIa.length) {
    y += 6
    if (y > 250) {
      doc.addPage()
      y = 14
    }
    doc.setFontSize(11)
    doc.text('Informes PlotAI guardados', 14, y)
    y += 6
    doc.setFontSize(8)
    for (const ia of input.informesIa.slice(0, 5)) {
      doc.text(`${ia.periodo} — ${ia.titulo}`, 14, y, { maxWidth: 180 })
      y += 4
      doc.text(ia.extracto.slice(0, 200) + (ia.extracto.length > 200 ? '…' : ''), 14, y, { maxWidth: 180 })
      y += 8
    }
  }

  doc.save(`reporte-horarios-${input.periodoDesde}_${input.periodoHasta}.pdf`)
}
