import type { FacturaAfipInput, FacturaReferenciaAfip } from './types'

const CBTE_TIPO: Record<string, number> = {
  'Factura A': 1,
  'Nota de Débito A': 2,
  'Nota de Crédito A': 3,
  'Factura B': 6,
  'Nota de Débito B': 7,
  'Nota de Crédito B': 8,
  'Factura C': 11,
  'Nota de Débito C': 12,
  'Nota de Crédito C': 13
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function toAfipDate(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, '')
}

function ivaPorcentajeToAfipId(pct: number): number {
  if (pct >= 26) return 6
  if (pct >= 20) return 5
  if (pct >= 10) return 4
  return 3
}

function parseDoc(
  clienteDniCuit: string | null | undefined,
  condicionIva: string | null | undefined
): { DocTipo: number; DocNro: number } {
  const clean = (clienteDniCuit || '').replace(/\D/g, '')
  if (!clean || condicionIva === 'Consumidor Final') {
    return { DocTipo: 99, DocNro: 0 }
  }
  if (clean.length === 11) return { DocTipo: 80, DocNro: Number(clean) }
  if (clean.length >= 7 && clean.length <= 8) return { DocTipo: 96, DocNro: Number(clean) }
  return { DocTipo: 99, DocNro: 0 }
}

function condicionIvaToReceptorId(condicion: string | null | undefined): number {
  switch (condicion) {
    case 'Responsable Inscripto':
      return 1
    case 'Exento':
      return 4
    case 'Monotributista':
      return 6
    case 'No Responsable':
    case 'Consumidor Final':
    default:
      return 5
  }
}

function buildIvaArray(factura: FacturaAfipInput, esFacturaC: boolean) {
  if (esFacturaC) return undefined

  const buckets = new Map<number, { base: number; importe: number }>()
  const items = factura.items?.length ? factura.items : [{ iva_porcentaje: 21, subtotal: factura.subtotal, iva_monto: factura.iva }]

  for (const item of items) {
    const pct = Number(item.iva_porcentaje ?? 21)
    const id = ivaPorcentajeToAfipId(pct)
    const base = round2(Math.abs(Number(item.subtotal ?? 0)))
    const importe = round2(Math.abs(Number(item.iva_monto ?? base * (pct / 100))))
    const prev = buckets.get(id) || { base: 0, importe: 0 }
    buckets.set(id, { base: round2(prev.base + base), importe: round2(prev.importe + importe) })
  }

  return Array.from(buckets.entries()).map(([Id, v]) => ({
    Id,
    BaseImp: v.base,
    Importe: v.importe
  }))
}

export function tipoComprobanteToCbteTipo(tipo: string): number {
  const code = CBTE_TIPO[tipo]
  if (!code) throw new Error(`Tipo de comprobante no soportado para wsfev1: ${tipo}`)
  return code
}

export function buildWsfeVoucherData(
  factura: FacturaAfipInput,
  params: {
    puntoVenta: number
    numeroComprobante: number
    referencia?: FacturaReferenciaAfip
  }
): Record<string, unknown> {
  const cbteTipo = tipoComprobanteToCbteTipo(factura.tipo_comprobante)
  const esFacturaC = factura.tipo_comprobante.endsWith(' C')
  const { DocTipo, DocNro } = parseDoc(factura.cliente_dni_cuit, factura.cliente_condicion_iva)

  const impNeto = round2(Math.abs(esFacturaC ? factura.total : factura.subtotal))
  const impIva = round2(Math.abs(esFacturaC ? 0 : factura.iva))
  const impTotal = round2(Math.abs(factura.total))

  const data: Record<string, unknown> = {
    CantReg: 1,
    PtoVta: params.puntoVenta,
    CbteTipo: cbteTipo,
    Concepto: 1,
    DocTipo,
    DocNro,
    CbteDesde: params.numeroComprobante,
    CbteHasta: params.numeroComprobante,
    CbteFch: toAfipDate(factura.fecha_emision),
    ImpTotal: impTotal,
    ImpTotConc: 0,
    ImpNeto: impNeto,
    ImpOpEx: 0,
    ImpIVA: impIva,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: condicionIvaToReceptorId(factura.cliente_condicion_iva)
  }

  const iva = buildIvaArray(factura, esFacturaC)
  if (iva?.length) data.Iva = iva

  if (params.referencia) {
    data.CbtesAsoc = [
      {
        Tipo: tipoComprobanteToCbteTipo(params.referencia.tipo_comprobante),
        PtoVta: params.referencia.punto_venta,
        Nro: params.referencia.numero_comprobante
      }
    ]
  }

  return data
}
