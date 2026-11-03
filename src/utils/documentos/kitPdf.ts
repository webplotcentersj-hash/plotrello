import { jsPDF } from 'jspdf'
import { formatFechaAr } from '../afipFacturaUi'
import {
  LOGO_URL,
  cargarEmisor,
  formatCuitPdf,
  loadDataUrl,
  pdfText,
  type EmisorPdf
} from '../facturaAfipPdf'

/**
 * Diseño común de los comprobantes que no son facturas (remito, presupuesto, recibo, orden de compra,
 * estado de cuenta, nota de pedido): mismo encabezado que la factura propia, tabla con corte de página
 * y pie con numeración. Se genera en el navegador, sin servicios de terceros.
 */

export { cantidadTexto, money } from '../facturaAfipPdf'
export type { EmisorPdf }

const MARGIN = 10
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2
const PIE_Y = PAGE_H - 9
/** Lo que se deja libre abajo para el pie de página. */
const RESERVA_PIE = 16

export type CabeceraDocumento = {
  /** Nombre del comprobante en mayúsculas: REMITO, PRESUPUESTO… */
  titulo: string
  /** Recuadro central (X en los comprobantes no fiscales). Sin letra, el encabezado no lleva recuadro. */
  letra?: string
  /** Texto chico bajo la letra. */
  leyendaLetra?: string
  numero?: string
  etiquetaNumero?: string
  /** ISO (aaaa-mm-dd) o ya formateada. */
  fecha?: string | null
  etiquetaFecha?: string
  /** Filas propias del documento, debajo de la fecha (máximo 3). */
  campos?: Array<[string, string]>
  /** ORIGINAL, BORRADOR, ANULADO… arriba a la derecha. */
  sello?: string
  /** Se repite en el pie de cada página. */
  pie?: string
}

export type Alineacion = 'left' | 'right' | 'center'
export type Columna = { titulo: string; ancho: number; alinear?: Alineacion }
export type FilaTabla = { celdas: string[]; detalle?: string; fuerte?: boolean }
export type FilaTotal = { label: string; value: string; fuerte?: boolean }
export type CampoBloque = [label: string, valor: string]

export type OpcionesDocumento = {
  /** Logo como data URL. `undefined` lo carga del sitio; `null` genera el PDF sin logo. */
  logoDataUrl?: string | null
}

export function fechaDocumento(valor: string | null | undefined): string {
  if (!valor) return '-'
  return /^\d{4}-\d{2}-\d{2}/.test(valor) ? formatFechaAr(valor.slice(0, 10)) : valor
}

/** Fecha de hoy en Argentina (aaaa-mm-dd), para documentos que se emiten al generarlos. */
export function hoyAr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export function nombreArchivo(base: string): string {
  return `${base.replace(/[^\w.-]+/g, '_')}.pdf`
}

export class DocumentoPdf {
  readonly doc: jsPDF
  /** Posición vertical actual, en mm desde el borde superior. */
  y = 0
  private cols: Columna[] | null = null
  private marca: string | null = null

  private readonly cab: CabeceraDocumento
  private readonly emisor: EmisorPdf
  private readonly logo: string | null

  private constructor(cab: CabeceraDocumento, emisor: EmisorPdf, logo: string | null) {
    this.cab = cab
    this.emisor = emisor
    this.logo = logo
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    this.y = this.encabezado(true)
  }

  static async crear(
    cab: CabeceraDocumento,
    emisor?: EmisorPdf | null,
    opciones: OpcionesDocumento = {}
  ): Promise<DocumentoPdf> {
    const logo = opciones.logoDataUrl !== undefined ? opciones.logoDataUrl : await loadDataUrl(LOGO_URL)
    const datosEmisor = emisor ?? (await cargarEmisor())
    return new DocumentoPdf(cab, datosEmisor, logo)
  }

  private etiquetaValor(label: string, value: string, x: number, y: number, maxAncho?: number): void {
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.text(pdfText(label), x, y)
    const w = doc.getTextWidth(pdfText(label)) + 1
    doc.setFont('helvetica', 'normal')
    const texto = pdfText(value)
    if (maxAncho === undefined) {
      doc.text(texto, x + w, y)
      return
    }
    const linea = (doc.splitTextToSize(texto, Math.max(10, maxAncho - w)) as string[])[0] || ''
    doc.text(linea, x + w, y)
  }

  /** Dibuja el encabezado y devuelve la posición donde sigue el contenido. */
  private encabezado(primera: boolean): number {
    const { doc, cab, emisor, logo } = this
    const x = MARGIN
    const y = MARGIN
    const boxH = 40
    const mid = x + CONTENT_W / 2
    const right = x + CONTENT_W

    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.4)
    doc.setTextColor(20, 20, 20)
    doc.rect(x, y, CONTENT_W, boxH)
    doc.line(mid, cab.letra ? y + 15 : y, mid, y + boxH)

    if (cab.letra) {
      doc.setFillColor(255, 255, 255)
      doc.rect(mid - 8, y, 16, 15, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(cab.letra.length > 1 ? 14 : 22)
      doc.text(pdfText(cab.letra), mid, y + 10.5, { align: 'center' })
      if (cab.leyendaLetra) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.text(pdfText(cab.leyendaLetra), mid, y + 13.6, { align: 'center' })
      }
    }

    // Emisor (izquierda)
    const leftX = x + 4
    let textX = leftX
    if (logo) {
      try {
        const props = doc.getImageProperties(logo)
        const caja = 20
        const escala = Math.min(caja / props.width, caja / props.height)
        doc.addImage(logo, 'PNG', leftX, y + 4, props.width * escala, props.height * escala)
        textX = leftX + 24
      } catch {
        // logo opcional
      }
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    const razon = doc.splitTextToSize(pdfText(emisor.razon_social || 'PLOT CENTER S.R.L.'), mid - 10 - textX) as string[]
    doc.text(razon.slice(0, 2), textX, y + 10)

    doc.setFontSize(8)
    let ey = y + 27
    const domicilio = doc.splitTextToSize(
      pdfText(`Domicilio Comercial: ${emisor.domicilio_comercial || '-'}`),
      mid - 10 - leftX
    ) as string[]
    doc.setFont('helvetica', 'normal')
    doc.text(domicilio.slice(0, 2), leftX, ey)
    ey += Math.min(domicilio.length, 2) * 3.8 + 1
    this.etiquetaValor('Condición frente al IVA: ', emisor.condicion_iva || '-', leftX, ey)

    // Documento (derecha)
    const rightX = mid + (cab.letra ? 11 : 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(cab.letra ? 14 : 15)
    doc.text(pdfText(cab.titulo.toUpperCase()), rightX, y + (cab.letra ? 11 : 9))
    if (cab.sello) {
      doc.setFontSize(7.5)
      doc.text(pdfText(cab.sello), right - 3, y + 5.5, { align: 'right' })
    }
    doc.setFontSize(8)
    const colDer = right - rightX - 3
    const filas: CampoBloque[] = []
    if (cab.numero) filas.push([`${cab.etiquetaNumero ?? 'N°'}: `, cab.numero])
    if (cab.fecha !== undefined) filas.push([`${cab.etiquetaFecha ?? 'Fecha de emisión'}: `, fechaDocumento(cab.fecha)])
    for (const campo of cab.campos ?? []) filas.push(campo)
    filas.push(['CUIT: ', formatCuitPdf(emisor.cuit) || '-'])
    if (emisor.ingresos_brutos) filas.push(['Ingresos Brutos: ', emisor.ingresos_brutos])
    if (emisor.fecha_inicio_actividades) filas.push(['Inicio de Actividades: ', fechaDocumento(emisor.fecha_inicio_actividades)])
    const arranque = y + (cab.letra ? 18 : 15)
    const paso = Math.min(5.4, (y + boxH - 2 - arranque) / Math.max(filas.length - 1, 1))
    filas.forEach(([label, valor], i) => this.etiquetaValor(label, valor, rightX, arranque + i * paso, colDer))

    if (!primera) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(90, 90, 90)
      doc.text('Continuación', x + 2, y + boxH - 2)
      doc.setTextColor(20, 20, 20)
    }

    return y + boxH + 3
  }

  private asegurarEspacio(alto: number): void {
    if (this.y + alto <= PAGE_H - RESERVA_PIE) return
    this.doc.addPage()
    this.y = this.encabezado(false)
    if (this.cols) this.y = this.cabeceraTabla(this.cols, this.y)
  }

  /** Datos en dos columnas dentro de un recuadro (cliente, referencias). */
  bloque(izquierda: CampoBloque[], derecha: CampoBloque[] = [], titulo?: string): this {
    const { doc } = this
    const FILA = 5.4
    const filas = Math.max(izquierda.length, derecha.length)
    const alto = 3 + filas * FILA + (titulo ? 4.5 : 0)
    this.asegurarEspacio(alto + 3)
    const top = this.y
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.3)
    doc.rect(MARGIN, top, CONTENT_W, alto)
    doc.setTextColor(20, 20, 20)
    let base = top + 5
    if (titulo) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(90, 90, 90)
      doc.text(pdfText(titulo.toUpperCase()), MARGIN + 2, base - 0.5)
      doc.setTextColor(20, 20, 20)
      base += 4.5
    }
    doc.setFontSize(8)
    const ancho = derecha.length ? 118 : CONTENT_W - 4
    const colDerecha = MARGIN + 122
    izquierda.forEach(([label, valor], i) => this.etiquetaValor(label, valor, MARGIN + 2, base + i * FILA, ancho))
    derecha.forEach(([label, valor], i) =>
      this.etiquetaValor(label, valor, colDerecha, base + i * FILA, MARGIN + CONTENT_W - colDerecha - 3)
    )
    this.y = top + alto + 3
    return this
  }

  private cabeceraTabla(cols: Columna[], top: number): number {
    const { doc } = this
    doc.setFillColor(235, 235, 235)
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.3)
    doc.rect(MARGIN, top, CONTENT_W, 7, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(20, 20, 20)
    let cx = MARGIN
    for (const col of cols) {
      const a = col.alinear ?? 'left'
      const tx = a === 'right' ? cx + col.ancho - 1.5 : a === 'center' ? cx + col.ancho / 2 : cx + 1.5
      doc.text(pdfText(col.titulo), tx, top + 4.8, { align: a })
      cx += col.ancho
    }
    doc.setFont('helvetica', 'normal')
    return top + 7
  }

  /**
   * Tabla con encabezado repetido en cada página. La columna `colDescripcion` se ajusta a varias líneas;
   * las demás van en una sola.
   */
  tabla(cols: Columna[], filas: FilaTabla[], opciones: { colDescripcion?: number; vacio?: string } = {}): this {
    const { doc } = this
    const colDesc = opciones.colDescripcion ?? 0
    this.cols = cols
    this.asegurarEspacio(7 + 8)
    this.y = this.cabeceraTabla(cols, this.y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)

    if (filas.length === 0) {
      doc.setTextColor(90, 90, 90)
      doc.text(pdfText(opciones.vacio ?? 'Sin líneas'), MARGIN + 2, this.y + 5)
      doc.setTextColor(20, 20, 20)
      this.y += 8
    }

    for (const fila of filas) {
      const lineasDesc = doc.splitTextToSize(pdfText(fila.celdas[colDesc] ?? ''), cols[colDesc].ancho - 3) as string[]
      const lineasDetalle = fila.detalle
        ? (doc.splitTextToSize(pdfText(fila.detalle), cols[colDesc].ancho - 3) as string[])
        : []
      const alto = Math.max(6, (lineasDesc.length + lineasDetalle.length) * 3.4 + 2.4)
      this.asegurarEspacio(alto)
      doc.setFont('helvetica', fila.fuerte ? 'bold' : 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(20, 20, 20)
      doc.setDrawColor(210, 210, 210)
      doc.line(MARGIN, this.y + alto, MARGIN + CONTENT_W, this.y + alto)
      let cx = MARGIN
      cols.forEach((col, i) => {
        if (i === colDesc) {
          doc.text(lineasDesc, cx + 1.5, this.y + 4)
          if (lineasDetalle.length) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(6.5)
            doc.setTextColor(100, 100, 100)
            doc.text(lineasDetalle, cx + 1.5, this.y + 4 + lineasDesc.length * 3.4)
            doc.setFont('helvetica', fila.fuerte ? 'bold' : 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(20, 20, 20)
          }
        } else {
          const a = col.alinear ?? 'left'
          const tx = a === 'right' ? cx + col.ancho - 1.5 : a === 'center' ? cx + col.ancho / 2 : cx + 1.5
          doc.text(pdfText(fila.celdas[i] ?? ''), tx, this.y + 4, { align: a })
        }
        cx += col.ancho
      })
      this.y += alto
    }
    this.cols = null
    this.y += 3
    doc.setFont('helvetica', 'normal')
    return this
  }

  /** Importes a la derecha, el último destacado. */
  totales(filas: FilaTotal[]): this {
    const { doc } = this
    const FILA = 5.8
    const ancho = 78
    const alto = filas.length * FILA + 2
    this.asegurarEspacio(alto + 3)
    const x = MARGIN + CONTENT_W - ancho
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.3)
    doc.rect(x, this.y, ancho, alto)
    doc.setFontSize(8)
    doc.setTextColor(20, 20, 20)
    filas.forEach((f, i) => {
      const yy = this.y + 5 + i * FILA
      doc.setFont('helvetica', f.fuerte ? 'bold' : 'normal')
      doc.setFontSize(f.fuerte ? 9.5 : 8)
      doc.text(pdfText(f.label), x + 2, yy)
      doc.text(pdfText(f.value), x + ancho - 2, yy, { align: 'right' })
    })
    this.y += alto + 4
    doc.setFont('helvetica', 'normal')
    return this
  }

  /** Texto libre con título (observaciones, condiciones). Corta bien entre páginas. */
  seccion(titulo: string, texto: string | null | undefined): this {
    const limpio = (texto ?? '').trim()
    if (!limpio) return this
    const { doc } = this
    doc.setFontSize(8)
    const lineas = doc.splitTextToSize(pdfText(limpio), CONTENT_W - 4) as string[]
    this.asegurarEspacio(5 + Math.min(lineas.length, 3) * 3.8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 20, 20)
    doc.text(pdfText(titulo), MARGIN + 1, this.y + 3.5)
    this.y += 5.5
    doc.setFont('helvetica', 'normal')
    for (const linea of lineas) {
      this.asegurarEspacio(3.8)
      doc.text(linea, MARGIN + 1, this.y + 2.5)
      this.y += 3.8
    }
    this.y += 3
    return this
  }

  /** Líneas de firma, una al lado de la otra. */
  firmas(etiquetas: string[]): this {
    const { doc } = this
    this.asegurarEspacio(30)
    this.y += 16
    const n = Math.max(etiquetas.length, 1)
    const hueco = 8
    // una sola firma no ocupa todo el ancho: queda a la derecha, como en un recibo
    const ancho = n === 1 ? CONTENT_W / 2.5 : (CONTENT_W - hueco * (n - 1)) / n
    const inicio = n === 1 ? MARGIN + CONTENT_W - ancho : MARGIN
    doc.setDrawColor(60, 60, 60)
    doc.setLineWidth(0.3)
    doc.setFontSize(7.5)
    doc.setTextColor(60, 60, 60)
    etiquetas.forEach((et, i) => {
      const x = inicio + i * (ancho + hueco)
      doc.line(x, this.y, x + ancho, this.y)
      doc.text(pdfText(et), x + ancho / 2, this.y + 4, { align: 'center' })
    })
    doc.setTextColor(20, 20, 20)
    this.y += 10
    return this
  }

  /** Texto diagonal tenue en todas las páginas (ANULADO). */
  marcaDeAgua(texto: string): this {
    this.marca = texto
    return this
  }

  /** Agrega pie y marca en todas las páginas y devuelve el PDF. */
  finalizar(): jsPDF {
    const { doc, cab } = this
    const total = doc.getNumberOfPages()
    for (let n = 1; n <= total; n++) {
      doc.setPage(n)
      doc.setDrawColor(190, 190, 190)
      doc.setLineWidth(0.2)
      doc.line(MARGIN, PIE_Y - 3.5, MARGIN + CONTENT_W, PIE_Y - 3.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(110, 110, 110)
      if (cab.pie) doc.text(pdfText(cab.pie), MARGIN, PIE_Y)
      doc.text(`Página ${n} de ${total}`, MARGIN + CONTENT_W, PIE_Y, { align: 'right' })
      if (this.marca) {
        doc.saveGraphicsState()
        doc.setGState(doc.GState({ opacity: 0.14 }))
        doc.setTextColor(200, 30, 30)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(80)
        doc.text(pdfText(this.marca), PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
        doc.restoreGraphicsState()
      }
    }
    doc.setTextColor(20, 20, 20)
    return doc
  }
}
