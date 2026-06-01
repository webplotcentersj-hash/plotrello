import jsPDF from 'jspdf'
import { BILLETE_DENOMINACIONES } from './constants'
import { fmtArs, fmtArs0, fmtDateAr } from './format'
import type { CajaArqueo } from './types'

function imageFormatFromDataUrl(url: string): 'PNG' | 'JPEG' {
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'JPEG'
  return 'PNG'
}

function writeLine(doc: jsPDF, text: string, x: number, y: number, maxW = 180): number {
  const lines = doc.splitTextToSize(text, maxW)
  doc.text(lines, x, y)
  return y + lines.length * 5
}

export function downloadArqueoPdf(
  arqueo: CajaArqueo,
  cajaNombre: string,
  cajeraNombre?: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Arqueo de caja — Plot Lab', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  y = writeLine(doc, `Fecha: ${fmtDateAr(arqueo.fecha)}`, margin, y)
  y = writeLine(doc, `Caja: ${cajaNombre}`, margin, y)
  y = writeLine(doc, `Turno: ${arqueo.turno}`, margin, y)
  y = writeLine(doc, `Cajera: ${cajeraNombre ?? arqueo.usuario_nombre ?? '—'}`, margin, y)
  y = writeLine(doc, `Total contado: $ ${fmtArs(arqueo.total)}`, margin, y)
  if (arqueo.created_at) {
    y = writeLine(
      doc,
      `Registrado: ${new Date(arqueo.created_at).toLocaleString('es-AR')}`,
      margin,
      y
    )
  }
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.text('Conteo de billetes', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const conBilletes = BILLETE_DENOMINACIONES.filter((d) => (arqueo.billetes[`b${d}`] ?? 0) > 0)
  if (!conBilletes.length) {
    y = writeLine(doc, 'Sin detalle por denominación (solo total registrado).', margin, y)
  } else {
    doc.text('Denominación', margin, y)
    doc.text('Cant.', margin + 52, y)
    doc.text('Subtotal', margin + 72, y)
    y += 5

    for (const d of conBilletes) {
      const q = arqueo.billetes[`b${d}`] ?? 0
      const sub = q * d
      doc.text(`$ ${fmtArs0(d)}`, margin, y)
      doc.text(String(q), margin + 52, y)
      doc.text(`$ ${fmtArs(sub)}`, margin + 72, y)
      y += 5
      if (y > 265) {
        doc.addPage()
        y = 18
      }
    }
  }

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Total: $ ${fmtArs(arqueo.total)}`, margin, y)
  y += 10

  if (arqueo.firma_data_url) {
    doc.setFont('helvetica', 'bold')
    doc.text('Firma de la cajera', margin, y)
    y += 4
    try {
      const fmt = imageFormatFromDataUrl(arqueo.firma_data_url)
      doc.addImage(arqueo.firma_data_url, fmt, margin, y, 75, 30)
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('(No se pudo incrustar la firma; está guardada en el sistema.)', margin, y)
    }
  }

  const slug = `${arqueo.fecha}-${arqueo.caja_slug}`.replace(/[^\w-]+/g, '_')
  doc.save(`arqueo-${slug}.pdf`)
}
