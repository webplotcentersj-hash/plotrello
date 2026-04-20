import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import type { Venta, OportunidadVenta } from '../types/api'
import { formatArgentinaDate } from './dateUtils'
import { valorPonderadoPipeline } from './crmVentasHelpers'

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

  // Función para agregar nueva página si es necesario
  const checkNewPage = (requiredSpace: number): void => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
    }
  }

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

  // Tabla de ventas
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalle de Ventas', margin, yPos)
  yPos += lineHeight * 1.5

  // Encabezados de tabla
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const colWidths = [25, 35, 50, 25, 30, 25, 30]
  const headers = ['N° Venta', 'Fecha', 'Cliente', 'Total', 'Método Pago', 'Estado', 'Vendedor']
  let xPos = margin
  headers.forEach((header, index) => {
    doc.text(header, xPos, yPos)
    xPos += colWidths[index]
  })
  yPos += lineHeight
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += lineHeight * 0.5

  // Filas de datos
  doc.setFont('helvetica', 'normal')
  ventas.forEach((venta, index) => {
    checkNewPage(lineHeight * 2)

    if (index > 0 && yPos > pageHeight - margin - lineHeight * 3) {
      doc.addPage()
      yPos = margin
      // Redibujar encabezados
      doc.setFont('helvetica', 'bold')
      xPos = margin
      headers.forEach((header, idx) => {
        doc.text(header, xPos, yPos)
        xPos += colWidths[idx]
      })
      yPos += lineHeight
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += lineHeight * 0.5
      doc.setFont('helvetica', 'normal')
    }

    const fecha = venta.fecha_venta ? formatArgentinaDate(venta.fecha_venta) : '-'
    const cliente = venta.cliente_nombre.length > 20 ? venta.cliente_nombre.substring(0, 17) + '...' : venta.cliente_nombre
    const total = `$${venta.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    const metodoPago = venta.metodo_pago || '-'
    const estado = venta.estado_pago || '-'
    const vendedor = venta.nombre_vendedor?.length > 15 ? venta.nombre_vendedor.substring(0, 12) + '...' : (venta.nombre_vendedor || '-')

    xPos = margin
    doc.text(venta.numero_venta || '-', xPos, yPos)
    xPos += colWidths[0]
    doc.text(fecha, xPos, yPos)
    xPos += colWidths[1]
    doc.text(cliente, xPos, yPos)
    xPos += colWidths[2]
    doc.text(total, xPos, yPos)
    xPos += colWidths[3]
    doc.text(metodoPago, xPos, yPos)
    xPos += colWidths[4]
    doc.text(estado, xPos, yPos)
    xPos += colWidths[5]
    doc.text(vendedor, xPos, yPos)

    yPos += lineHeight * 1.2
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
    { wch: 15 }, // N° Venta
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
function numeroALetras(numero: number): string {
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

