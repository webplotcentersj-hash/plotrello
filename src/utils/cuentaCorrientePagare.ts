import { jsPDF } from 'jspdf'
import { formatArgentinaDate } from './dateUtils'
import { uploadAttachmentAndGetUrl } from './storage'

export type TipoClienteCuentaCorriente = 'empresa' | 'persona_fisica'

export type PagareCuentaCorrienteInput = {
  tipo: TipoClienteCuentaCorriente
  nombreDeudor: string
  cuit: string
  concepto?: string
  domicilio?: string
  localidad?: string
  provincia?: string
  /** % mensual pactado (manual) */
  porcentajeInteresMensual?: number | null
  porcentajeInteresMoraMensual?: number | null
}

export type PagareCuentaCorrienteBuild = {
  doc: jsPDF
  fileName: string
  ref: string
}

function fechaLarga(d: Date): string {
  return `a los ${d.getDate()} días del mes de ${d.toLocaleDateString('es-AR', { month: 'long' })} de ${d.getFullYear()}`
}

/** Construye el PDF del pagaré (sin descargar ni subir). */
export function buildPagareCuentaCorrienteDoc(input: PagareCuentaCorrienteInput): PagareCuentaCorrienteBuild {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  const hoy = new Date()

  const tipoLabel = input.tipo === 'persona_fisica' ? 'Persona física' : 'Empresa'
  const ref = `CC-${input.cuit.replace(/\D/g, '').slice(-8) || 'NUEVO'}-${Date.now().toString(36).slice(-4).toUpperCase()}`

  doc.setFontSize(24)
  doc.setTextColor(59, 130, 246)
  doc.setFont('helvetica', 'bold')
  doc.text('PAGARÉ', pageWidth / 2, yPos, { align: 'center' })
  yPos += 12

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ref. cuenta corriente · ${tipoLabel}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text(`N° ${ref}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 10

  doc.setFontSize(10)
  doc.text(`En San Juan, ${fechaLarga(hoy)}`, margin, yPos)
  yPos += 14

  const domicilioDeudor = [input.domicilio, input.localidad, input.provincia].filter(Boolean).join(', ')
  const textoPagare = `Por el presente, ${input.nombreDeudor || '___________________'} (CUIT/DNI: ${input.cuit || '___________________'})${
    domicilioDeudor ? `, con domicilio en ${domicilioDeudor}` : ''
  }, me comprometo a pagar incondicionalmente a la orden de PLOT CENTER S.R.L. las obligaciones derivadas de las operaciones realizadas en cuenta corriente, con vencimiento a un año vista, en San Juan o en el lugar que el acreedor indique.`

  doc.setFontSize(11)
  const lines = doc.splitTextToSize(textoPagare, pageWidth - margin * 2)
  lines.forEach((line: string) => {
    doc.text(line, margin, yPos)
    yPos += 6
  })
  yPos += 10

  const concepto = input.concepto?.trim()
  if (concepto) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Concepto / detalle:', margin, yPos)
    yPos += 7
    doc.setFont('helvetica', 'normal')
    const conceptoLines = doc.splitTextToSize(concepto, pageWidth - margin * 2 - 5)
    doc.text(conceptoLines, margin + 5, yPos)
    yPos += conceptoLines.length * 5 + 12
  }

  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'italic')
  const tasaPactada = input.porcentajeInteresMensual
  const tasaMora = input.porcentajeInteresMoraMensual ?? tasaPactada
  const clausulaInteres =
    tasaPactada != null && tasaPactada > 0
      ? ` En caso de mora se aplicará un interés del ${tasaMora ?? tasaPactada}% mensual (pactado: ${tasaPactada}% mensual), calculado proporcionalmente por días de atraso.`
      : ' En caso de mora, el deudor abonará los intereses y gastos que correspondan según condiciones comerciales.'
  const legal =
    `${clausulaInteres} Se renuncia al fuero del domicilio y se somete a los tribunales de San Juan.`
  doc.splitTextToSize(legal, pageWidth - margin * 2).forEach((line: string) => {
    doc.text(line, margin, yPos)
    yPos += 5
  })
  yPos += 18

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.line(margin, yPos, margin + 75, yPos)
  yPos += 7
  doc.text('Firma del deudor', margin, yPos)
  yPos += 6
  doc.text(input.nombreDeudor || '___________________', margin, yPos)
  yPos += 5
  doc.text(`CUIT/DNI: ${input.cuit || '___________________'}`, margin, yPos)

  const acreedorY = pageHeight - 55
  doc.setFont('helvetica', 'bold')
  doc.text('Acreedor:', margin, acreedorY)
  doc.setFont('helvetica', 'normal')
  doc.text('PLOT CENTER S.R.L.', margin, acreedorY + 6)
  doc.text('San Juan, Argentina', margin, acreedorY + 12)

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    `Borrador generado el ${formatArgentinaDate(new Date().toISOString())} — no reemplaza firma autógrafa`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  const slug = (input.nombreDeudor || 'pagare')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)

  return { doc, fileName: `pagare-cuenta-corriente-${slug}`, ref }
}

/**
 * Descarga el pagaré en el navegador (sin subir).
 */
export function generarPagareCuentaCorrientePDF(input: PagareCuentaCorrienteInput): void {
  const { doc, fileName } = buildPagareCuentaCorrienteDoc(input)
  doc.save(`${fileName}.pdf`)
}

/**
 * Genera el PDF, lo sube a Storage y devuelve la URL pública. También descarga una copia local.
 */
export async function generarYGuardarPagareCuentaCorriente(
  input: PagareCuentaCorrienteInput,
  storageFolder: string
): Promise<string> {
  const { doc, fileName } = buildPagareCuentaCorrienteDoc(input)
  const blob = doc.output('blob') as Blob
  const file = new File([blob], `${fileName}.pdf`, { type: 'application/pdf' })
  const folder = `${storageFolder.replace(/^\//, '').replace(/\/$/, '')}/pagares`
  const url = await uploadAttachmentAndGetUrl(file, folder)
  doc.save(`${fileName}.pdf`)
  return url
}
