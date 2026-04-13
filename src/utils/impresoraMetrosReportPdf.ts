import { jsPDF } from 'jspdf'
import type { ImpresoraUsoReportFila } from '../types/api'
import { isoToArgentinaDateKey, isoToArgentinaTime } from './dateUtils'

function trunc(s: string | null | undefined, max: number): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function sumNums(values: (number | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0), 0)
}

/**
 * PDF listo para imprimir: por impresora, metros y horas usadas por registro de `impresora_uso`.
 */
export function downloadImpresoraMetrosHorasPdf(opts: {
  titulo: string
  periodoLabel: string
  filas: ImpresoraUsoReportFila[]
}): void {
  const { titulo, periodoLabel, filas } = opts
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = margin

  const byImp = new Map<number, { nombre: string; rows: ImpresoraUsoReportFila[] }>()
  for (const f of filas) {
    const cur = byImp.get(f.id_impresora)
    if (cur) {
      cur.rows.push(f)
    } else {
      byImp.set(f.id_impresora, { nombre: f.nombre_impresora, rows: [f] })
    }
  }
  const groups = [...byImp.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'))

  const ensureSpace = (need: number) => {
    const pageH = doc.internal.pageSize.getHeight()
    if (y + need > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, margin, y)
  y += 22
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${periodoLabel}`, margin, y)
  y += 14
  doc.text(`Generado: ${isoToArgentinaDateKey(new Date().toISOString())} ${isoToArgentinaTime(new Date().toISOString())}`, margin, y)
  y += 28

  if (filas.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.text('No hay registros de uso en el período seleccionado.', margin, y)
    doc.save(`reporte_impresoras_${periodoLabel.replace(/\s+/g, '_')}.pdf`)
    return
  }

  const col = {
    op: margin,
    cli: margin + 52,
    tipo: margin + 138,
    m2: margin + 198,
    h: margin + 238,
    ini: margin + 268,
    est: margin + 338
  }

  for (const [, { nombre, rows }] of groups) {
    ensureSpace(70)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(nombre, margin, y)
    y += 16
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('OP', col.op, y)
    doc.text('Cliente', col.cli, y)
    doc.text('Tipo OP', col.tipo, y)
    doc.text('m²', col.m2, y)
    doc.text('Hs', col.h, y)
    doc.text('Inicio (AR)', col.ini, y)
    doc.text('Estado', col.est, y)
    y += 12
    doc.setFont('helvetica', 'normal')

    let subM2 = 0
    let subH = 0
    for (const r of rows) {
      ensureSpace(22)
      const m2 = r.metros_cuadrados
      const hs = r.horas_usadas
      subM2 += m2 != null && Number.isFinite(m2) ? m2 : 0
      subH += hs != null && Number.isFinite(hs) ? hs : 0
      doc.text(trunc(r.numero_op, 10), col.op, y)
      doc.text(trunc(r.cliente, 18), col.cli, y)
      doc.text(trunc(r.tipo_impresion_orden, 12), col.tipo, y)
      doc.text(m2 != null ? String(m2) : '—', col.m2, y)
      doc.text(hs != null ? String(hs) : '—', col.h, y)
      doc.text(`${isoToArgentinaDateKey(r.fecha_inicio)} ${isoToArgentinaTime(r.fecha_inicio)}`, col.ini, y)
      doc.text(trunc(r.estado, 14), col.est, y)
      y += 14
    }

    ensureSpace(20)
    doc.setFont('helvetica', 'bold')
    doc.text(`Subtotal ${nombre}: m² ${subM2.toFixed(2)} · Horas ${subH.toFixed(2)}`, margin, y)
    doc.setFont('helvetica', 'normal')
    y += 22
  }

  const totalM2 = sumNums(filas.map((f) => f.metros_cuadrados))
  const totalH = sumNums(filas.map((f) => f.horas_usadas))
  ensureSpace(30)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`TOTAL general: m² ${totalM2.toFixed(2)} · Horas usadas ${totalH.toFixed(2)}`, margin, y)
  doc.setFont('helvetica', 'normal')

  const safeName = periodoLabel.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_')
  doc.save(`reporte_impresoras_${safeName}.pdf`)
}
