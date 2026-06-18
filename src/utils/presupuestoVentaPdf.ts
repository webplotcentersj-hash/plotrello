import jsPDF from 'jspdf'
import type { PresupuestoVentaItemRecord, PresupuestoVentaRecord } from '../types/api'
import { formatArgentinaDate } from './dateUtils'
import { labelListaPrecio } from '../constants/ventasListasPrecio'

const EMPRESA_NOMBRE = 'PLOT CENTER S.R.L.'
const EMPRESA_DOMICILIO = 'San Juan, Argentina'

function cargarLogoBase64(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = `${window.location.origin}/logo.png`
  })
}

export async function buildPresupuestoVentaPDF(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<jsPDF> {
  const logo = await cargarLogoBase64()
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 18
  let y = margin

  if (logo) {
    doc.addImage(logo, 'PNG', margin, y, 32, 32)
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(EMPRESA_NOMBRE, logo ? margin + 38 : margin, y + 10)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(EMPRESA_DOMICILIO, logo ? margin + 38 : margin, y + 16)

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text('PRESUPUESTO', pageWidth - margin, y + 8, { align: 'right' })

  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(presupuesto.numero_presupuesto, pageWidth - margin, y + 16, { align: 'right' })

  y += 38
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  const fechaCreacion = presupuesto.fecha_creacion
    ? formatArgentinaDate(presupuesto.fecha_creacion)
    : formatArgentinaDate(new Date().toISOString())
  doc.text(`Fecha: ${fechaCreacion}`, margin, y)
  if (presupuesto.fecha_vencimiento) {
    doc.text(
      `Válido hasta: ${formatArgentinaDate(presupuesto.fecha_vencimiento)}`,
      pageWidth - margin,
      y,
      { align: 'right' }
    )
  }
  y += 12

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('Cliente', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const clienteLineas: string[] = [
    presupuesto.cliente_nombre || '—',
    presupuesto.cliente_empresa ? `Empresa: ${presupuesto.cliente_empresa}` : '',
    presupuesto.cliente_dni_cuit ? `DNI/CUIT: ${presupuesto.cliente_dni_cuit}` : '',
    presupuesto.cliente_telefono ? `Tel: ${presupuesto.cliente_telefono}` : '',
    presupuesto.cliente_email ? `Email: ${presupuesto.cliente_email}` : '',
    presupuesto.cliente_direccion ? `Dirección: ${presupuesto.cliente_direccion}` : ''
  ].filter(Boolean)

  for (const linea of clienteLineas) {
    doc.text(linea, margin + 2, y)
    y += 5
  }
  y += 6

  if (presupuesto.tipo_lista_precio) {
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(79, 70, 229)
    doc.text(`Lista de precios: ${labelListaPrecio(presupuesto.tipo_lista_precio)}`, margin, y)
    y += 8
  }

  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  const colW = [14, 18, 72, 24, 20, 28]
  const headers = ['#', 'Cód.', 'Descripción', 'Cant.', 'P. unit.', 'Subtotal']
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(51, 65, 85)
  let x = margin
  headers.forEach((h, i) => {
    doc.text(h, x, y)
    x += colW[i]
  })
  y += 5
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  items.forEach((item, idx) => {
    if (y > 250) {
      doc.addPage()
      y = margin
    }
    x = margin
    const fila = [
      String(idx + 1),
      (item.codigo_articulo || '—').slice(0, 10),
      item.descripcion.length > 42 ? `${item.descripcion.slice(0, 39)}…` : item.descripcion,
      String(item.cantidad),
      `$${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      `$${item.precio_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    ]
    fila.forEach((cell, i) => {
      doc.text(cell, x, y)
      x += colW[i]
    })
    y += 6
  })

  y += 6
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(4, 120, 87)
  doc.text(
    `TOTAL: $${(presupuesto.precio_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    pageWidth - margin,
    y,
    { align: 'right' }
  )
  y += 12

  if (presupuesto.observaciones_cliente?.trim()) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('Observaciones', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    const lines = doc.splitTextToSize(presupuesto.observaciones_cliente, pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 5 + 8
  }

  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  const pie =
    'Los precios pueden variar según disponibilidad. Este presupuesto no constituye factura. ' +
    `Documento trazable: ${presupuesto.numero_presupuesto}.`
  const pieLines = doc.splitTextToSize(pie, pageWidth - margin * 2)
  doc.text(pieLines, margin, 285)

  if (presupuesto.nombre_vendedor) {
    doc.text(`Asesor: ${presupuesto.nombre_vendedor}`, pageWidth - margin, 285, { align: 'right' })
  }

  return doc
}

export async function getPresupuestoVentaPdfBlob(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<Blob> {
  const doc = await buildPresupuestoVentaPDF(presupuesto, items)
  return doc.output('blob')
}

export async function descargarPresupuestoVentaPDF(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<void> {
  const doc = await buildPresupuestoVentaPDF(presupuesto, items)
  const nombre = `${presupuesto.numero_presupuesto.replace(/\s+/g, '_')}.pdf`
  doc.save(nombre)
}

function telefonoWhatsapp(tel: string | null | undefined): string | null {
  if (!tel?.trim()) return null
  let d = tel.replace(/\D/g, '')
  if (d.length < 8) return null
  if (d.startsWith('0')) d = d.slice(1)
  if (!d.startsWith('54')) d = `54${d}`
  return d
}

export function mensajePresupuestoVenta(presupuesto: PresupuestoVentaRecord): string {
  const total = (presupuesto.precio_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })
  return (
    `Hola${presupuesto.cliente_nombre ? ` ${presupuesto.cliente_nombre.split(' ')[0]}` : ''}, ` +
    `te enviamos el presupuesto *${presupuesto.numero_presupuesto}* de ${EMPRESA_NOMBRE} ` +
    `por un total de $${total}. ` +
    `Adjuntamos el PDF con el detalle. Cualquier consulta, respondemos por este medio.`
  )
}

export async function enviarPresupuestoPorWhatsapp(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<void> {
  await descargarPresupuestoVentaPDF(presupuesto, items)
  const tel = telefonoWhatsapp(presupuesto.cliente_telefono)
  const msg = encodeURIComponent(mensajePresupuestoVenta(presupuesto))
  const url = tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function enviarPresupuestoPorEmail(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<void> {
  await descargarPresupuestoVentaPDF(presupuesto, items)
  const to = presupuesto.cliente_email?.trim() || ''
  const subject = encodeURIComponent(`Presupuesto ${presupuesto.numero_presupuesto} - ${EMPRESA_NOMBRE}`)
  const body = encodeURIComponent(
    `${mensajePresupuestoVenta(presupuesto)}\n\n` +
      'Por favor adjuntá el PDF descargado a este correo antes de enviar.'
  )
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
}
