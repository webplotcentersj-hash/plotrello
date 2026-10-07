import { getAfipAccessToken, mensajeHttp } from './client'
import { parseDoc, tipoComprobanteToCbteTipo } from './mapFactura'
import type { AfipConfigResumen } from './types'

export type AfipPdfEmisor = AfipConfigResumen & {
  razon_social?: string | null
  domicilio_comercial?: string | null
  ingresos_brutos?: string | null
  fecha_inicio_actividades?: string | null
}

export type AfipPdfFactura = {
  tipo_comprobante: string
  punto_venta: number
  numero_comprobante: number
  numero_factura?: string | null
  fecha_emision: string
  fecha_vencimiento?: string | null
  fecha_servicio_desde?: string | null
  fecha_servicio_hasta?: string | null
  cliente_nombre: string
  cliente_dni_cuit?: string | null
  cliente_direccion?: string | null
  cliente_condicion_iva?: string | null
  concepto?: number | null
  subtotal: number
  iva: number
  total: number
  cae?: string | null
  numero_cae?: string | null
  fecha_vencimiento_cae?: string | null
  observaciones?: string | null
  items?: Array<{
    item_numero?: number
    descripcion?: string | null
    cantidad?: number
    precio_unitario?: number
    subtotal?: number
    iva_porcentaje?: number
    iva_monto?: number
    total?: number
  }>
}

export type AfipPdfReferencia = {
  tipo_comprobante: string
  punto_venta: number
  numero_comprobante: number
  fecha_emision?: string | null
} | null

const ALICUOTA_AFIP_ID: Array<[number, number]> = [
  [0, 3],
  [10.5, 4],
  [21, 5],
  [27, 6],
  [5, 8],
  [2.5, 9]
]

function alicuotaAfipId(pct: number): number {
  const match = ALICUOTA_AFIP_ID.find(([alic]) => Math.abs(alic - pct) < 0.001)
  return match ? match[1] : 5
}

const TEMPLATES: Record<string, string> = {
  'Factura A': 'invoice-a',
  'Factura B': 'invoice-b',
  'Factura C': 'invoice-c',
  'Nota de Crédito A': 'credit-note-a',
  'Nota de Crédito B': 'credit-note-b',
  'Nota de Crédito C': 'credit-note-c',
  'Nota de Débito A': 'debit-note-a',
  'Nota de Débito B': 'debit-note-b',
  'Nota de Débito C': 'debit-note-c'
}

function n(value: unknown): number {
  const v = Number(value)
  return Number.isFinite(v) ? v : 0
}

function round2(value: unknown): number {
  return Math.round((n(value) + Number.EPSILON) * 100) / 100
}

/** AfipSDK exige cantidad entera y precio con 2 decimales. */
function cantidadEntera(value: unknown): boolean {
  const q = n(value)
  return q > 0 && Number.isInteger(q)
}

function formatoCantidad(q: number): string {
  const r = Math.round(q * 10000) / 10000
  return String(r).replace('.', ',')
}

function textoItem(value: string | null | undefined): string {
  const t = String(value || '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .trim()
  return t || 'Item'
}

function fechaSdk(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return String(iso)
  return `${d}/${m}/${y}`
}

function letra(tipo: string): 'A' | 'B' | 'C' {
  if (tipo.includes(' A') || tipo.endsWith('A')) return 'A'
  if (tipo.includes(' C') || tipo.endsWith('C')) return 'C'
  return 'B'
}

export function templatePdfAfip(tipo: string): string {
  return TEMPLATES[tipo] || (letra(tipo) === 'C' ? 'invoice-c' : letra(tipo) === 'A' ? 'invoice-a' : 'invoice-b')
}

export function nombreArchivoPdfAfip(factura: AfipPdfFactura): string {
  const tipo = String(factura.tipo_comprobante || 'Factura').replace(/\s+/g, '_')
  const nro = String(factura.numero_factura || `${factura.punto_venta}-${factura.numero_comprobante}`).replace(
    /\s+/g,
    '_'
  )
  return `${tipo}_${nro}.pdf`
}

export function buildAfipSdkPdfRequest(
  factura: AfipPdfFactura,
  emisor: AfipPdfEmisor,
  referencia: AfipPdfReferencia = null
) {
  const tipo = String(factura.tipo_comprobante || '')
  const clase = letra(tipo)
  const cae = String(factura.cae || factura.numero_cae || '').replace(/\D/g, '')
  const cuit = Number(String(emisor.cuit || '').replace(/\D/g, ''))
  const doc = (() => {
    try {
      return parseDoc(factura.cliente_dni_cuit, clase)
    } catch {
      const clean = String(factura.cliente_dni_cuit || '').replace(/\D/g, '')
      if (clean.length >= 7 && clean.length <= 8) return { DocTipo: 96, DocNro: Number(clean) }
      return { DocTipo: 99, DocNro: 0 }
    }
  })()
  const items = [...(factura.items || [])]
  const esA = clase === 'A'

  const lineas = items.length
    ? items.map((item, i) => {
        const cantidadRaw = n(item.cantidad) || 1
        const neto = round2(item.subtotal)
        const total = round2(n(item.total) || neto)
        const entero = cantidadEntera(cantidadRaw)
        const cantidad = entero ? cantidadRaw : 1
        const importeLinea = esA ? neto : total
        const unitRaw = esA
          ? n(item.precio_unitario) || neto / cantidadRaw
          : total / cantidadRaw
        const unit = entero ? round2(unitRaw) : importeLinea
        const desc = textoItem(item.descripcion)
        return {
          code: String(item.item_numero || i + 1).padStart(3, '0'),
          description: entero ? desc : `${desc} x ${formatoCantidad(cantidadRaw)}`,
          quantity: cantidad,
          unit_price: unit,
          subtotal: importeLinea,
          vat_rate: n(item.iva_porcentaje)
        }
      })
    : [
        {
          code: '001',
          description: tipo,
          quantity: 1,
          unit_price: esA ? round2(factura.subtotal) : round2(factura.total),
          subtotal: esA ? round2(factura.subtotal) : round2(factura.total),
          vat_rate: n(factura.iva) > 0 ? 21 : 0
        }
      ]

  const vatBreakdown = new Map<number, { taxable_base: number; vat_subtotal: number }>()
  for (const item of items) {
    const rate = n(item.iva_porcentaje)
    const prev = vatBreakdown.get(rate) || { taxable_base: 0, vat_subtotal: 0 }
    vatBreakdown.set(rate, {
      taxable_base: round2(prev.taxable_base + n(item.subtotal)),
      vat_subtotal: round2(prev.vat_subtotal + n(item.iva_monto))
    })
  }

  const params: Record<string, unknown> = {
    voucher_number: n(factura.numero_comprobante),
    sales_point: n(factura.punto_venta),
    issue_date: fechaSdk(factura.fecha_emision),
    cae_due_date: fechaSdk(factura.fecha_vencimiento_cae) || fechaSdk(factura.fecha_emision),
    issuer_cuit: cuit,
    cae: Number(cae),
    issuer_business_name: emisor.razon_social || 'PLOT CENTER SRL',
    issuer_address: emisor.domicilio_comercial || '-',
    issuer_iva_condition: emisor.condicion_iva || 'Responsable Inscripto',
    issuer_gross_income: emisor.ingresos_brutos || '-',
    issuer_activity_start_date: fechaSdk(emisor.fecha_inicio_actividades) || '-',
    receiver_name: factura.cliente_nombre || 'Consumidor Final',
    receiver_address: factura.cliente_direccion || '-',
    receiver_document_type: doc.DocTipo,
    receiver_document_number: doc.DocNro,
    receiver_iva_condition: factura.cliente_condicion_iva || 'Consumidor Final',
    sale_condition: 'Contado',
    currency_id: 'ARS',
    currency_rate: 1,
    concept: n(factura.concepto) || 1,
    items: lineas,
    vat_amount: round2(factura.iva),
    tributes_amount: 0,
    total_amount: round2(factura.total),
    net_amount_taxed: round2(factura.subtotal),
    net_amount_untaxed: 0,
    exempt_amount: 0
  }

  if (factura.fecha_servicio_desde) params.billing_from = fechaSdk(factura.fecha_servicio_desde)
  if (factura.fecha_servicio_hasta) params.billing_to = fechaSdk(factura.fecha_servicio_hasta)
  if (factura.fecha_vencimiento) params.payment_due_date = fechaSdk(factura.fecha_vencimiento)
  if (vatBreakdown.size) {
    params.vat_breakdown = [...vatBreakdown.entries()].map(([pct, v]) => ({
      vat_rate_id: alicuotaAfipId(pct),
      taxable_base: v.taxable_base,
      vat_subtotal: v.vat_subtotal
    }))
  }
  if (factura.observaciones?.trim()) params.invoice_footer_note = factura.observaciones.trim()

  if (referencia) {
    params.associated_vouchers = [
      {
        voucher_type: tipoComprobanteToCbteTipo(referencia.tipo_comprobante),
        point_of_sale: n(referencia.punto_venta),
        voucher_number: n(referencia.numero_comprobante),
        issue_date: fechaSdk(referencia.fecha_emision)
      }
    ]
    if (tipo.startsWith('Nota de Crédito')) {
      params.credit_note_reason = factura.observaciones?.trim() || 'Anulación / ajuste'
    }
    if (tipo.startsWith('Nota de Débito')) {
      params.debit_note_reason = factura.observaciones?.trim() || 'Ajuste'
    }
  }

  return {
    file_name: nombreArchivoPdfAfip(factura),
    template: {
      name: templatePdfAfip(tipo),
      params
    }
  }
}

export async function crearPdfAfipSdk(payload: ReturnType<typeof buildAfipSdkPdfRequest>): Promise<{
  file: string
  file_name: string
}> {
  const accessToken = getAfipAccessToken()
  if (!accessToken) {
    throw new Error('AFIPSDK_ACCESS_TOKEN no configurado. El PDF oficial se genera en AfipSDK.')
  }

  const res = await fetch('https://app.afipsdk.com/api/v1/pdfs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'sdk-version-number': '1.2.2',
      'sdk-library': 'javascript',
      'sdk-environment': 'prod'
    },
    body: JSON.stringify(payload)
  })

  const crudo = await res.text()
  const data = (() => {
    try {
      return crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null
    } catch {
      return null
    }
  })()

  const file = typeof data?.file === 'string' ? data.file : ''
  if (!res.ok || !file) {
    throw new Error(mensajeHttp(data, res.status, crudo) || 'AfipSDK no devolvió el PDF.')
  }

  return {
    file,
    file_name: typeof data?.file_name === 'string' && data.file_name ? data.file_name : payload.file_name
  }
}

export async function descargarBytesPdfAfip(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo bajar el PDF de AfipSDK (HTTP ${res.status}).`)
  return Buffer.from(await res.arrayBuffer())
}
