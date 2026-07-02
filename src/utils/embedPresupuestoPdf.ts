import jsPDF from 'jspdf'
import type { EmbedPresupuestoPayload } from './embedChatShared'
import { formatArgentinaDate } from './dateUtils'

const EMPRESA = 'PLOT CENTER S.R.L.'
const DOMICILIO = '9 de Julio 622 (Oeste) - San Juan, Argentina'
const TELEFONO = '2646212163'
const LOGO_BG = '#0f172a'

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

type LogoAsset = { dataUrl: string; widthMm: number; heightMm: number }

function cargarLogoPlotLab(maxSideMm = 24): Promise<LogoAsset | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const iw = Math.max(img.naturalWidth || img.width, 1)
        const ih = Math.max(img.naturalHeight || img.height, 1)
        const box = Math.max(iw, ih)
        const canvas = document.createElement('canvas')
        canvas.width = box
        canvas.height = box
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.fillStyle = LOGO_BG
        ctx.fillRect(0, 0, box, box)
        const pad = Math.round(box * 0.1)
        const innerW = box - pad * 2
        const innerH = box - pad * 2
        const scale = Math.min(innerW / iw, innerH / ih)
        const dw = iw * scale
        const dh = ih * scale
        const dx = (box - dw) / 2
        const dy = (box - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)

        const aspect = iw / ih
        let widthMm = maxSideMm
        let heightMm = maxSideMm
        if (aspect >= 1) {
          heightMm = maxSideMm / aspect
        } else {
          widthMm = maxSideMm * aspect
        }

        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          widthMm,
          heightMm
        })
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
  const margin = 18
  const logoW = logo?.widthMm ?? 24
  const logoH = logo?.heightMm ?? 24
  const headerBlockH = Math.max(logoH, 22)
  const tableRight = pageWidth - margin
  const colSub = tableRight - 2
  const colUnit = tableRight - 38
  const colCant = tableRight - 58
  const colDesc = margin + 2
  const colDescWidth = colCant - colDesc - 6
  let y = margin

  if (logo) {
    doc.addImage(logo.dataUrl, 'PNG', margin, y, logoW, logoH)
  } else {
    doc.setFillColor(15, 23, 42)
    doc.roundedRect(margin, y, logoW, logoH, 2, 2, 'F')
  }

  const headerTextX = margin + logoW + 8
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(pdfText(EMPRESA), headerTextX, y + 9)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(pdfText(DOMICILIO), headerTextX, y + 15)
  doc.text(pdfText(`Tel: ${TELEFONO}`), headerTextX, y + 20)

  doc.setFontSize(17)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(234, 88, 12)
  doc.text('PRESUPUESTO', tableRight, y + 9, { align: 'right' })

  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(pdfText(presupuesto.numero), tableRight, y + 16, { align: 'right' })

  y += headerBlockH + 8
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, tableRight, y)
  y += 8

  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Fecha: ${formatArgentinaDate(presupuesto.fecha)}`, margin, y)
  doc.text(
    pdfText(`Valido hasta: ${formatArgentinaDate(presupuesto.validez_hasta)}`),
    tableRight,
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
  y += 6

  const headerH = 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(249, 115, 22)
  doc.setTextColor(255, 255, 255)
  doc.rect(margin, y, tableRight - margin, headerH, 'F')
  doc.text('Descripcion', colDesc, y + 6)
  doc.text('Cant.', colCant, y + 6, { align: 'right' })
  doc.text('P. unit.', colUnit, y + 6, { align: 'right' })
  doc.text('Subtotal', colSub, y + 6, { align: 'right' })
  y += headerH + 2

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  for (const item of presupuesto.items) {
    const desc = pdfText(item.descripcion)
    const lines = doc.splitTextToSize(desc, colDescWidth) as string[]
    const rowH = Math.max(8, lines.length * 4.5 + 2)
    if (y + rowH > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      y = margin
    }
    doc.text(lines, colDesc, y + 4)
    doc.text(String(item.cantidad), colCant, y + 4, { align: 'right' })
    doc.text(formatArs(item.precio_unitario), colUnit, y + 4, { align: 'right' })
    doc.text(formatArs(item.subtotal), colSub, y + 4, { align: 'right' })
    y += rowH
    doc.setDrawColor(241, 245, 249)
    doc.line(margin, y, tableRight, y)
    y += 2
  }

  y += 4
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, y, tableRight, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('TOTAL', colUnit - 8, y)
  doc.setTextColor(234, 88, 12)
  doc.text(formatArs(presupuesto.total), colSub, y, { align: 'right' })

  y += 14
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  const notas = doc.splitTextToSize(pdfText(presupuesto.notas), tableRight - margin)
  doc.text(notas, margin, y)

  return doc
}

export async function downloadEmbedPresupuestoPdf(presupuesto: EmbedPresupuestoPayload): Promise<void> {
  const doc = await buildEmbedPresupuestoPdf(presupuesto)
  doc.save(`presupuesto-${presupuesto.numero}.pdf`)
}
