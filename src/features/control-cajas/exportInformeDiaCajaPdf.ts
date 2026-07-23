import jsPDF from 'jspdf'
import type { ResumenAdminHoy } from './cajaDashboardData'
import {
  conciliacionAutomaticaDia,
  labelEstadoConciliacion,
  mediosIngresosDia,
  movimientosDelDia
} from './conciliacionDiaCaja'
import { fmtArs, fmtDateAr, montoCobradoCaja, montoCuentaCorriente, montoVisibleMovimiento } from './format'
import {
  cajaNombreFromSlug,
  labelOrigenImportacion,
  mediosPagoMovimiento,
  parseRefPlotLab,
  subtituloIngresoDia
} from './movimientoDetalle'
import type {
  CajaArqueo,
  CajaConcilBanco,
  CajaConcilMP,
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaRegistro,
  CajaTransferenciaLote,
  PlanillaCajaGuardada
} from './types'

function pdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map: Record<string, string> = { 'Ñ': 'N', 'ñ': 'n' }
      return map[ch] ?? ''
    })
}

function writeLine(doc: jsPDF, text: string, x: number, y: number, maxW = 180): number {
  const lines = doc.splitTextToSize(pdfText(text), maxW)
  doc.text(lines, x, y)
  return y + lines.length * 4.5
}

function ensurePage(doc: jsPDF, y: number, margin: number): number {
  if (y > 265) {
    doc.addPage()
    return margin
  }
  return y
}

export type InformeDiaCajaInput = {
  fecha: string
  resumen: ResumenAdminHoy
  movimientos: CajaMovimiento[]
  cajas: CajaRegistro[]
  planillas: PlanillaCajaGuardada[]
  egresos: CajaEgresoSolicitud[]
  lotes: CajaTransferenciaLote[]
  arqueos: CajaArqueo[]
  concilMp?: CajaConcilMP | null
  concilBanco?: CajaConcilBanco | null
}

export function downloadInformeDiaCajaPdf(input: InformeDiaCajaInput): void {
  const {
    fecha,
    resumen,
    movimientos,
    cajas,
    planillas,
    egresos,
    lotes,
    arqueos,
    concilMp,
    concilBanco
  } = input

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18

  const movs = movimientosDelDia(movimientos, fecha)
  const medios = mediosIngresosDia(movimientos, fecha)
  const concil = conciliacionAutomaticaDia({
    fecha,
    movimientos,
    planillas,
    concilMp,
    concilBanco
  })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Informe de caja — Plot Lab', margin, y)
  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  y = writeLine(doc, `Fecha: ${fmtDateAr(fecha)}`, margin, y)
  y = writeLine(doc, `Generado: ${new Date().toLocaleString('es-AR')}`, margin, y)
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.text('Resumen del dia', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y = writeLine(doc, `Ingreso cobrado: $ ${fmtArs(medios.totalCobrado || resumen.ingresoHoy)}`, margin, y)
  y = writeLine(doc, `Cuenta corriente: $ ${fmtArs(medios.cuenta_corriente)}`, margin, y)
  y = writeLine(doc, `Egresos: $ ${fmtArs(resumen.egresosHoy)}`, margin, y)
  y = writeLine(doc, subtituloIngresoDia(resumen), margin, y)
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Conciliacion por medio', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  for (const line of concil) {
    if (line.estado === 'sin_mov' && line.movimientos <= 0) continue
    y = ensurePage(doc, y, margin)
    y = writeLine(
      doc,
      `${line.label}: mov $ ${fmtArs(line.movimientos)} | ref $ ${fmtArs(line.referencia ?? 0)} | ${labelEstadoConciliacion(line.estado)}${line.referenciaFuente ? ` (${line.referenciaFuente})` : ''}`,
      margin,
      y
    )
  }
  y += 4

  const lotesDia = lotes.filter((l) => l.fecha === fecha)
  if (lotesDia.length) {
    y = ensurePage(doc, y + 2, margin)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Cierres de turno (${lotesDia.length})`, margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const l of lotesDia) {
      y = ensurePage(doc, y, margin)
      y = writeLine(
        doc,
        `${l.hora ?? '--'} ${cajaNombreFromSlug(l.origen_slug, cajas)} -> admin $ ${fmtArs((l.resto_efectivo || 0) + (l.resto_otros || 0))} | fondo $ ${fmtArs(l.fondo_monto)} | ${l.usuario_nombre ?? ''}`,
        margin,
        y
      )
    }
    y += 3
  }

  const arqueosDia = arqueos.filter((a) => a.fecha === fecha)
  if (arqueosDia.length) {
    y = ensurePage(doc, y + 2, margin)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Arqueos (${arqueosDia.length})`, margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const a of arqueosDia) {
      y = ensurePage(doc, y, margin)
      y = writeLine(
        doc,
        `${cajaNombreFromSlug(a.caja_slug, cajas)} ${a.turno} | contado $ ${fmtArs(a.total)} | ${a.usuario_nombre ?? ''}`,
        margin,
        y
      )
    }
    y += 3
  }

  const egresosDia = egresos.filter((e) => e.fecha === fecha && e.estado === 'aprobado' && !!e.url_ticket)
  if (egresosDia.length) {
    y = ensurePage(doc, y + 2, margin)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Egresos aprobados (${egresosDia.length})`, margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const e of egresosDia) {
      y = ensurePage(doc, y, margin)
      y = writeLine(
        doc,
        `${e.concepto} | $ ${fmtArs((e.monto_efectivo || 0) + (e.monto_otros || 0))} | ${e.caja_slug}`,
        margin,
        y
      )
    }
    y += 3
  }

  y = ensurePage(doc, y + 2, margin)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Movimientos del dia (${movs.length})`, margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  if (!movs.length) {
    writeLine(doc, 'Sin movimientos registrados.', margin, y)
  } else {
    for (const m of movs) {
      y = ensurePage(doc, y, margin)
      const ref = parseRefPlotLab(m)
      const cc = montoCuentaCorriente(m)
      const cobrado = montoCobradoCaja(m)
      const mediosTxt = mediosPagoMovimiento(m)
        .map((x) => `${x.label} $${fmtArs(x.monto)}`)
        .join(', ')
      y = writeLine(
        doc,
        `${m.hora ?? '--'} | ${m.concepto} | ${cajaNombreFromSlug(m.origen_slug, cajas)} -> ${cajaNombreFromSlug(m.destino_slug, cajas)} | cobrado $ ${fmtArs(cobrado)}${cc > 0 ? ` | CC $ ${fmtArs(cc)}` : ''} | total $ ${fmtArs(montoVisibleMovimiento(m))}`,
        margin,
        y
      )
      y = writeLine(
        doc,
        `  ${labelOrigenImportacion(m.origen_importacion)}${ref ? ` | ${ref}` : ''}${m.tercero_nombre ? ` | ${m.tercero_nombre}` : ''}${m.usuario_nombre ? ` | ${m.usuario_nombre}` : ''}`,
        margin,
        y
      )
      if (mediosTxt) y = writeLine(doc, `  Medios: ${mediosTxt}`, margin, y)
      if (m.observacion) y = writeLine(doc, `  Obs: ${m.observacion}`, margin, y)
      y += 1
    }
  }

  const slug = fecha.replace(/[^\w-]+/g, '_')
  doc.save(`informe-caja-${slug}.pdf`)
}
