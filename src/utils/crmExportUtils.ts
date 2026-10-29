import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import type {
  FacturaVentaRecord,
  OportunidadVenta,
  Venta,
  VentaCobro,
  VentaItem
} from '../types/api'
import { formatArgentinaDate } from './dateUtils'
import { valorPonderadoPipeline } from './crmVentasHelpers'
import { cargarLogoPlotLabDataUrl } from './relojTabletTarjetaPdf'

function fmtArsPdf(n: number): string {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  need: number,
  margin: number,
  pageHeight: number
): number {
  if (y + need <= pageHeight - margin) return y
  doc.addPage()
  return margin
}

export type ReciboCobrosPdfExtras = {
  items?: VentaItem[]
  factura?: Pick<
    FacturaVentaRecord,
    | 'numero_factura'
    | 'tipo_comprobante'
    | 'punto_venta'
    | 'numero_comprobante'
    | 'cae'
    | 'numero_cae'
    | 'fecha_emision'
    | 'estado_afip'
    | 'estado'
    | 'total'
  > | null
}

function labelFactura(f: NonNullable<ReciboCobrosPdfExtras['factura']>): string {
  if (f.numero_factura?.trim()) return f.numero_factura.trim()
  const pv = Number(f.punto_venta) || 0
  const nro = Number(f.numero_comprobante) || 0
  if (pv > 0 || nro > 0) {
    return `${String(pv).padStart(5, '0')}-${String(nro).padStart(8, '0')}`
  }
  return '—'
}

/**
 * PDF resumen de cobros parciales: fechas, detalle de venta, factura y saldo.
 */
export async function generarReciboCobrosVentaPDF(
  venta: Venta,
  cobros: VentaCobro[],
  extras: ReciboCobrosPdfExtras = {}
): Promise<void> {
  const logo = await cargarLogoPlotLabDataUrl()
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  let y = margin

  const items = extras.items?.length ? extras.items : venta.items || []
  const factura = extras.factura ?? null
  const total = Number(venta.valor_total) || 0
  const pagado = cobros.reduce((s, c) => s + (Number(c.monto) || 0), 0)
  const saldo = Math.max(0, Math.round((total - pagado) * 100) / 100)
  const fechaVenta = venta.fecha_venta
    ? formatArgentinaDate(venta.fecha_venta)
    : '—'
  const generado = new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 38, 'F')
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 38, pageWidth, 2.2, 'F')

  let textX = margin
  if (logo?.dataUrl) {
    const logoH = 14
    const logoW = Math.min(42, logoH * (logo.aspect || 1.7))
    try {
      doc.addImage(logo.dataUrl, 'PNG', margin, 10, logoW, logoH)
      textX = margin + logoW + 6
    } catch {
      /* logo opcional */
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('RESUMEN DE COBROS · PAGO PARCIAL', textX, 14)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text('Plot Center · Plot Lab', textX, 20)
  doc.setTextColor(255, 255, 255)
  doc.text(`Venta ${venta.numero_venta || '—'} · ${venta.cliente_nombre || ''}`, textX, 26)
  doc.setFontSize(8)
  doc.setTextColor(191, 219, 254)
  doc.text(`Fecha venta: ${fechaVenta} · Emitido: ${generado}`, textX, 32)

  y = 48
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Datos de la venta', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const datosVenta: Array<[string, string]> = [
    ['N° venta', venta.numero_venta || String(venta.id)],
    ['Fecha', fechaVenta],
    ['Estado pago', venta.estado_pago || '—'],
    ['Método', venta.metodo_pago || '—'],
    ['Vendedor', venta.nombre_vendedor || '—'],
    ['OP', venta.numero_op || (venta.id_op ? String(venta.id_op) : '—')]
  ]
  if (factura) {
    datosVenta.push(
      ['Factura', `${factura.tipo_comprobante || 'Factura'} ${labelFactura(factura)}`],
      [
        'Factura fecha',
        factura.fecha_emision ? formatArgentinaDate(factura.fecha_emision) : '—'
      ]
    )
    const cae = factura.cae || factura.numero_cae
    if (cae) datosVenta.push(['CAE', String(cae)])
    if (factura.estado_afip) datosVenta.push(['AFIP', String(factura.estado_afip)])
  } else {
    datosVenta.push(['Factura', 'Sin factura AFIP vinculada'])
  }

  const colW = (pageWidth - margin * 2) / 2
  for (let i = 0; i < datosVenta.length; i += 2) {
    y = ensureSpace(doc, y, 6, margin, pageHeight)
    const left = datosVenta[i]
    const right = datosVenta[i + 1]
    doc.setFont('helvetica', 'bold')
    doc.text(`${left[0]}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(left[1].slice(0, 40), margin + 28, y)
    if (right) {
      doc.setFont('helvetica', 'bold')
      doc.text(`${right[0]}:`, margin + colW, y)
      doc.setFont('helvetica', 'normal')
      doc.text(right[1].slice(0, 40), margin + colW + 28, y)
    }
    y += 5
  }
  y += 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Cliente', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(venta.cliente_nombre || '—', margin, y)
  y += 4.5
  const clienteLines = [
    venta.cliente_empresa ? `Empresa: ${venta.cliente_empresa}` : '',
    venta.cliente_dni_cuit ? `CUIT/DNI: ${venta.cliente_dni_cuit}` : '',
    venta.cliente_telefono ? `Tel: ${venta.cliente_telefono}` : '',
    venta.cliente_email ? `Email: ${venta.cliente_email}` : '',
    venta.cliente_direccion ? `Dirección: ${venta.cliente_direccion}` : ''
  ].filter(Boolean)
  for (const line of clienteLines) {
    y = ensureSpace(doc, y, 5, margin, pageHeight)
    doc.text(line.slice(0, 100), margin, y)
    y += 4.5
  }
  y += 3

  y = ensureSpace(doc, y, 26, margin, pageHeight)
  doc.setFillColor(239, 246, 255)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 64, 175)
  doc.text(`Total venta  $ ${fmtArsPdf(total)}`, margin + 4, y + 7)
  doc.text(`Cobrado      $ ${fmtArsPdf(pagado)}`, margin + 4, y + 13)
  doc.setTextColor(saldo > 0 ? 185 : 21, saldo > 0 ? 28 : 128, saldo > 0 ? 28 : 61)
  doc.text(`Saldo        $ ${fmtArsPdf(saldo)}`, margin + 4, y + 19)
  y += 28

  if (items.length > 0) {
    y = ensureSpace(doc, y, 18, margin, pageHeight)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Detalle de la venta', margin, y)
    y += 5
    doc.setDrawColor(148, 163, 184)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Cant.', margin, y)
    doc.text('Descripción', margin + 14, y)
    doc.text('P. unit.', margin + 118, y)
    doc.text('Total', pageWidth - margin, y, { align: 'right' })
    y += 4
    doc.setFont('helvetica', 'normal')
    for (const item of items) {
      y = ensureSpace(doc, y, 8, margin, pageHeight)
      const cant = Number(item.cantidad) || 0
      const pu = Number(item.precio_unitario) || 0
      const lineTotal =
        Number(item.precio_total) ||
        Math.round((cant * pu - (Number(item.descuento) || 0)) * 100) / 100
      const desc = String(item.descripcion || '—')
      const descLines = doc.splitTextToSize(desc, 100) as string[]
      doc.text(String(cant), margin, y)
      doc.text(descLines[0] || '—', margin + 14, y)
      doc.text(`$ ${fmtArsPdf(pu)}`, margin + 118, y)
      doc.text(`$ ${fmtArsPdf(lineTotal)}`, pageWidth - margin, y, { align: 'right' })
      y += 4
      for (let i = 1; i < descLines.length && i < 3; i++) {
        y = ensureSpace(doc, y, 5, margin, pageHeight)
        doc.setTextColor(100, 116, 139)
        doc.text(descLines[i], margin + 14, y)
        doc.setTextColor(15, 23, 42)
        y += 3.8
      }
      y += 1.5
    }
    y += 3
  }

  y = ensureSpace(doc, y, 18, margin, pageHeight)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Detalle de cobros', margin, y)
  y += 5
  doc.setDrawColor(148, 163, 184)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Fecha', margin, y)
  doc.text('Medio', margin + 28, y)
  doc.text('Caja', margin + 70, y)
  doc.text('Monto', pageWidth - margin, y, { align: 'right' })
  y += 4
  doc.setFont('helvetica', 'normal')

  if (!cobros.length) {
    doc.setTextColor(100, 116, 139)
    doc.text('Sin cobros registrados aún.', margin, y)
    y += 8
  }

  for (const c of cobros) {
    y = ensureSpace(doc, y, 12, margin, pageHeight)
    doc.setTextColor(15, 23, 42)
    const fecha = c.fecha_pago ? formatArgentinaDate(c.fecha_pago) : '—'
    doc.text(fecha, margin, y)
    doc.text(String(c.metodo_pago || '—').slice(0, 18), margin + 28, y)
    doc.text(String(c.caja_slug || '—').slice(0, 16), margin + 70, y)
    doc.text(`$ ${fmtArsPdf(Number(c.monto) || 0)}`, pageWidth - margin, y, { align: 'right' })
    y += 4
    if (c.observaciones?.trim() || c.usuario_nombre) {
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      const meta = [c.usuario_nombre, c.observaciones?.trim()].filter(Boolean).join(' · ')
      doc.text(meta.slice(0, 110), margin, y)
      y += 3.5
      doc.setFontSize(8)
    }
    y += 1.5
  }

  if (venta.observaciones?.trim()) {
    y = ensureSpace(doc, y, 16, margin, pageHeight)
    y += 3
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Observaciones', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const obsLines = doc.splitTextToSize(venta.observaciones.trim(), pageWidth - margin * 2) as string[]
    for (const line of obsLines.slice(0, 8)) {
      y = ensureSpace(doc, y, 5, margin, pageHeight)
      doc.text(line, margin, y)
      y += 3.8
    }
  }

  y = ensureSpace(doc, y, 18, margin, pageHeight)
  y += 6
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Estado: ${venta.estado_pago || (saldo > 0 ? 'Parcial' : 'Pagado')} · Saldo pendiente $ ${fmtArsPdf(saldo)} · ${generado}`,
    margin,
    y
  )
  y += 4
  doc.text(
    'Documento trazable desde Plot Lab · los cobros impactan control de cajas.',
    margin,
    y
  )

  doc.save(`recibo-cobros-${venta.numero_venta || venta.id}.pdf`)
}

/** Carga ítems + factura y genera el PDF enriquecido. */
export async function generarReciboCobrosVentaPDFCompleto(
  venta: Venta,
  cobros: VentaCobro[]
): Promise<void> {
  const api = (await import('../services/api')).default
  const [itemsRes, factRes] = await Promise.all([
    venta.items?.length
      ? Promise.resolve({ success: true as const, data: venta.items })
      : api.getItemsVenta(venta.id),
    api.getFacturaPorVenta(venta.id)
  ])
  await generarReciboCobrosVentaPDF(venta, cobros, {
    items: itemsRes.success ? itemsRes.data || [] : [],
    factura: factRes.success ? factRes.data : null
  })
}

/**
 * Exporta ventas a PDF
 */
export function exportarVentasPDF(ventas: Venta[], _filtros?: { fechaDesde?: string; fechaHasta?: string; estadoPago?: string }): void {
  const doc = new jsPDF('l', 'mm', 'a4') // Landscape para más espacio
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const lineHeight = 7
  let yPos = margin

  // Título
  doc.setFontSize(18)
  doc.setTextColor(59, 130, 246) // Azul
  doc.setFont('helvetica', 'bold')
  doc.text('Reporte de Ventas', margin, yPos)
  yPos += lineHeight * 2

  // Información de filtros
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  const fechaGeneracion = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  doc.text(`Generado el ${fechaGeneracion}`, margin, yPos)
  yPos += lineHeight

  if (_filtros) {
    if (_filtros.fechaDesde || _filtros.fechaHasta) {
      const fechaDesde = _filtros.fechaDesde ? formatArgentinaDate(_filtros.fechaDesde) : 'Inicio'
      const fechaHasta = _filtros.fechaHasta ? formatArgentinaDate(_filtros.fechaHasta) : 'Hoy'
      doc.text(`Período: ${fechaDesde} - ${fechaHasta}`, margin, yPos)
      yPos += lineHeight
    }
    if (_filtros.estadoPago && _filtros.estadoPago !== 'todos') {
      doc.text(`Estado de Pago: ${_filtros.estadoPago}`, margin, yPos)
      yPos += lineHeight
    }
  }

  doc.text(`Total de ventas: ${ventas.length}`, margin, yPos)
  yPos += lineHeight * 2

  // Resumen estadístico
  const totalIngresos = ventas.reduce((sum, v) => sum + v.valor_total, 0)
  const ventasPagadas = ventas.filter(v => v.estado_pago === 'Pagado')
  const ingresosPagados = ventasPagadas.reduce((sum, v) => sum + v.valor_total, 0)
  const ventasPendientes = ventas.filter(v => v.estado_pago === 'Pendiente')
  const ingresosPendientes = ventasPendientes.reduce((sum, v) => sum + v.valor_total, 0)

  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen', margin, yPos)
  yPos += lineHeight * 1.5

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Ingresos: $${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, margin, yPos)
  yPos += lineHeight
  doc.text(`Ingresos Pagados: $${ingresosPagados.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (${ventasPagadas.length} ventas)`, margin, yPos)
  yPos += lineHeight
  doc.text(`Ingresos Pendientes: $${ingresosPendientes.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (${ventasPendientes.length} ventas)`, margin, yPos)
  yPos += lineHeight * 2

  // Tabla de ventas. El número (VENT-20260925-0004) no entra en 25 mm y se montaba sobre la fecha.
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Detalle de Ventas', margin, yPos)
  yPos += lineHeight * 1.5

  const usable = pageWidth - margin * 2
  const colWidths = [52, 26, 58, 32, 34, 24, 0]
  colWidths[6] = usable - colWidths.slice(0, 6).reduce((sum, w) => sum + w, 0)
  const headers = ['N° Venta', 'Fecha', 'Cliente', 'Total', 'Método de pago', 'Estado', 'Vendedor']
  const rowHeight = 7

  const textoEnColumna = (text: string, width: number): string => {
    const limit = Math.max(6, width - 2)
    if (doc.getTextWidth(text) <= limit) return text
    const ellipsis = '…'
    let cut = text
    while (cut.length > 1 && doc.getTextWidth(`${cut}${ellipsis}`) > limit) {
      cut = cut.slice(0, -1)
    }
    return `${cut}${ellipsis}`
  }

  const drawTableHeader = (): void => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(203, 213, 225)
    doc.rect(margin, yPos - 4.5, usable, rowHeight, 'FD')
    let x = margin
    headers.forEach((header, index) => {
      doc.setTextColor(15, 23, 42)
      const label = textoEnColumna(header, colWidths[index])
      if (index === 3) {
        doc.text(label, x + colWidths[index] - 1.5, yPos, { align: 'right' })
      } else {
        doc.text(label, x + 1.5, yPos)
      }
      x += colWidths[index]
    })
    yPos += rowHeight
  }

  drawTableHeader()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  ventas.forEach((venta, index) => {
    if (yPos + rowHeight > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      drawTableHeader()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, yPos - 4.5, usable, rowHeight, 'F')
    }

    const cells = [
      venta.numero_venta || '-',
      venta.fecha_venta ? formatArgentinaDate(venta.fecha_venta) : '-',
      venta.cliente_nombre || '-',
      `$${venta.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      venta.metodo_pago || '-',
      venta.estado_pago || '-',
      venta.nombre_vendedor || '-'
    ]

    doc.setTextColor(15, 23, 42)
    let x = margin
    cells.forEach((cell, col) => {
      const label = textoEnColumna(String(cell), colWidths[col])
      if (col === 3) {
        doc.text(label, x + colWidths[col] - 1.5, yPos, { align: 'right' })
      } else {
        doc.text(label, x + 1.5, yPos)
      }
      x += colWidths[col]
    })

    doc.setDrawColor(226, 232, 240)
    doc.line(margin, yPos + 2.2, margin + usable, yPos + 2.2)
    yPos += rowHeight
  })

  // Pie de página
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Guardar PDF
  const fechaArchivo = new Date().toISOString().split('T')[0]
  doc.save(`reporte-ventas-${fechaArchivo}.pdf`)
}

/**
 * Exporta ventas a Excel
 */
export function exportarVentasExcel(ventas: Venta[], _filtros?: { fechaDesde?: string; fechaHasta?: string; estadoPago?: string }): void {
  // Preparar datos para Excel
  const datos = ventas.map(venta => ({
    'N° Venta': venta.numero_venta || '',
    'Fecha': venta.fecha_venta ? formatArgentinaDate(venta.fecha_venta) : '',
    'Cliente': venta.cliente_nombre || '',
    'Teléfono': venta.cliente_telefono || '',
    'Email': venta.cliente_email || '',
    'DNI/CUIT': venta.cliente_dni_cuit || '',
    'Total': venta.valor_total,
    'Método Pago': venta.metodo_pago || '',
    'Estado Pago': venta.estado_pago || '',
    'Vendedor': venta.nombre_vendedor || '',
    'N° OP': venta.numero_op || '',
    'Observaciones': venta.observaciones || '',
    'Items': venta.items?.map(i => `${i.cantidad}x ${i.descripcion}`).join('; ') || ''
  }))

  // Crear workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(datos)

  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 22 }, // N° Venta
    { wch: 12 }, // Fecha
    { wch: 30 }, // Cliente
    { wch: 15 }, // Teléfono
    { wch: 25 }, // Email
    { wch: 15 }, // DNI/CUIT
    { wch: 15 }, // Total
    { wch: 15 }, // Método Pago
    { wch: 12 }, // Estado Pago
    { wch: 20 }, // Vendedor
    { wch: 12 }, // N° OP
    { wch: 40 }, // Observaciones
    { wch: 50 }  // Items
  ]
  ws['!cols'] = colWidths

  // Agregar hoja al workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

  // Agregar hoja de resumen
  const resumen = [
    { 'Métrica': 'Total Ventas', 'Valor': ventas.length },
    { 'Métrica': 'Total Ingresos', 'Valor': ventas.reduce((sum, v) => sum + v.valor_total, 0) },
    { 'Métrica': 'Ventas Pagadas', 'Valor': ventas.filter(v => v.estado_pago === 'Pagado').length },
    { 'Métrica': 'Ingresos Pagados', 'Valor': ventas.filter(v => v.estado_pago === 'Pagado').reduce((sum, v) => sum + v.valor_total, 0) },
    { 'Métrica': 'Ventas Pendientes', 'Valor': ventas.filter(v => v.estado_pago === 'Pendiente').length },
    { 'Métrica': 'Ingresos Pendientes', 'Valor': ventas.filter(v => v.estado_pago === 'Pendiente').reduce((sum, v) => sum + v.valor_total, 0) }
  ]
  const wsResumen = XLSX.utils.json_to_sheet(resumen)
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Guardar archivo
  const fechaArchivo = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `reporte-ventas-${fechaArchivo}.xlsx`)
}

/**
 * Exporta oportunidades a PDF
 */
export function exportarOportunidadesPDF(oportunidades: OportunidadVenta[]): void {
  const doc = new jsPDF('l', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const lineHeight = 7
  let yPos = margin

  const checkNewPage = (requiredSpace: number): void => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
    }
  }

  // Título
  doc.setFontSize(18)
  doc.setTextColor(139, 92, 246) // Púrpura
  doc.setFont('helvetica', 'bold')
  doc.text('Reporte de Oportunidades', margin, yPos)
  yPos += lineHeight * 2

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  const fechaGeneracion = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  doc.text(`Generado el ${fechaGeneracion}`, margin, yPos)
  yPos += lineHeight
  doc.text(`Total de oportunidades: ${oportunidades.length}`, margin, yPos)
  yPos += lineHeight
  const ponderado = valorPonderadoPipeline(oportunidades)
  doc.text(
    `Valor ponderado (pipeline activo): $${ponderado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    margin,
    yPos
  )
  yPos += lineHeight * 2

  // Resumen por etapa
  const etapas = ['Prospecto', 'Calificación', 'Propuesta', 'Negociación', 'Cerrado', 'Perdido']
  const resumenEtapas = etapas.map(etapa => ({
    etapa,
    count: oportunidades.filter(o => o.etapa === etapa).length,
    valor: oportunidades.filter(o => o.etapa === etapa).reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
  }))

  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen por Etapa', margin, yPos)
  yPos += lineHeight * 1.5

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  resumenEtapas.forEach(item => {
    checkNewPage(lineHeight)
    doc.text(`${item.etapa}: ${item.count} oportunidades - Valor estimado: $${item.valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, margin, yPos)
    yPos += lineHeight
  })
  yPos += lineHeight

  // Detalle de oportunidades
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalle de Oportunidades', margin, yPos)
  yPos += lineHeight * 1.5

  oportunidades.forEach((opp, index) => {
    checkNewPage(lineHeight * 8)

    if (index > 0) {
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += lineHeight
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(139, 92, 246)
    doc.text(`OPP: ${opp.numero_oportunidad}`, margin, yPos)
    yPos += lineHeight

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)

    const detalles = [
      `Cliente: ${opp.cliente_nombre}`,
      `Etapa: ${opp.etapa}`,
      `Valor Estimado: $${(opp.valor_estimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      `Probabilidad de Cierre: ${opp.probabilidad_cierre}%`,
      `Vendedor: ${opp.nombre_vendedor}`,
      `Fecha Cierre Estimada: ${opp.fecha_cierre_estimada ? formatArgentinaDate(opp.fecha_cierre_estimada) : 'No definida'}`
    ]

    detalles.forEach(detalle => {
      checkNewPage(lineHeight)
      doc.text(detalle, margin + 5, yPos)
      yPos += lineHeight
    })

    if (opp.descripcion) {
      checkNewPage(lineHeight * 2)
      const descLines = doc.splitTextToSize(`Descripción: ${opp.descripcion}`, pageWidth - margin * 2 - 10)
      doc.text(descLines, margin + 5, yPos)
      yPos += lineHeight * descLines.length
    }

    yPos += lineHeight * 0.5
  })

  // Pie de página
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  const fechaArchivo = new Date().toISOString().split('T')[0]
  doc.save(`reporte-oportunidades-${fechaArchivo}.pdf`)
}

/**
 * Exporta oportunidades a CSV (UTF-8 con BOM, separador ; para Excel en es-AR).
 */
export function exportarOportunidadesCSV(oportunidades: OportunidadVenta[]): void {
  const headers = [
    'numero_oportunidad',
    'cliente_nombre',
    'cliente_empresa',
    'etapa',
    'valor_estimado',
    'probabilidad_cierre',
    'valor_ponderado',
    'fecha_cierre_estimada',
    'numero_op',
    'vendedor',
    'descripcion',
    'observaciones',
    'created_at'
  ]

  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }

  const rows = oportunidades.map((o) => {
    const prob = (o.probabilidad_cierre ?? 0) / 100
    const ponderado = (o.valor_estimado ?? 0) * prob
    return [
      o.numero_oportunidad,
      o.cliente_nombre,
      o.cliente_empresa ?? '',
      o.etapa,
      o.valor_estimado ?? '',
      o.probabilidad_cierre,
      Math.round(ponderado * 100) / 100,
      o.fecha_cierre_estimada ?? '',
      o.numero_op ?? '',
      o.nombre_vendedor,
      (o.descripcion ?? '').replace(/\r?\n/g, ' '),
      (o.observaciones ?? '').replace(/\r?\n/g, ' '),
      o.created_at ?? ''
    ]
  })

  const line = (cells: (string | number)[]) => cells.map(esc).join(';')
  const csv = [line(headers), ...rows.map(line)].join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oportunidades-crm-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Genera factura/remito en PDF para una venta
 */
export function generarFacturaRemitoPDF(venta: Venta, tipo: 'factura' | 'remito' = 'factura'): void {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  // Encabezado
  doc.setFontSize(20)
  doc.setTextColor(59, 130, 246)
  doc.setFont('helvetica', 'bold')
  doc.text(tipo === 'factura' ? 'FACTURA' : 'REMITO', pageWidth - margin, yPos, { align: 'right' })
  yPos += 10

  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(`N° ${venta.numero_venta}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 8

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha: ${venta.fecha_venta ? formatArgentinaDate(venta.fecha_venta) : formatArgentinaDate(new Date().toISOString())}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 15

  // Datos del cliente
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Cliente:', margin, yPos)
  yPos += 7

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(venta.cliente_nombre || '', margin + 5, yPos)
  yPos += 5
  if (venta.cliente_telefono) {
    doc.text(`Tel: ${venta.cliente_telefono}`, margin + 5, yPos)
    yPos += 5
  }
  if (venta.cliente_email) {
    doc.text(`Email: ${venta.cliente_email}`, margin + 5, yPos)
    yPos += 5
  }
  if (venta.cliente_dni_cuit) {
    doc.text(`DNI/CUIT: ${venta.cliente_dni_cuit}`, margin + 5, yPos)
    yPos += 5
  }
  if (venta.cliente_direccion) {
    doc.text(`Dirección: ${venta.cliente_direccion}`, margin + 5, yPos)
    yPos += 5
  }
  yPos += 10

  // Tabla de items
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  const colWidths = [15, 80, 20, 25, 30]
  const headers = ['Cant.', 'Descripción', 'P. Unit.', 'Desc.', 'Total']
  let xPos = margin
  headers.forEach((header, index) => {
    doc.text(header, xPos, yPos)
    xPos += colWidths[index]
  })
  yPos += 5
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 5

  doc.setFont('helvetica', 'normal')
  const items = venta.items || []
  items.forEach(item => {
    const cantidad = item.cantidad.toString()
    const descripcion = item.descripcion.length > 35 ? item.descripcion.substring(0, 32) + '...' : item.descripcion
    const precioUnit = `$${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    const descuento = (item.descuento && item.descuento > 0) ? `$${item.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'
    const total = `$${item.precio_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

    xPos = margin
    doc.text(cantidad, xPos, yPos)
    xPos += colWidths[0]
    doc.text(descripcion, xPos, yPos)
    xPos += colWidths[1]
    doc.text(precioUnit, xPos, yPos)
    xPos += colWidths[2]
    doc.text(descuento, xPos, yPos)
    xPos += colWidths[3]
    doc.text(total, xPos, yPos)

    yPos += 6
  })

  yPos += 5
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // Total
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`TOTAL: $${venta.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 10

  // Método de pago y estado
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Método de Pago: ${venta.metodo_pago || 'No especificado'}`, margin, yPos)
  yPos += 5
  doc.text(`Estado: ${venta.estado_pago || 'Pendiente'}`, margin, yPos)
  yPos += 10

  // Observaciones
  if (venta.observaciones) {
    doc.setFont('helvetica', 'bold')
    doc.text('Observaciones:', margin, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    const obsLines = doc.splitTextToSize(venta.observaciones, pageWidth - margin * 2)
    doc.text(obsLines, margin, yPos)
  }

  // Pie de página
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-AR')}`,
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  )

  const nombreArchivo = tipo === 'factura' ? `factura-${venta.numero_venta}` : `remito-${venta.numero_venta}`
  doc.save(`${nombreArchivo}.pdf`)
}

/**
 * Convierte un número a texto en español argentino
 */
export function numeroALetras(numero: number): string {
  const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  if (numero === 0) return 'cero'
  if (numero === 100) return 'cien'

  let resultado = ''
  const parteEntera = Math.floor(numero)
  const parteDecimal = Math.round((numero - parteEntera) * 100)

  // Miles
  if (parteEntera >= 1000) {
    const miles = Math.floor(parteEntera / 1000)
    if (miles === 1) {
      resultado += 'mil '
    } else {
      resultado += numeroALetras(miles) + ' mil '
    }
  }

  // Centenas
  const centena = Math.floor((parteEntera % 1000) / 100)
  if (centena > 0) {
    resultado += centenas[centena] + ' '
  }

  // Decenas y unidades
  const resto = parteEntera % 100
  if (resto >= 10 && resto < 20) {
    resultado += especiales[resto - 10] + ' '
  } else {
    const decena = Math.floor(resto / 10)
    const unidad = resto % 10
    if (decena > 1) {
      resultado += decenas[decena]
      if (unidad > 0) {
        resultado += ' y '
      }
    }
    if (unidad > 0) {
      resultado += unidades[unidad] + ' '
    }
  }

  resultado += 'pesos'
  if (parteDecimal > 0) {
    resultado += ' con ' + parteDecimal.toString().padStart(2, '0') + '/100'
  }

  return resultado.trim()
}

/**
 * Genera pagaré en PDF para una venta
 */
export function generarPagarePDF(venta: Venta, fechaVencimiento?: string): void {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  // Título
  doc.setFontSize(24)
  doc.setTextColor(59, 130, 246)
  doc.setFont('helvetica', 'bold')
  doc.text('PAGARÉ', pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  // Número de pagaré
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(`N° ${venta.numero_venta || 'N/A'}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 10

  // Lugar y fecha
  const fechaEmision = venta.fecha_venta ? formatArgentinaDate(venta.fecha_venta) : formatArgentinaDate(new Date().toISOString())
  doc.setFontSize(10)
  doc.text(`En San Juan, a los ${new Date().getDate()} días del mes de ${new Date().toLocaleDateString('es-AR', { month: 'long' })} de ${new Date().getFullYear()}`, margin, yPos)
  yPos += 15

  // Texto del pagaré
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const montoEnLetras = numeroALetras(venta.valor_total).charAt(0).toUpperCase() + numeroALetras(venta.valor_total).slice(1)
  
  const fechaVencDate = fechaVencimiento ? new Date(fechaVencimiento) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const fechaVencTexto = fechaVencimiento 
    ? `a los ${fechaVencDate.getDate()} días del mes de ${fechaVencDate.toLocaleDateString('es-AR', { month: 'long' })} de ${fechaVencDate.getFullYear()}`
    : '30 días'

  const textoPagare = `Por medio del presente documento, yo ${venta.cliente_nombre || '___________________'} (DNI/CUIT: ${venta.cliente_dni_cuit || '___________________'}), me comprometo a pagar incondicionalmente a la orden de PLOT CENTER S.R.L., la suma de ${montoEnLetras} ($${venta.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) el día ${fechaVencTexto}, en el domicilio de la empresa ubicado en San Juan, o en el lugar que ésta indique.`

  const textoLines = doc.splitTextToSize(textoPagare, pageWidth - margin * 2)
  textoLines.forEach((line: string) => {
    doc.text(line, margin, yPos)
    yPos += 6
  })
  yPos += 10

  // Detalle de la deuda
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalle de la deuda:', margin, yPos)
  yPos += 8

  doc.setFont('helvetica', 'normal')
  doc.text(`Venta N°: ${venta.numero_venta || 'N/A'}`, margin + 5, yPos)
  yPos += 5
  if (venta.numero_op) {
    doc.text(`Orden de Trabajo N°: ${venta.numero_op}`, margin + 5, yPos)
    yPos += 5
  }
  doc.text(`Fecha de venta: ${fechaEmision}`, margin + 5, yPos)
  yPos += 5
  doc.text(`Monto total: $${venta.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, margin + 5, yPos)
  yPos += 10

  // Items si existen
  if (venta.items && venta.items.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Concepto:', margin, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    venta.items.forEach((item) => {
      const concepto = `${item.cantidad}x ${item.descripcion} - $${item.precio_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
      doc.text(concepto, margin + 5, yPos)
      yPos += 5
    })
    yPos += 5
  }

  // Observaciones si existen
  if (venta.observaciones) {
    doc.setFont('helvetica', 'bold')
    doc.text('Observaciones:', margin, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    const obsLines = doc.splitTextToSize(venta.observaciones, pageWidth - margin * 2 - 10)
    doc.text(obsLines, margin + 5, yPos)
    yPos += obsLines.length * 5 + 5
  }

  // Texto legal
  yPos += 5
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'italic')
  const textoLegal = 'En caso de incumplimiento, el deudor se obliga al pago de intereses y gastos que se originen, renunciando al fuero de su domicilio y sometiéndose a los tribunales de San Juan.'
  const legalLines = doc.splitTextToSize(textoLegal, pageWidth - margin * 2)
  legalLines.forEach((line: string) => {
    doc.text(line, margin, yPos)
    yPos += 5
  })
  yPos += 15

  // Firma del deudor
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8
  doc.text('Firma del deudor', margin, yPos, { align: 'left' })
  yPos += 5
  doc.text(venta.cliente_nombre || '___________________', margin, yPos)
  yPos += 5
  if (venta.cliente_dni_cuit) {
    doc.text(`DNI/CUIT: ${venta.cliente_dni_cuit}`, margin, yPos)
  }

  // Datos del acreedor
  yPos = pageHeight - 60
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Acreedor:', margin, yPos)
  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.text('PLOT CENTER S.R.L.', margin, yPos)
  yPos += 5
  doc.text('CUIT: 30-XXXXXXXX-X', margin, yPos)
  yPos += 5
  doc.text('San Juan, Argentina', margin, yPos)

  // Pie de página
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-AR')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  const nombreArchivo = `pagare-${venta.numero_venta}`
  doc.save(`${nombreArchivo}.pdf`)
}

