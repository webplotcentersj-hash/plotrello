import { jsPDF } from 'jspdf'
import {
  comprobanteRespaldatorio,
  lineasFormaDiario,
  nombreCuenta,
  numerosDeOrden,
  ordenCronologico,
  type AsientoLD
} from '../../features/asientos/libroDiario'
import { cargarEmisor, formatCuitPdf, pdfText, type EmisorPdf } from '../facturaAfipPdf'
import { guardarBlob } from '../descargarArchivo'

/**
 * Libro Diario para transcribir o rubricar: solo asientos contabilizados, en orden cronológico,
 * con N° de orden correlativo, leyenda y comprobante de cada asiento, y "Transporte" al pie y al
 * comienzo de cada hoja (art. 327 a 329 CCyC).
 */
export type OpcionesLibroDiario = {
  desde: string
  hasta: string
  /** Hoja con la que arranca (libros rubricados o continuación de un período anterior). */
  primeraHoja?: number
  /** Asientos del ejercicio completo, para que el N° de orden no reinicie en cada mes. */
  asientosEjercicio?: AsientoLD[]
}

const MARGEN = 12
const ANCHO = 210 - MARGEN * 2
const ALTO_PAGINA = 297
const PIE = ALTO_PAGINA - 14
const COL = { fecha: MARGEN, orden: MARGEN + 19, cuenta: MARGEN + 33, debe: MARGEN + ANCHO - 32, haber: MARGEN + ANCHO }
const LINEA = 4.4

const fechaAr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const importe = (v: number) => (v ? v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')

export async function buildLibroDiarioPdf(asientos: AsientoLD[], opciones: OpcionesLibroDiario, emisor?: EmisorPdf | null): Promise<jsPDF> {
  const datos = emisor ?? (await cargarEmisor())
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const libro = ordenCronologico(
    asientos.filter((a) => a.estado === 'Contabilizado' && a.fecha >= opciones.desde && a.fecha <= opciones.hasta)
  )
  const orden = numerosDeOrden(opciones.asientosEjercicio ?? asientos)
  let hoja = opciones.primeraHoja ?? 1
  let y = 0
  let transporteDebe = 0
  let transporteHaber = 0

  const encabezado = () => {
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(pdfText(datos.razon_social || ''), MARGEN, MARGEN + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(pdfText(`CUIT ${formatCuitPdf(datos.cuit)} - ${datos.domicilio_comercial || ''}`), MARGEN, MARGEN + 6.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('LIBRO DIARIO', MARGEN + ANCHO, MARGEN + 2, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(pdfText(`Del ${fechaAr(opciones.desde)} al ${fechaAr(opciones.hasta)} - Hoja ${hoja}`), MARGEN + ANCHO, MARGEN + 6.5, { align: 'right' })

    const top = MARGEN + 10
    doc.setFillColor(232, 232, 232)
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.3)
    doc.rect(MARGEN, top, ANCHO, 6.5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('Fecha', COL.fecha + 1, top + 4.4)
    doc.text('N°', COL.orden + 1, top + 4.4)
    doc.text('Cuentas y leyenda', COL.cuenta + 1, top + 4.4)
    doc.text('Debe', COL.debe - 1, top + 4.4, { align: 'right' })
    doc.text('Haber', COL.haber - 1, top + 4.4, { align: 'right' })
    y = top + 6.5 + 4
    doc.setFont('helvetica', 'normal')
    if (transporteDebe || transporteHaber) filaTotal('Transporte', transporteDebe, transporteHaber)
  }

  const filaTotal = (texto: string, debe: number, haber: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(pdfText(texto), COL.cuenta + 1, y)
    doc.text(importe(debe) || '0,00', COL.debe - 1, y, { align: 'right' })
    doc.text(importe(haber) || '0,00', COL.haber - 1, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += LINEA + 1
  }

  const pie = (ultima: boolean) => {
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.3)
    doc.line(MARGEN, PIE - 5, MARGEN + ANCHO, PIE - 5)
    y = PIE - 1
    if (!ultima) filaTotal('Transporte', transporteDebe, transporteHaber)
    doc.setFontSize(7)
    doc.setTextColor(110, 110, 110)
    doc.text(pdfText('Libro Diario - arts. 320 a 331 Código Civil y Comercial'), MARGEN, ALTO_PAGINA - 7)
    doc.text(`Hoja ${hoja}`, MARGEN + ANCHO, ALTO_PAGINA - 7, { align: 'right' })
    doc.setTextColor(20, 20, 20)
  }

  const nuevaHoja = () => {
    pie(false)
    doc.addPage()
    hoja++
    encabezado()
  }

  encabezado()

  if (libro.length === 0) {
    doc.setFontSize(9)
    doc.text('Sin asientos contabilizados en el período.', COL.cuenta + 1, y + 2)
    y += 10
  }

  for (const a of libro) {
    doc.setFontSize(8)
    const leyenda = doc.splitTextToSize(pdfText(a.concepto), COL.debe - 30 - COL.cuenta) as string[]
    const comprobante = comprobanteRespaldatorio(a)
    const lineas = lineasFormaDiario(a.detalles ?? [])
    const alto = (lineas.length + leyenda.length + (comprobante ? 1 : 0)) * LINEA + 6
    // Un asiento no se corta entre hojas, salvo que no entre en una hoja entera.
    if (y + alto > PIE - 10 && alto < PIE - 40) nuevaHoja()

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.15)
    doc.line(MARGEN, y - 3.2, MARGEN + ANCHO, y - 3.2)
    doc.setFont('helvetica', 'bold')
    doc.text(fechaAr(a.fecha), COL.fecha + 1, y)
    doc.text(String(orden.get(a.id) ?? ''), COL.orden + 1, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(110, 110, 110)
    doc.setFontSize(6.5)
    doc.text(pdfText(a.numero_asiento), COL.orden + 1, y + 3)
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(8)

    for (const l of lineas) {
      if (y > PIE - 10) nuevaHoja()
      const esHaber = Number(l.haber) > 0
      const texto = pdfText(`${esHaber ? 'a ' : ''}${nombreCuenta(l)}`)
      const x = COL.cuenta + 1 + (esHaber ? 8 : 0)
      const recortado = (doc.splitTextToSize(texto, COL.debe - 30 - x) as string[])[0] ?? ''
      doc.text(recortado, x, y)
      if (Number(l.debe) > 0) doc.text(importe(Number(l.debe)), COL.debe - 1, y, { align: 'right' })
      if (Number(l.haber) > 0) doc.text(importe(Number(l.haber)), COL.haber - 1, y, { align: 'right' })
      transporteDebe += Number(l.debe) || 0
      transporteHaber += Number(l.haber) || 0
      y += LINEA
    }

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(60, 60, 60)
    for (const linea of leyenda) {
      if (y > PIE - 10) nuevaHoja()
      doc.text(linea, COL.cuenta + 1, y)
      y += LINEA - 0.6
    }
    if (comprobante) {
      doc.text(pdfText(`Comprobante: ${comprobante}`), COL.cuenta + 1, y)
      y += LINEA - 0.6
    }
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(20, 20, 20)
    y += 3.5
  }

  if (y > PIE - 14) nuevaHoja()
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.3)
  doc.line(MARGEN, y - 2, MARGEN + ANCHO, y - 2)
  y += 2
  filaTotal(`Totales del período (${libro.length} asientos)`, transporteDebe, transporteHaber)
  pie(true)
  return doc
}

export async function descargarLibroDiarioPdf(asientos: AsientoLD[], opciones: OpcionesLibroDiario): Promise<void> {
  const doc = await buildLibroDiarioPdf(asientos, opciones)
  guardarBlob(doc.output('blob'), `Libro_Diario_${opciones.desde}_a_${opciones.hasta}.pdf`)
}

/** CSV con el mismo orden y numeración (para el estudio contable). */
export function libroDiarioCsv(asientos: AsientoLD[], desde: string, hasta: string, asientosEjercicio?: AsientoLD[]): string[][] {
  const libro = ordenCronologico(asientos.filter((a) => a.estado === 'Contabilizado' && a.fecha >= desde && a.fecha <= hasta))
  const orden = numerosDeOrden(asientosEjercicio ?? asientos)
  const filas: string[][] = []
  for (const a of libro) {
    for (const l of lineasFormaDiario(a.detalles ?? [])) {
      filas.push([
        fechaAr(a.fecha),
        String(orden.get(a.id) ?? ''),
        a.numero_asiento,
        l.cuenta?.codigo ?? '',
        l.cuenta?.nombre ?? '',
        Number(l.debe) ? Number(l.debe).toFixed(2).replace('.', ',') : '',
        Number(l.haber) ? Number(l.haber).toFixed(2).replace('.', ',') : '',
        a.concepto,
        comprobanteRespaldatorio(a) ?? ''
      ])
    }
  }
  return filas
}
