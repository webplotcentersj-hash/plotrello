import jsPDF from 'jspdf'
import { fmtArs, fmtDateAr } from './format'
import type { InformeVentasPeriodo } from './informeVentasPeriodo'

function pdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map: Record<string, string> = { Ñ: 'N', ñ: 'n' }
      return map[ch] ?? ''
    })
}

function short(value: string | null | undefined, max: number): string {
  const t = pdfText(value).trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

type TableCol = { header: string; width: number; align?: 'left' | 'right' }

function drawTable(
  doc: jsPDF,
  y: number,
  margin: number,
  pageBottom: number,
  cols: TableCol[],
  rows: string[][],
  opts?: { title?: string; fontSize?: number }
): number {
  const fontSize = opts?.fontSize ?? 7
  const lineH = Math.max(3.8, fontSize * 0.352778 * 1.35)
  const padY = 1.4
  const headerH = lineH + padY * 2
  const rowH = lineH + padY * 2
  const totalW = cols.reduce((s, c) => s + c.width, 0)

  const ensure = (need: number, redrawHeader: boolean) => {
    if (y + need <= pageBottom) return
    doc.addPage()
    y = 12
    if (opts?.title) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(pdfText(opts.title) + ' (cont.)', margin, y)
      y += 5
    }
    if (redrawHeader) drawHeader()
  }

  const drawHeader = () => {
    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y, totalW, headerH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fontSize)
    let x = margin
    const textY = y + padY + lineH * 0.72
    for (const c of cols) {
      doc.text(c.header, c.align === 'right' ? x + c.width - 1 : x + 0.5, textY, {
        align: c.align === 'right' ? 'right' : 'left'
      })
      x += c.width
    }
    y += headerH
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.2)
    doc.line(margin, y, margin + totalW, y)
    doc.setFont('helvetica', 'normal')
  }

  if (opts?.title) {
    ensure(12, false)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(pdfText(opts.title), margin, y)
    y += 5
  }

  ensure(headerH + rowH, false)
  drawHeader()

  for (const row of rows) {
    ensure(rowH + 1, true)
    let x = margin
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', 'normal')
    const textY = y + padY + lineH * 0.72
    row.forEach((cell, i) => {
      const c = cols[i]
      if (!c) return
      doc.text(short(cell, Math.floor(c.width * 1.6)), c.align === 'right' ? x + c.width - 1 : x + 0.5, textY, {
        align: c.align === 'right' ? 'right' : 'left'
      })
      x += c.width
    })
    y += rowH
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.1)
    doc.line(margin, y, margin + totalW, y)
  }
  return y + 4
}

export function downloadInformeVentasPeriodoPdf(informe: InformeVentasPeriodo): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 12
  const pageBottom = 285
  let y = 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(pdfText(`Informe de ventas — ${informe.labelPeriodo}`), margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    pdfText(
      `Periodo ${fmtDateAr(informe.desde)} a ${fmtDateAr(informe.hasta)} · Generado ${new Date().toLocaleString('es-AR')}`
    ),
    margin,
    y
  )
  y += 8

  const k = informe.kpis
  const vs =
    k.pctVsPrev == null
      ? 'sin base previa'
      : `${k.pctVsPrev >= 0 ? '+' : ''}${k.pctVsPrev}% vs ${pdfText(informe.labelPrev)} ($ ${fmtArs(k.cobradoPrev)})`

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(pdfText(`Cobrado: $ ${fmtArs(k.cobrado)}  ·  Ticket: $ ${fmtArs(k.ticketPromedio)}`), margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    pdfText(
      `Ventas cobradas ${k.ventasCobradas}/${k.ventasTotales} · Parciales ${k.parciales} · Pendientes ${k.pendientes} · Canceladas ${k.canceladas} · ${vs}`
    ),
    margin,
    y
  )
  y += 8

  if (informe.mejorDia || informe.peorDia) {
    doc.setFontSize(8)
    if (informe.mejorDia) {
      doc.text(
        pdfText(`Mejor dia: ${fmtDateAr(informe.mejorDia.fecha)} ($ ${fmtArs(informe.mejorDia.cobrado)})`),
        margin,
        y
      )
      y += 4
    }
    if (informe.peorDia && informe.peorDia.fecha !== informe.mejorDia?.fecha) {
      doc.text(
        pdfText(`Peor dia con cobro: ${fmtDateAr(informe.peorDia.fecha)} ($ ${fmtArs(informe.peorDia.cobrado)})`),
        margin,
        y
      )
      y += 4
    }
    y += 2
  }

  y = drawTable(
    doc,
    y,
    margin,
    pageBottom,
    [
      { header: 'Fecha', width: 22 },
      { header: 'Cobrado', width: 28, align: 'right' },
      { header: 'Ventas', width: 16, align: 'right' },
      { header: 'Pagadas', width: 18, align: 'right' },
      { header: 'Parcial', width: 16, align: 'right' },
      { header: 'Pend.', width: 16, align: 'right' },
      { header: 'Ticket', width: 26, align: 'right' }
    ],
    informe.porDia.map((d) => [
      fmtDateAr(d.fecha),
      fmtArs(d.cobrado),
      String(d.ventas),
      String(d.pagadas),
      String(d.parciales),
      String(d.pendientes),
      fmtArs(d.ticketPromedio)
    ]),
    { title: 'Detalle por dia' }
  )

  const nombreTabla = (
    title: string,
    filas: { nombre: string; monto: number; cantidad: number; pct: number }[]
  ) => {
    if (!filas.length) return
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'Nombre', width: 70 },
        { header: 'Monto', width: 32, align: 'right' },
        { header: 'Cant.', width: 18, align: 'right' },
        { header: '%', width: 18, align: 'right' }
      ],
      filas.map((f) => [f.nombre, fmtArs(f.monto), String(f.cantidad), `${f.pct}%`]),
      { title }
    )
  }

  nombreTabla('Por medio de pago', informe.porMetodo)
  nombreTabla('Por vendedor', informe.porVendedor)
  nombreTabla('Por caja de cobro', informe.porCaja)
  nombreTabla('Por estado', informe.porEstado)
  nombreTabla('Top productos', informe.topProductos)
  nombreTabla('Top clientes', informe.topClientes)

  if (informe.topVentas.length) {
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'N°', width: 22 },
        { header: 'Fecha', width: 18 },
        { header: 'Cliente', width: 40 },
        { header: 'Medio', width: 28 },
        { header: 'Cobrado', width: 28, align: 'right' },
        { header: 'Est.', width: 18 }
      ],
      informe.topVentas.map((v) => [
        v.numero,
        fmtDateAr(v.fecha),
        v.cliente,
        v.metodo,
        fmtArs(v.cobrado),
        v.estado
      ]),
      { title: 'Mayores ventas del periodo' }
    )
  }

  const slug =
    informe.modo === 'semana'
      ? `semana_${informe.desde}_${informe.hasta}`
      : `mes_${informe.desde.slice(0, 7)}`
  doc.save(`informe_ventas_${slug}.pdf`)
}
