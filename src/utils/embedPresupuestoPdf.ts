import jsPDF from 'jspdf'
import type { EmbedPresupuestoPayload } from './embedChatShared'
import { formatArgentinaDate } from './dateUtils'

const EMPRESA = 'PLOT CENTER S.R.L.'
const DOMICILIO = '9 de Julio 622 (Oeste) - San Juan, Argentina'
const TELEFONO = '2646212163'

function pdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, (ch) => ({ Ñ: 'N', ñ: 'n' })[ch] ?? '')
}

function formatArs(n: number): string {
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function cargarLogoPlotLab(): Promise<string | null> {
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
    img.src = `${window.location.origin}/plot-lab-logo.png`
  })
}

export async function buildEmbedPresupuestoPdf(presupuesto: EmbedPresupuestoPayload): Promise<jsPDF> {
  const logo = await cargarLogoPlotLab()
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16
  let y = margin

  if (logo) {
    doc.addImage(logo, 'PNG', margin, y, 28, 28)
  }

  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(pdfText(EMPRESA), logo ? margin + 34 : margin, y + 10)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(pdfText(DOMICILIO), logo ? margin + 34 : margin, y + 16)
  doc.text(pdfText(`Tel: ${TELEFONO}`), logo ? margin + 34 : margin, y + 21)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(234, 88, 12)
  doc.text('PRESUPUESTO', pageWidth - margin, y + 10, { align: 'right' })

  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(pdfText(presupuesto.numero), pageWidth - margin, y + 17, { align: 'right' })

  y += 34
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Fecha: ${formatArgentinaDate(presupuesto.fecha)}`, margin, y)
  doc.text(
    pdfText(`Valido hasta: ${formatArgentinaDate(presupuesto.validez_hasta)}`),
    pageWidth - margin,
    y,
    { align: 'right' }
  )
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('Cliente', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(pdfText(presupuesto.cliente_nombre), margin, y)
  y += 5
  if (presupuesto.cliente_telefono) {
    doc.text(pdfText(`WhatsApp: ${presupuesto.cliente_telefono}`), margin, y)
    y += 5
  }
  doc.text(pdfText(presupuesto.lista_label), margin, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFillColor(249, 115, 22)
  doc.setTextColor(255, 255, 255)
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F')
  doc.text('Descripcion', margin + 2, y + 5.5)
  doc.text('Cant.', pageWidth - margin - 52, y + 5.5, { align: 'right' })
  doc.text('P. unit.', pageWidth - margin - 32, y + 5.5, { align: 'right' })
  doc.text('Subtotal', pageWidth - margin - 2, y + 5.5, { align: 'right' })
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 41, 59)
  for (const item of presupuesto.items) {
    const desc = pdfText(item.descripcion)
    const lines = doc.splitTextToSize(desc, pageWidth - margin * 2 - 58)
    doc.text(lines, margin + 2, y)
    doc.text(String(item.cantidad), pageWidth - margin - 52, y, { align: 'right' })
    doc.text(formatArs(item.precio_unitario), pageWidth - margin - 32, y, { align: 'right' })
    doc.text(formatArs(item.subtotal), pageWidth - margin - 2, y, { align: 'right' })
    y += Math.max(7, lines.length * 5)
  }

  y += 4
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL', pageWidth - margin - 50, y)
  doc.setTextColor(234, 88, 12)
  doc.text(formatArs(presupuesto.total), pageWidth - margin - 2, y, { align: 'right' })

  y += 12
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  const notas = doc.splitTextToSize(pdfText(presupuesto.notas), pageWidth - margin * 2)
  doc.text(notas, margin, y)

  return doc
}

export async function downloadEmbedPresupuestoPdf(presupuesto: EmbedPresupuestoPayload): Promise<void> {
  const doc = await buildEmbedPresupuestoPdf(presupuesto)
  doc.save(`presupuesto-${presupuesto.numero}.pdf`)
}
