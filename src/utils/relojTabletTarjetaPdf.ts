import jsPDF from 'jspdf'

/** CR80 vertical: 54 × 86 mm (tarjeta tipo credencial). */
const PAGE_W = 54
const PAGE_H = 86

export type TarjetaRelojPdfInput = {
  idUsuario: number
  nombreCompleto: string
  sector: string
  qrSrc: string
  filename: string
}

function formatIdEmpleado(id: number): string {
  return `PLT ${String(id).padStart(4, '0')}`
}

/** Parte un nombre largo en líneas que entren en el ancho de la tarjeta. */
function wrapName(doc: jsPDF, name: string, maxWidth: number): string[] {
  const upper = name.toUpperCase()
  const words = upper.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (doc.getTextWidth(next) <= maxWidth) {
      cur = next
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines.slice(0, 2) : [upper.slice(0, 28)]
}

export function generarTarjetaRelojPdf(input: TarjetaRelojPdfInput): void {
  const { idUsuario, nombreCompleto, sector, qrSrc, filename } = input
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, PAGE_H] })

  // Fondo oscuro
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  // Acento Plot (naranja)
  doc.setFillColor(235, 103, 27)
  doc.rect(0, 0, PAGE_W, 2.2, 'F')
  doc.setFillColor(45, 35, 28)
  doc.rect(PAGE_W - 14, PAGE_H - 20, 14, 20, 'F')

  // Encabezado
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.2)
  doc.text('TARJETA EMPLEADO', 4, 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.8)
  doc.setTextColor(180, 190, 210)
  doc.text('PLOT LAB', 4, 10.5)
  doc.setTextColor(120, 220, 160)
  doc.setFont('helvetica', 'bold')
  doc.text('VÁLIDO', PAGE_W - 4, 7, { align: 'right' })

  // Marco QR
  const qrSize = 30
  const qrX = (PAGE_W - qrSize) / 2
  const qrY = 16
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 2, 2, 'F')
  doc.addImage(qrSrc, 'PNG', qrX, qrY, qrSize, qrSize)

  // Datos
  const textX = 4
  const maxTextW = PAGE_W - 8

  doc.setTextColor(160, 175, 200)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.text('N° EMPLEADO', textX, 54)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(formatIdEmpleado(idUsuario), textX, 59.5)

  doc.setTextColor(160, 175, 200)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.text('NOMBRE', textX, 65)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  const nameLines = wrapName(doc, nombreCompleto, maxTextW)
  nameLines.forEach((line, i) => {
    doc.text(line, textX, 69.5 + i * 3.8)
  })

  const sectorY = 69.5 + nameLines.length * 3.8 + 2
  doc.setTextColor(160, 175, 200)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.text('ÁREA', textX, sectorY)

  doc.setTextColor(235, 103, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  const sectorTxt = (sector || 'PLOT LAB').toUpperCase()
  doc.text(sectorTxt.length > 22 ? `${sectorTxt.slice(0, 21)}…` : sectorTxt, textX, sectorY + 3.8)

  // Pie
  doc.setDrawColor(80, 90, 110)
  doc.setLineWidth(0.15)
  doc.line(4, PAGE_H - 8, PAGE_W - 4, PAGE_H - 8)
  doc.setTextColor(180, 190, 210)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.2)
  doc.text('Escaneá en /tablet-reloj para marcar', PAGE_W / 2, PAGE_H - 4.5, { align: 'center' })

  doc.save(filename)
}
