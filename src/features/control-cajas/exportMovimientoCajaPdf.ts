import jsPDF from 'jspdf'
import type { ResumenAdminHoy } from './cajaDashboardData'
import { fmtArs, fmtDateAr, montoVisibleMovimiento } from './format'
import {
  cajaNombreFromSlug,
  labelOrigenImportacion,
  mediosPagoMovimiento,
  parseRefPlotLab,
  subtituloIngresoDia,
  trazabilidadFilas,
  type DiaResumenLinea
} from './movimientoDetalle'
import type { CajaMovimiento, CajaRegistro } from './types'

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
  return y + lines.length * 5
}

export function downloadMovimientoCajaPdf(m: CajaMovimiento, cajas: CajaRegistro[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18
  const total = montoVisibleMovimiento(m)
  const ref = parseRefPlotLab(m)

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Movimiento de caja — Plot Lab', margin, y)
  y += 10

  doc.setFontSize(11)
  y = writeLine(doc, m.concepto, margin, y)
  y += 2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  y = writeLine(doc, `Fecha: ${fmtDateAr(m.fecha)}${m.hora ? ` ${m.hora}` : ''}`, margin, y)
  y = writeLine(doc, `Origen: ${cajaNombreFromSlug(m.origen_slug, cajas)}`, margin, y)
  y = writeLine(doc, `Destino: ${cajaNombreFromSlug(m.destino_slug, cajas)}`, margin, y)
  if (m.tipo_movimiento) y = writeLine(doc, `Tipo: ${m.tipo_movimiento}`, margin, y)
  if (m.categoria) y = writeLine(doc, `Categoria: ${m.categoria}`, margin, y)
  if (m.tercero_nombre) y = writeLine(doc, `Tercero: ${m.tercero_nombre}`, margin, y)
  if (m.usuario_nombre) y = writeLine(doc, `Usuario: ${m.usuario_nombre}`, margin, y)
  y = writeLine(doc, `Fuente: ${labelOrigenImportacion(m.origen_importacion)}`, margin, y)
  if (m.nro_comprobante) y = writeLine(doc, `Comprobante: ${m.nro_comprobante}`, margin, y)
  if (ref) y = writeLine(doc, `Referencia PlotLab: ${ref}`, margin, y)
  if (m.anulado) y = writeLine(doc, 'Estado: ANULADO', margin, y)
  if (m.cierre_id) y = writeLine(doc, 'Vinculado a cierre cerrado', margin, y)
  if (m.created_at) {
    y = writeLine(doc, `Registrado: ${new Date(m.created_at).toLocaleString('es-AR')}`, margin, y)
  }
  y = writeLine(doc, `ID: ${m.id}`, margin, y)
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.text('Medios de pago', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const medios = mediosPagoMovimiento(m)
  if (!medios.length) {
    y = writeLine(doc, 'Sin desglose por medio.', margin, y)
  } else {
    for (const line of medios) {
      y = writeLine(doc, `${line.label}: $ ${fmtArs(line.monto)}`, margin, y)
      if (y > 265) {
        doc.addPage()
        y = 18
      }
    }
  }

  y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Total: $ ${fmtArs(total)}`, margin, y)
  y += 8

  const trace = trazabilidadFilas(m)
  if (trace.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Trazabilidad del pase', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const row of trace) {
      y = writeLine(doc, `${row.label}: ${row.antes} -> ${row.despues}`, margin, y)
    }
    y += 4
  }

  if (m.observacion) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Observacion', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    y = writeLine(doc, m.observacion, margin, y)
  }

  const slug = `${m.fecha}-${m.id.slice(0, 8)}`.replace(/[^\w-]+/g, '_')
  doc.save(`movimiento-caja-${slug}.pdf`)
}

export function downloadDiaResumenPdf(opts: {
  titulo: string
  fecha: string
  subtitulo: string
  total: number
  lineas: DiaResumenLinea[]
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(pdfText(opts.titulo), margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  y = writeLine(doc, `Fecha: ${fmtDateAr(opts.fecha)}`, margin, y)
  y = writeLine(doc, opts.subtitulo, margin, y)
  y = writeLine(doc, `Total: $ ${fmtArs(opts.total)}`, margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('Detalle', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  if (!opts.lineas.length) {
    writeLine(doc, 'Sin lineas para este dia.', margin, y)
  } else {
    for (const linea of opts.lineas) {
      y = writeLine(doc, `${linea.titulo} — $ ${fmtArs(linea.monto)}`, margin, y)
      if (linea.detalle) y = writeLine(doc, linea.detalle, margin + 4, y)
      y += 2
      if (y > 265) {
        doc.addPage()
        y = 18
      }
    }
  }

  const slug = `${opts.fecha}-${opts.titulo}`.replace(/[^\w-]+/g, '_').slice(0, 40)
  doc.save(`caja-${slug}.pdf`)
}

export function downloadIngresoDiaPdf(
  resumen: ResumenAdminHoy,
  lineas: DiaResumenLinea[],
  esHoy: boolean
): void {
  downloadDiaResumenPdf({
    titulo: esHoy ? 'Ingreso hoy' : 'Ingreso del dia',
    fecha: resumen.fecha,
    subtitulo: subtituloIngresoDia(resumen),
    total: resumen.ingresoHoy,
    lineas
  })
}

export function downloadEgresoDiaPdf(
  fecha: string,
  total: number,
  lineas: DiaResumenLinea[],
  esHoy: boolean
): void {
  downloadDiaResumenPdf({
    titulo: esHoy ? 'Egresos hoy' : 'Egresos del dia',
    fecha,
    subtitulo: 'Egresos aprobados del dia (todas las cajas)',
    total,
    lineas
  })
}
