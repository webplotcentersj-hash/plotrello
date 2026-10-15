import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function elementoAPdfBlob(el: HTMLElement, landscape = true): Promise<Blob> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  })
  const img = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 6
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2
  const ratio = Math.min(maxW / canvas.width, maxH / canvas.height)
  const w = canvas.width * ratio
  const h = canvas.height * ratio
  const x = (pageW - w) / 2
  const y = (pageH - h) / 2
  pdf.addImage(img, 'PNG', x, y, w, h)
  return pdf.output('blob')
}

export async function descargarElementoPdf(el: HTMLElement, filename: string) {
  const blob = await elementoAPdfBlob(el)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function elementosAPdfMultipagina(els: HTMLElement[]): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 6
  let first = true
  for (const el of els) {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })
    const img = canvas.toDataURL('image/png')
    if (!first) pdf.addPage('a4', 'landscape')
    first = false
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height)
    const w = canvas.width * ratio
    const h = canvas.height * ratio
    pdf.addImage(img, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h)
  }
  return pdf.output('blob')
}
