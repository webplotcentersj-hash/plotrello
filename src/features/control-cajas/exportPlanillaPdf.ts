import jsPDF from 'jspdf'
import { PLANILLA_LINEA_COLUMNAS, type PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import { fmtArs, fmtDateAr } from './format'

const MAX_VENTAS_PDF = 40

function writeRows(
  doc: jsPDF,
  y: number,
  margin: number,
  headers: string[],
  rows: string[][],
  colW: number[]
): number {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  let x = margin
  headers.forEach((h, i) => {
    doc.text(h, x, y)
    x += colW[i] ?? 22
  })
  y += 4
  doc.setFont('helvetica', 'normal')
  for (const row of rows) {
    if (y > 275) {
      doc.addPage()
      y = 16
    }
    x = margin
    row.forEach((cell, i) => {
      const txt = doc.splitTextToSize(cell, (colW[i] ?? 22) - 1)
      doc.text(txt.slice(0, 2), x, y)
      x += colW[i] ?? 22
    })
    y += 5
  }
  return y + 4
}

export function downloadPlanillaPdf(planilla: PlanillaCajaParsed, cajaNombre?: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margin = 10
  let y = 14
  const caja = cajaNombre || planilla.caja_nombre || '—'

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Planilla de caja — Plot Lab', margin, y)
  y += 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${caja} · ${fmtDateAr(planilla.fecha_desde)} → ${fmtDateAr(planilla.fecha_hasta)} · ${planilla.archivo_nombre}`,
    margin,
    y
  )
  y += 8

  const t = planilla.totales
  if (t) {
    doc.setFont('helvetica', 'bold')
    doc.text('TOTALES DE CAJA', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Ingresos: $ ${fmtArs(t.ingresos_total)} · Efectivo: $ ${fmtArs(t.ingresos_efectivo)} · Tarjetas: $ ${fmtArs(t.ingresos_tarjetas)} · Trans.B: $ ${fmtArs(t.ingresos_trans_b)}`,
      margin,
      y
    )
    y += 4
    doc.text(
      `Egresos: $ ${fmtArs(t.egresos_total)} · Neto: $ ${fmtArs(t.neto)}`,
      margin,
      y
    )
    y += 8
  }

  const numCols = ['Comp.', 'Concepto', 'Total', 'Cta.cte', 'Efec.', 'Tarj.', 'Tr.B.']
  const colW = [28, 52, 22, 22, 22, 22, 22]

  const ventas = planilla.ventas.slice(0, MAX_VENTAS_PDF)
  if (ventas.length) {
    doc.setFont('helvetica', 'bold')
    doc.text(`Ingresos ventas (FA/FB) — ${planilla.ventas.length} líneas`, margin, y)
    y += 5
    y = writeRows(
      doc,
      y,
      margin,
      numCols,
      ventas.map((v) => [
        v.comprobante,
        v.concepto.slice(0, 36),
        fmtArs(v.total),
        fmtArs(v.cta_cte),
        fmtArs(v.efectivo),
        fmtArs(v.tarjetas),
        fmtArs(v.trans_b)
      ]),
      colW
    )
    if (planilla.ventas.length > MAX_VENTAS_PDF) {
      doc.text(`… ${planilla.ventas.length - MAX_VENTAS_PDF} ventas más en el sistema.`, margin, y)
      y += 6
    }
  }

  if (planilla.egresos.length) {
    if (y > 250) {
      doc.addPage()
      y = 16
    }
    doc.setFont('helvetica', 'bold')
    doc.text(`Egresos (EG) — ${planilla.egresos.length}`, margin, y)
    y += 5
    y = writeRows(
      doc,
      y,
      margin,
      numCols,
      planilla.egresos.map((e) => [
        e.comprobante,
        e.concepto.slice(0, 36),
        fmtArs(e.total),
        fmtArs(e.cta_cte),
        fmtArs(e.efectivo),
        fmtArs(e.tarjetas),
        fmtArs(e.trans_b)
      ]),
      colW
    )
  }

  if (planilla.movimientos_mec.length) {
    if (y > 250) {
      doc.addPage()
      y = 16
    }
    doc.setFont('helvetica', 'bold')
    doc.text(`MEC — ${planilla.movimientos_mec.length}`, margin, y)
    y += 5
    y = writeRows(
      doc,
      y,
      margin,
      numCols,
      planilla.movimientos_mec.map((m) => [
        m.comprobante,
        m.concepto.slice(0, 36),
        fmtArs(m.total),
        fmtArs(m.cta_cte),
        fmtArs(m.efectivo),
        fmtArs(m.tarjetas),
        fmtArs(m.trans_b)
      ]),
      colW
    )
  }

  doc.setFontSize(7)
  doc.text(
    `Columnas completas en sistema: ${PLANILLA_LINEA_COLUMNAS.map((c) => c.label).join(', ')}`,
    margin,
    200
  )

  const slug = `${planilla.fecha_hasta || 'planilla'}-${caja}`.replace(/[^\w-]+/g, '_').slice(0, 60)
  doc.save(`planilla-${slug}.pdf`)
}
