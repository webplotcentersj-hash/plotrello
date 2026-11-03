import { jsPDF } from 'jspdf'
import { toDataURL } from 'qrcode'
import type { ConfiguracionAFIPRecord, FacturaItemRecord, FacturaVentaRecord } from '../types/api'
import {
  codigoComprobanteAfip,
  conceptoLabel,
  cuitValido,
  formatFechaAr,
  letraComprobante,
  redondear2
} from './afipFacturaUi'

// Helvetica de jsPDF cubre Latin-1 (acentos, ñ, ²): se conserva y se descarta lo que quede fuera.
export function pdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFC')
    .replace(/·/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E¡-ÿ]/g, '')
}

export const LOGO_URL = '/factura/plot-center-pc.png'
const MARGIN = 10
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2
const AFIP_QR_BASE = 'https://www.afip.gob.ar/fe/qr/?p='

export type FacturaPdf = FacturaVentaRecord & {
  items?: FacturaItemRecord[]
  /** Texto de la condición de venta. Si falta se deduce del vencimiento de pago. */
  condicion_venta?: string | null
}

/** Comprobante original de una nota de crédito/débito. */
export type ReferenciaPdf = {
  tipo_comprobante: string
  numero_factura: string
  fecha_emision?: string | null
}

export type OpcionesPdf = {
  /** Logo como data URL. `undefined` lo carga del sitio; `null` genera el PDF sin logo. */
  logoDataUrl?: string | null
  referencia?: ReferenciaPdf | null
}

export type EmisorPdf = Pick<
  ConfiguracionAFIPRecord,
  'cuit' | 'razon_social' | 'domicilio_comercial' | 'condicion_iva' | 'ingresos_brutos' | 'fecha_inicio_actividades'
>

export type AfipQrPayload = {
  ver: 1
  fecha: string
  cuit: number
  ptoVta: number
  tipoCmp: number
  nroCmp: number
  importe: number
  moneda: 'PES'
  ctz: 1
  tipoDocRec: number
  nroDocRec: number
  tipoCodAut: 'E'
  codAut: number
}

export function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function cantidadTexto(n: number): string {
  return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })
}

export function formatCuitPdf(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length !== 11) return (raw || '').trim()
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

export function tipoDocReceptorPdf(dniCuit: string | null | undefined): { tipoDocRec: number; nroDocRec: number } {
  const clean = (dniCuit || '').replace(/\D/g, '')
  if (cuitValido(clean)) return { tipoDocRec: 80, nroDocRec: Number(clean) }
  if (clean.length >= 7 && clean.length <= 8) return { tipoDocRec: 96, nroDocRec: Number(clean) }
  return { tipoDocRec: 99, nroDocRec: 0 }
}

export function caeFactura(factura: FacturaVentaRecord): string {
  return String(factura.cae || factura.numero_cae || '').replace(/\D/g, '')
}

export function buildAfipQrPayload(factura: FacturaVentaRecord, cuitEmisor: string): AfipQrPayload | null {
  const cae = caeFactura(factura)
  const cuit = Number((cuitEmisor || '').replace(/\D/g, ''))
  const tipoCmp = Number(codigoComprobanteAfip(factura.tipo_comprobante))
  if (!cae || !cuit || !Number.isFinite(tipoCmp) || tipoCmp <= 0) return null
  const doc = tipoDocReceptorPdf(factura.cliente_dni_cuit)
  return {
    ver: 1,
    fecha: String(factura.fecha_emision || '').slice(0, 10),
    cuit,
    ptoVta: Number(factura.punto_venta) || 0,
    tipoCmp,
    nroCmp: Number(factura.numero_comprobante) || 0,
    // Las notas de crédito se guardan con importes negativos; ARCA informa siempre el importe en positivo.
    importe: Math.abs(Number(factura.total) || 0),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: doc.tipoDocRec,
    nroDocRec: doc.nroDocRec,
    tipoCodAut: 'E',
    codAut: Number(cae)
  }
}

export function buildAfipQrUrl(payload: AfipQrPayload): string {
  return `${AFIP_QR_BASE}${btoa(JSON.stringify(payload))}`
}

/** Condición de venta a imprimir: la indicada o, si hay vencimiento de pago posterior a la emisión, cuenta corriente. */
export function condicionVentaTexto(factura: FacturaPdf): string {
  const explicita = factura.condicion_venta?.trim()
  if (explicita) return explicita
  const emision = String(factura.fecha_emision || '').slice(0, 10)
  const vto = String(factura.fecha_vencimiento || '').slice(0, 10)
  if (vto && emision && vto > emision) return `Cuenta corriente (vence ${formatFechaAr(vto)})`
  return 'Contado'
}

export type LineaPdf = {
  numero: string
  cantidad: number
  descripcion: string
  /** A: neto unitario. B y C: precio final unitario (con IVA). Ya con el descuento aplicado. */
  unitario: number
  alicuota: number
  neto: number
  iva: number
  total: number
}

type Letra = 'A' | 'B' | 'C'

export function lineasPdf(items: FacturaItemRecord[] | undefined, letra: Letra): LineaPdf[] {
  return [...(items || [])]
    .sort((a, b) => (a.item_numero || 0) - (b.item_numero || 0))
    .map((item, i) => {
      const cantidad = Number(item.cantidad) || 0
      // Las notas de crédito guardan los importes en negativo: el comprobante los muestra en positivo.
      const neto = redondear2(Math.abs(Number(item.subtotal) || 0))
      const iva = letra === 'C' ? 0 : redondear2(Math.abs(Number(item.iva_monto) || 0))
      const total = redondear2(Math.abs(Number(item.total) || 0) || neto + iva)
      const base = letra === 'A' ? neto : total
      // La app guarda el precio unitario neto de IVA aunque se haya cargado con IVA incluido. En la A se
      // muestra tal cual si cierra con el subtotal; con descuento aparte o en B y C se deriva del importe.
      const precioNeto = Math.abs(Number(item.precio_unitario) || 0)
      const precioNetoCierra = precioNeto > 0 && Math.abs(precioNeto * cantidad - neto) <= 0.01 + 0.005 * cantidad
      return {
        numero: String(item.item_numero || i + 1),
        cantidad,
        descripcion: item.descripcion || '',
        unitario:
          letra === 'A' && precioNetoCierra
            ? redondear2(precioNeto)
            : cantidad > 0
              ? redondear2(base / cantidad)
              : base,
        alicuota: letra === 'C' ? 0 : Number(item.iva_porcentaje) || 0,
        neto,
        iva,
        total
      }
    })
}

export type ResumenPdf = {
  letra: Letra
  neto: number
  alicuotas: Array<{ alicuota: number; neto: number; iva: number }>
  iva: number
  otrosTributos: number
  total: number
  /** Solo Factura B: IVA que contiene el precio final (Régimen de Transparencia Fiscal, Ley 27.743). */
  ivaContenido: number
}

export function resumenImportesPdf(factura: FacturaPdf, letra: Letra): ResumenPdf {
  const lineas = lineasPdf(factura.items, letra)
  const porAlicuota = new Map<number, { neto: number; iva: number }>()
  for (const l of lineas) {
    const prev = porAlicuota.get(l.alicuota) || { neto: 0, iva: 0 }
    porAlicuota.set(l.alicuota, { neto: redondear2(prev.neto + l.neto), iva: redondear2(prev.iva + l.iva) })
  }
  const neto = lineas.length
    ? redondear2(lineas.reduce((s, l) => s + l.neto, 0))
    : redondear2(Math.abs(Number(factura.subtotal) || 0))
  const iva = lineas.length
    ? redondear2(lineas.reduce((s, l) => s + l.iva, 0))
    : letra === 'C'
      ? 0
      : redondear2(Math.abs(Number(factura.iva) || 0))
  let alicuotas = [...porAlicuota.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([alicuota, v]) => ({ alicuota, neto: v.neto, iva: v.iva }))
  // Comprobantes viejos sin ítems: se asume una sola alícuota del 21 %, como al autorizarlos.
  if (!lineas.length && iva > 0) alicuotas = [{ alicuota: 21, neto, iva }]
  return {
    letra,
    neto,
    alicuotas,
    iva,
    otrosTributos: 0,
    total: redondear2(Math.abs(Number(factura.total) || 0) || neto + iva),
    ivaContenido: letra === 'B' ? iva : 0
  }
}

export async function loadDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || '') || null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function cargarEmisor(): Promise<EmisorPdf> {
  try {
    const { default: apiService } = await import('../services/api')
    const r = await apiService.getConfiguracionAFIP()
    if (r.success && r.data) {
      return {
        cuit: r.data.cuit,
        razon_social: r.data.razon_social,
        domicilio_comercial: r.data.domicilio_comercial,
        condicion_iva: r.data.condicion_iva,
        ingresos_brutos: r.data.ingresos_brutos,
        fecha_inicio_actividades: r.data.fecha_inicio_actividades
      }
    }
  } catch {
    // noop
  }
  return {
    cuit: '',
    razon_social: 'PLOT CENTER S.R.L.',
    domicilio_comercial: null,
    condicion_iva: 'Responsable Inscripto',
    ingresos_brutos: null,
    fecha_inicio_actividades: null
  }
}

async function cargarReferencia(factura: FacturaPdf): Promise<ReferenciaPdf | null> {
  if (!factura.id_factura_referencia) return null
  try {
    const { default: apiService } = await import('../services/api')
    const r = await apiService.getFactura(factura.id_factura_referencia)
    if (r.success && r.data) {
      return {
        tipo_comprobante: r.data.tipo_comprobante,
        numero_factura: r.data.numero_factura,
        fecha_emision: r.data.fecha_emision
      }
    }
  } catch {
    // la nota se imprime igual, sin el comprobante asociado
  }
  return null
}

function nombreArchivoPdf(factura: FacturaVentaRecord): string {
  const tipo = pdfText(factura.tipo_comprobante || 'Factura').replace(/\s+/g, '_')
  const nro = pdfText(factura.numero_factura || String(factura.id)).replace(/\s+/g, '_')
  return `${tipo}_${nro}.pdf`
}

export async function buildFacturaAfipPdf(
  factura: FacturaPdf,
  emisor: EmisorPdf,
  opciones: OpcionesPdf = {}
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const autorizada = factura.estado_afip === 'Autorizada' && Boolean(caeFactura(factura))
  const letra = letraComprobante(factura.tipo_comprobante)
  const codigo = codigoComprobanteAfip(factura.tipo_comprobante)
  const lineas = lineasPdf(factura.items, letra)
  const resumen = resumenImportesPdf(factura, letra)
  const logo = opciones.logoDataUrl !== undefined ? opciones.logoDataUrl : await loadDataUrl(LOGO_URL)
  const qrPayload = autorizada ? buildAfipQrPayload(factura, emisor.cuit) : null
  const qrDataUrl = qrPayload ? await toDataURL(buildAfipQrUrl(qrPayload), { width: 280, margin: 1, errorCorrectionLevel: 'M' }) : null

  const etiquetaValor = (label: string, value: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold')
    doc.text(pdfText(label), x, y)
    const w = doc.getTextWidth(pdfText(label)) + 1
    doc.setFont('helvetica', 'normal')
    doc.text(pdfText(value), x + w, y)
  }

  const tipoTitulo = pdfText(factura.tipo_comprobante.replace(/\s+[ABC]$/, '')).toUpperCase()
  const puntoVenta = String(factura.punto_venta || 0).padStart(4, '0')
  const numero = String(factura.numero_comprobante || 0).padStart(8, '0')

  const drawHeader = (primera: boolean): number => {
    const x = MARGIN
    const y = MARGIN
    const boxH = 44
    const mid = x + CONTENT_W / 2
    const right = x + CONTENT_W

    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.4)
    doc.rect(x, y, CONTENT_W, boxH)
    doc.line(mid, y + 15, mid, y + boxH)

    // Recuadro de la letra
    doc.setFillColor(255, 255, 255)
    doc.rect(mid - 8, y, 16, 15, 'FD')
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(letra, mid, y + 10.5, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(`COD. ${codigo.padStart(3, '0')}`, mid, y + 13.6, { align: 'center' })

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
    let ey = y + 28
    const domicilio = doc.splitTextToSize(
      pdfText(`Domicilio Comercial: ${emisor.domicilio_comercial || '-'}`),
      mid - 10 - leftX
    ) as string[]
    doc.setFont('helvetica', 'normal')
    doc.text(domicilio.slice(0, 2), leftX, ey)
    ey += Math.min(domicilio.length, 2) * 3.8 + 1
    etiquetaValor('Condición frente al IVA: ', emisor.condicion_iva || '-', leftX, ey)

    // Comprobante (derecha)
    const rightX = mid + 11
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(tipoTitulo, rightX, y + 11)
    doc.setFontSize(7.5)
    doc.text(autorizada ? 'ORIGINAL' : 'BORRADOR', right - 3, y + 5.5, { align: 'right' })
    doc.setFontSize(8)
    etiquetaValor('Punto de Venta: ', puntoVenta, rightX, y + 18)
    etiquetaValor('Comp. Nro: ', numero, rightX + 38, y + 18)
    etiquetaValor('Fecha de Emisión: ', formatFechaAr(factura.fecha_emision), rightX, y + 23.5)
    etiquetaValor('CUIT: ', formatCuitPdf(emisor.cuit) || '-', rightX, y + 29)
    etiquetaValor('Ingresos Brutos: ', emisor.ingresos_brutos || '-', rightX, y + 34.5)
    etiquetaValor(
      'Inicio de Actividades: ',
      emisor.fecha_inicio_actividades ? formatFechaAr(emisor.fecha_inicio_actividades) : '-',
      rightX,
      y + 40
    )

    if (!primera) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(90, 90, 90)
      doc.text('Continuación', x + 2, y + boxH - 2)
      doc.setTextColor(20, 20, 20)
    }

    return y + boxH + 3
  }

  let y = drawHeader(true)

  // Receptor
  const docDigitos = (factura.cliente_dni_cuit || '').replace(/\D/g, '')
  const docEtiqueta = docDigitos.length === 11 ? 'CUIT' : docDigitos.length >= 7 && docDigitos.length <= 8 ? 'DNI' : 'CUIT/DNI'
  const concepto = [factura.concepto ? conceptoLabel(factura.concepto) : null, factura.numero_op ? `OP ${factura.numero_op}` : null]
    .filter(Boolean)
    .join('  -  ')
  const izquierda: Array<[string, string]> = [
    ['Apellido y Nombre / Razón Social: ', factura.cliente_nombre || '-'],
    ['Domicilio: ', factura.cliente_direccion || '-'],
    ['Condición de venta: ', condicionVentaTexto(factura)]
  ]
  const derecha: Array<[string, string]> = [
    [`${docEtiqueta}: `, factura.cliente_dni_cuit ? formatCuitPdf(factura.cliente_dni_cuit) : '-'],
    ['Condición frente al IVA: ', factura.cliente_condicion_iva || 'Consumidor Final'],
    ['Concepto: ', concepto || '-']
  ]
  const extras: Array<Array<[string, string]>> = []
  if (factura.concepto && factura.concepto !== 1) {
    const periodo =
      factura.fecha_servicio_desde && factura.fecha_servicio_hasta
        ? `${formatFechaAr(factura.fecha_servicio_desde)} al ${formatFechaAr(factura.fecha_servicio_hasta)}`
        : '-'
    extras.push([
      ['Período facturado: ', periodo],
      ['Vto. de pago: ', factura.fecha_vencimiento ? formatFechaAr(factura.fecha_vencimiento) : '-']
    ])
  }
  if (opciones.referencia) {
    const ref = opciones.referencia
    extras.push([
      [
        'Comprobante asociado: ',
        `${ref.tipo_comprobante} ${ref.numero_factura}${ref.fecha_emision ? ` (${formatFechaAr(ref.fecha_emision)})` : ''}`
      ]
    ])
  }
  const FILA = 5.4
  const alto = 3 + izquierda.length * FILA + extras.length * FILA
  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, alto)
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(8)
  const colDerecha = MARGIN + 122
  izquierda.forEach(([label, valor], i) => {
    const ancho = 118 - doc.getTextWidth(pdfText(label)) - 4
    const linea = (doc.splitTextToSize(pdfText(valor), Math.max(20, ancho)) as string[])[0] || ''
    etiquetaValor(label, linea, MARGIN + 2, y + 5 + i * FILA)
  })
  derecha.forEach(([label, valor], i) => {
    const ancho = MARGIN + CONTENT_W - colDerecha - doc.getTextWidth(pdfText(label)) - 3
    const linea = (doc.splitTextToSize(pdfText(valor), Math.max(15, ancho)) as string[])[0] || ''
    etiquetaValor(label, linea, colDerecha, y + 5 + i * FILA)
  })
  extras.forEach((fila, i) => {
    const yy = y + 5 + (izquierda.length + i) * FILA
    fila.forEach(([label, valor], j) => etiquetaValor(label, valor, MARGIN + 2 + j * 95, yy))
  })
  y += alto + 3

  // Detalle: A discrimina IVA; B y C muestran precio final.
  const cols =
    letra === 'A'
      ? [
          { title: '#', w: 8, align: 'center' as const },
          { title: 'Cant.', w: 17, align: 'right' as const },
          { title: 'Producto / Servicio', w: 66, align: 'left' as const },
          { title: 'Precio unit.', w: 25, align: 'right' as const },
          { title: 'Alíc. IVA', w: 15, align: 'right' as const },
          { title: 'Subtotal', w: 26, align: 'right' as const },
          { title: 'Subtotal c/IVA', w: 33, align: 'right' as const }
        ]
      : [
          { title: '#', w: 8, align: 'center' as const },
          { title: 'Cant.', w: 20, align: 'right' as const },
          { title: 'Producto / Servicio', w: 100, align: 'left' as const },
          { title: 'Precio unit.', w: 30, align: 'right' as const },
          { title: 'Subtotal', w: 32, align: 'right' as const }
        ]
  const colDesc = 2

  const drawTableHead = (top: number): number => {
    doc.setFillColor(235, 235, 235)
    doc.setDrawColor(30, 30, 30)
    doc.rect(MARGIN, top, CONTENT_W, 7, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(20, 20, 20)
    let cx = MARGIN
    for (const col of cols) {
      const tx = col.align === 'right' ? cx + col.w - 1.5 : col.align === 'center' ? cx + col.w / 2 : cx + 1.5
      doc.text(pdfText(col.title), tx, top + 4.8, { align: col.align })
      cx += col.w
    }
    return top + 7
  }

  y = drawTableHead(y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

  const ensureSpace = (need: number) => {
    if (y + need < PAGE_H - 48) return
    doc.addPage()
    y = drawTableHead(drawHeader(false))
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
  }

  if (lineas.length === 0) {
    ensureSpace(8)
    doc.setTextColor(90, 90, 90)
    doc.text('Sin items', MARGIN + 2, y + 5)
    doc.setTextColor(20, 20, 20)
    y += 8
  } else {
    for (const l of lineas) {
      const descLines = doc.splitTextToSize(pdfText(l.descripcion), cols[colDesc].w - 3) as string[]
      const rowH = Math.max(6, descLines.length * 3.4 + 2.4)
      ensureSpace(rowH)
      doc.setDrawColor(210, 210, 210)
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH)
      const values =
        letra === 'A'
          ? [l.numero, cantidadTexto(l.cantidad), '', money(l.unitario), `${l.alicuota.toLocaleString('es-AR')}%`, money(l.neto), money(l.total)]
          : [l.numero, cantidadTexto(l.cantidad), '', money(l.unitario), money(l.total)]
      let cx = MARGIN
      values.forEach((value, i) => {
        const col = cols[i]
        if (i === colDesc) {
          doc.text(descLines, cx + 1.5, y + 4)
        } else {
          const tx = col.align === 'right' ? cx + col.w - 1.5 : col.align === 'center' ? cx + col.w / 2 : cx + 1.5
          doc.text(value, tx, y + 4, { align: col.align })
        }
        cx += col.w
      })
      y += rowH
    }
  }

  // Totales (derecha) y, en Factura B, leyenda de transparencia fiscal (izquierda)
  const filasTotales: Array<{ label: string; value: string; fuerte?: boolean }> = []
  if (letra === 'A') {
    filasTotales.push({ label: 'Importe Neto Gravado', value: money(resumen.neto) })
    for (const a of resumen.alicuotas) {
      filasTotales.push({ label: `IVA ${a.alicuota.toLocaleString('es-AR')}%`, value: money(a.iva) })
    }
  } else {
    filasTotales.push({ label: 'Subtotal', value: money(resumen.total) })
  }
  filasTotales.push({ label: 'Importe Otros Tributos', value: money(resumen.otrosTributos) })
  filasTotales.push({ label: 'Importe Total', value: money(resumen.total), fuerte: true })

  const altoTotales = filasTotales.length * 6 + 4
  const altoTransparencia = letra === 'B' ? 18 : 0
  ensureSpace(Math.max(altoTotales, altoTransparencia) + 6)
  const topTotales = y + 3
  const totW = 84
  const totX = MARGIN + CONTENT_W - totW
  let ty = topTotales + 5
  doc.setTextColor(20, 20, 20)
  for (const fila of filasTotales) {
    doc.setFont('helvetica', fila.fuerte ? 'bold' : 'normal')
    doc.setFontSize(fila.fuerte ? 10 : 8)
    if (fila.fuerte) {
      doc.setFillColor(235, 235, 235)
      doc.rect(totX, ty - 4.5, totW, 7.5, 'F')
    }
    doc.text(pdfText(fila.label), totX + 2, ty)
    doc.text(fila.value, totX + totW - 2, ty, { align: 'right' })
    ty += fila.fuerte ? 7 : 6
  }

  if (letra === 'B') {
    doc.setDrawColor(120, 120, 120)
    doc.setLineWidth(0.25)
    doc.rect(MARGIN, topTotales, 100, altoTransparencia)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)', MARGIN + 2, topTotales + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(`IVA Contenido: ${money(resumen.ivaContenido)}`, MARGIN + 2, topTotales + 10.5)
    doc.text('Otros Impuestos Nacionales Indirectos: ' + money(0), MARGIN + 2, topTotales + 15)
  }
  y = topTotales + Math.max(altoTotales, altoTransparencia) + 3

  if (factura.observaciones?.trim()) {
    ensureSpace(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Observaciones', MARGIN, y + 4)
    doc.setFont('helvetica', 'normal')
    const obs = doc.splitTextToSize(pdfText(factura.observaciones), CONTENT_W - 2) as string[]
    doc.text(obs.slice(0, 4), MARGIN, y + 9)
    y += 9 + Math.min(obs.length, 4) * 3.6
  }

  const footerTop = PAGE_H - 42
  if (y > footerTop - 4) {
    doc.addPage()
    y = drawHeader(false)
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.3)
    doc.rect(MARGIN, footerTop, CONTENT_W, 32)

    if (qrDataUrl && i === pages) {
      try {
        doc.addImage(qrDataUrl, 'PNG', MARGIN + 2, footerTop + 2, 28, 28)
      } catch {
        // QR opcional
      }
    }

    const fx = qrDataUrl && i === pages ? MARGIN + 34 : MARGIN + 3
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    if (autorizada) {
      doc.text('Comprobante Autorizado', fx, footerTop + 7)
      etiquetaValor('CAE N°: ', caeFactura(factura), fx, footerTop + 13)
      if (factura.fecha_vencimiento_cae) {
        etiquetaValor('Fecha de Vto. de CAE: ', formatFechaAr(factura.fecha_vencimiento_cae), fx, footerTop + 18)
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Escaneá el QR para verificar el comprobante en ARCA.', fx, footerTop + 24)
    } else {
      doc.setTextColor(140, 40, 40)
      doc.text('BORRADOR - No válido como factura', fx, footerTop + 10)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Este documento no tiene CAE y no fue autorizado por ARCA.', fx, footerTop + 16)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(90, 90, 90)
    doc.text(
      pdfText(`${emisor.razon_social || 'Plot Lab'}  ·  Página ${i}/${pages}`),
      PAGE_W / 2,
      PAGE_H - 6,
      { align: 'center' }
    )
    doc.setTextColor(20, 20, 20)
  }

  return doc
}

/** Arma el PDF de un comprobante cargando emisor, logo y comprobante asociado. */
export async function generarFacturaAfipPdf(
  factura: FacturaPdf,
  config?: EmisorPdf | null
): Promise<{ doc: jsPDF; nombre: string }> {
  const emisor = config ?? (await cargarEmisor())
  if (factura.estado_afip === 'Autorizada' && caeFactura(factura) && !emisor.cuit) {
    throw new Error('No se pudo leer la configuración del emisor (CUIT), necesaria para el QR de la factura. Probá de nuevo.')
  }
  const referencia = await cargarReferencia(factura)
  const doc = await buildFacturaAfipPdf(factura, emisor, { referencia })
  return { doc, nombre: nombreArchivoPdf(factura) }
}

export async function descargarFacturaAfipPdf(factura: FacturaPdf, config?: EmisorPdf | null): Promise<void> {
  const { doc, nombre } = await generarFacturaAfipPdf(factura, config)
  doc.save(nombre)
}
