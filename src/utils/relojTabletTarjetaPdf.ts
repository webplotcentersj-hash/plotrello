import jsPDF from 'jspdf'

/** CR80 vertical: 54 × 86 mm (tarjeta tipo credencial). */
const PAGE_W = 54
const PAGE_H = 86
const MARGIN = 4

export type LogoPlotLab = {
  dataUrl: string
  /** Relación ancho/alto nativa del PNG (evita estirarlo en el PDF). */
  aspect: number
}

export type TarjetaRelojPdfInput = {
  idUsuario: number
  nombreCompleto: string
  sector: string
  qrSrc: string
  filename: string
  /** Logo Plot Lab (data URL + aspect). Si falta, se omite la imagen. */
  logo?: LogoPlotLab | null
}

function formatIdEmpleado(id: number): string {
  return `PLT ${String(id).padStart(4, '0')}`
}

function wrapName(doc: jsPDF, name: string, maxWidth: number, maxLines: number): string[] {
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
      if (lines.length >= maxLines) break
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  if (!lines.length) lines.push(upper.slice(0, 24))
  return lines.slice(0, maxLines)
}

function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  const upper = text.toUpperCase()
  if (doc.getTextWidth(upper) <= maxWidth) return upper
  let t = upper
  while (t.length > 3 && doc.getTextWidth(`${t}…`) > maxWidth) {
    t = t.slice(0, -1)
  }
  return `${t}…`
}

/** Carga el logo Plot Lab desde /public con su proporción real. */
export async function cargarLogoPlotLabDataUrl(): Promise<LogoPlotLab | null> {
  try {
    const resp = await fetch('/plot-lab-logo.png')
    if (!resp.ok) return null
    const blob = await resp.blob()
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
    if (!dataUrl) return null

    const aspect = await new Promise<number>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        resolve(w > 0 && h > 0 ? w / h : 347 / 203)
      }
      img.onerror = () => resolve(347 / 203)
      img.src = dataUrl
    })

    return { dataUrl, aspect }
  } catch {
    return null
  }
}

/** Encaja el logo en un rectángulo máximo respetando aspect ratio. */
function logoFitSize(aspect: number, maxW: number, maxH: number): { w: number; h: number } {
  let w = maxW
  let h = w / aspect
  if (h > maxH) {
    h = maxH
    w = h * aspect
  }
  return { w, h }
}

export function generarTarjetaRelojPdf(input: TarjetaRelojPdfInput): void {
  const { idUsuario, nombreCompleto, sector, qrSrc, filename, logo } = input
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, PAGE_H] })
  const maxTextW = PAGE_W - MARGIN * 2

  // Fondo
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  // Franja superior Plot
  doc.setFillColor(235, 103, 27)
  doc.rect(0, 0, PAGE_W, 2, 'F')

  // —— Pie fijo (anclado abajo para que nunca se corte) ——
  const hintY = PAGE_H - 3.8
  const lineY = PAGE_H - 6.8
  const areaValY = lineY - 3.2
  const areaLblY = areaValY - 3.6

  doc.setDrawColor(80, 90, 110)
  doc.setLineWidth(0.12)
  doc.line(MARGIN, lineY, PAGE_W - MARGIN, lineY)
  doc.setTextColor(175, 185, 200)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(3.8)
  doc.text('Escaneá en /tablet-reloj para marcar', PAGE_W / 2, hintY, { align: 'center' })

  // Área
  doc.setTextColor(150, 165, 185)
  doc.setFontSize(4)
  doc.text('ÁREA', MARGIN, areaLblY)
  doc.setTextColor(235, 103, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.2)
  doc.text(truncate(doc, sector || 'PLOT LAB', maxTextW), MARGIN, areaValY)

  // Nombre (hasta 2 líneas, encima del área)
  doc.setTextColor(150, 165, 185)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4)
  const nameLblY = areaLblY - 8.5
  doc.text('NOMBRE', MARGIN, nameLblY)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  const nameLines = wrapName(doc, nombreCompleto, maxTextW, 2)
  const nameStartY = nameLblY + 3.6
  nameLines.forEach((line, i) => {
    doc.text(line, MARGIN, nameStartY + i * 3.4)
  })

  // N° empleado (encima del nombre)
  const idLblY = nameLblY - 8
  doc.setTextColor(150, 165, 185)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4)
  doc.text('N° EMPLEADO', MARGIN, idLblY)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.text(formatIdEmpleado(idUsuario), MARGIN, idLblY + 4)

  // —— Encabezado con logo (proporción nativa, sin estirar) ——
  const headerY = 5.5
  if (logo?.dataUrl) {
    const { w: logoW, h: logoH } = logoFitSize(logo.aspect || 347 / 203, 13, 7.2)
    const logoY = headerY - 1.2
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, logoY, logoW, logoH)
    const textX = MARGIN + logoW + 1.8
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5)
    doc.text('TARJETA EMPLEADO', textX, headerY + 1.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.2)
    doc.setTextColor(180, 190, 210)
    doc.text('PLOT LAB', textX, headerY + 5)
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5)
    doc.text('TARJETA EMPLEADO', MARGIN, headerY + 1.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.2)
    doc.setTextColor(180, 190, 210)
    doc.text('PLOT LAB', MARGIN, headerY + 5)
  }

  doc.setTextColor(120, 220, 160)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.8)
  doc.text('VÁLIDO', PAGE_W - MARGIN, headerY + 2, { align: 'right' })

  // QR centrado entre encabezado y bloque de datos
  const qrSize = 27
  const qrX = (PAGE_W - qrSize) / 2
  const dataTop = idLblY - 3
  const qrY = Math.min(14, dataTop - 2 - qrSize)

  doc.setFillColor(255, 255, 255)
  doc.roundedRect(qrX - 1.2, qrY - 1.2, qrSize + 2.4, qrSize + 2.4, 1.5, 1.5, 'F')
  doc.addImage(qrSrc, 'PNG', qrX, qrY, qrSize, qrSize)

  doc.save(filename)
}

export async function generarTarjetaRelojPdfConLogo(input: Omit<TarjetaRelojPdfInput, 'logo'>): Promise<void> {
  const logo = await cargarLogoPlotLabDataUrl()
  generarTarjetaRelojPdf({ ...input, logo })
}
