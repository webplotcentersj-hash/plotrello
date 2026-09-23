import { FacturaInvalidaError } from './errors'
import { normalizarConcepto, resolverFechasServicio } from './fechas'
import type { FacturaAfipInput, FacturaReferenciaAfip } from './types'

export { FacturaInvalidaError }

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

/** Alícuota → Id de AFIP (tabla FEParamGetTiposIva). */
const ALICUOTAS_AFIP: Array<[number, number]> = [
  [0, 3],
  [10.5, 4],
  [21, 5],
  [27, 6],
  [5, 8],
  [2.5, 9]
]

/** Condiciones IVA del receptor que AFIP acepta en comprobantes A. */
const RECEPTOR_CLASE_A = new Set([1, 6, 13, 16])

/** Montos en centavos enteros para que ImpTotal = ImpNeto + ImpIVA cierre exacto. */
function aCentavos(n: unknown): number {
  const v = Math.abs(Number(n) || 0)
  return Math.round(v * 100 + 1e-7)
}

function toAfipDate(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, '')
}

export function letraDeTipo(tipo: string): 'A' | 'B' | 'C' {
  const letra = tipo.trim().slice(-1)
  if (letra === 'A' || letra === 'B' || letra === 'C') return letra
  throw new FacturaInvalidaError(`Tipo de comprobante sin letra: ${tipo}`)
}

function alicuotaToAfipId(pct: number): number {
  const match = ALICUOTAS_AFIP.find(([alic]) => Math.abs(alic - pct) < 0.001)
  if (!match) throw new FacturaInvalidaError(`Alícuota de IVA no soportada por AFIP: ${pct}%`)
  return match[1]
}

export function cuitValido(cuit: string | null | undefined): boolean {
  const clean = (cuit || '').replace(/\D/g, '')
  if (clean.length !== 11) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(clean[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) return false
  return dv === Number(clean[10])
}

export function parseDoc(
  clienteDniCuit: string | null | undefined,
  letra: 'A' | 'B' | 'C'
): { DocTipo: number; DocNro: number } {
  const clean = (clienteDniCuit || '').replace(/\D/g, '')
  if (cuitValido(clean)) return { DocTipo: 80, DocNro: Number(clean) }
  if (letra === 'A') {
    throw new FacturaInvalidaError('La Factura A requiere un CUIT válido del cliente.')
  }
  // DNI: AFIP lo exige para identificar al consumidor final por encima del monto mínimo
  if (clean.length >= 7 && clean.length <= 8) return { DocTipo: 96, DocNro: Number(clean) }
  return { DocTipo: 99, DocNro: 0 }
}

export function condicionIvaToReceptorId(condicion: string | null | undefined): number {
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

function emisorEmiteC(condicionEmisor: string | null | undefined): boolean {
  const c = (condicionEmisor || '').toLowerCase()
  return c.includes('monotribut') || c.includes('exento')
}

/** Mismas reglas de letra que valida AFIP, con un mensaje entendible antes de enviar. */
export function validarLetra(tipo: string, condicionEmisor: string | null | undefined, receptorId: number) {
  const letra = letraDeTipo(tipo)
  if (condicionEmisor) {
    if (emisorEmiteC(condicionEmisor) && letra !== 'C') {
      throw new FacturaInvalidaError(`El emisor es ${condicionEmisor}: solo puede emitir comprobantes C.`)
    }
    if (!emisorEmiteC(condicionEmisor) && letra === 'C') {
      throw new FacturaInvalidaError(`El emisor es ${condicionEmisor}: no puede emitir comprobantes C (usá A o B).`)
    }
  }
  if (letra === 'A' && !RECEPTOR_CLASE_A.has(receptorId)) {
    throw new FacturaInvalidaError('El comprobante A solo se emite a Responsables Inscriptos o Monotributistas.')
  }
  if (letra === 'B' && RECEPTOR_CLASE_A.has(receptorId)) {
    throw new FacturaInvalidaError('A un Responsable Inscripto o Monotributista corresponde comprobante A, no B.')
  }
}

export type ImportesAfip = {
  neto: number
  iva: number
  total: number
  alicuotas: Array<{ Id: number; BaseImp: number; Importe: number }>
}

/**
 * Importes a informar, calculados desde los ítems guardados (redondeados a centavos).
 * ImpIVA es exactamente la suma de las alícuotas e ImpTotal = ImpNeto + ImpIVA.
 */
export function calcularImportesAfip(factura: FacturaAfipInput): ImportesAfip {
  const esC = letraDeTipo(factura.tipo_comprobante) === 'C'
  const items = factura.items || []

  let netoC = 0
  let ivaC = 0
  const buckets = new Map<number, { base: number; importe: number }>()

  if (esC) {
    netoC = items.length ? items.reduce((acc, it) => acc + aCentavos(it.total ?? it.subtotal), 0) : aCentavos(factura.total)
  } else if (items.length) {
    for (const item of items) {
      const pct = Number.isFinite(Number(item.iva_porcentaje)) ? Number(item.iva_porcentaje) : 21
      const id = alicuotaToAfipId(pct)
      const base = aCentavos(item.subtotal)
      const importe = item.iva_monto != null ? aCentavos(item.iva_monto) : Math.round((base * pct) / 100)
      const prev = buckets.get(id) || { base: 0, importe: 0 }
      buckets.set(id, { base: prev.base + base, importe: prev.importe + importe })
    }
  } else {
    // Comprobantes viejos sin ítems: una sola alícuota 21%
    buckets.set(5, { base: aCentavos(factura.subtotal), importe: aCentavos(factura.iva) })
  }

  for (const v of buckets.values()) {
    netoC += v.base
    ivaC += v.importe
  }
  const totalC = netoC + ivaC

  const diferencia = Math.abs(totalC - aCentavos(factura.total))
  if (diferencia > 5) {
    throw new FacturaInvalidaError(
      `El total del comprobante ($${(aCentavos(factura.total) / 100).toFixed(2)}) no coincide con la suma de sus ítems ($${(totalC / 100).toFixed(2)}).`
    )
  }

  return {
    neto: netoC / 100,
    iva: ivaC / 100,
    total: totalC / 100,
    alicuotas: Array.from(buckets.entries()).map(([Id, v]) => ({ Id, BaseImp: v.base / 100, Importe: v.importe / 100 }))
  }
}

export function tipoComprobanteToCbteTipo(tipo: string): number {
  const code = CBTE_TIPO[tipo]
  if (!code) throw new FacturaInvalidaError(`Tipo de comprobante no soportado para wsfev1: ${tipo}`)
  return code
}

export function buildWsfeVoucherData(
  factura: FacturaAfipInput,
  params: {
    puntoVenta: number
    numeroComprobante: number
    fechaEmision: string
    referencia?: FacturaReferenciaAfip
    condicionEmisor?: string | null
  }
): Record<string, unknown> {
  const tipo = factura.tipo_comprobante
  const cbteTipo = tipoComprobanteToCbteTipo(tipo)
  const letra = letraDeTipo(tipo)
  const receptorId = condicionIvaToReceptorId(factura.cliente_condicion_iva)
  validarLetra(tipo, params.condicionEmisor, receptorId)

  const { DocTipo, DocNro } = parseDoc(factura.cliente_dni_cuit, letra)
  const importes = calcularImportesAfip(factura)
  const concepto = normalizarConcepto(factura.concepto)

  const data: Record<string, unknown> = {
    CantReg: 1,
    PtoVta: params.puntoVenta,
    CbteTipo: cbteTipo,
    Concepto: concepto,
    DocTipo,
    DocNro,
    CbteDesde: params.numeroComprobante,
    CbteHasta: params.numeroComprobante,
    CbteFch: toAfipDate(params.fechaEmision),
    ImpTotal: importes.total,
    ImpTotConc: 0,
    ImpNeto: importes.neto,
    ImpOpEx: 0,
    ImpIVA: importes.iva,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: receptorId
  }

  if (letra !== 'C' && importes.alicuotas.length) data.Iva = importes.alicuotas

  if (concepto !== 1) {
    const servicio = resolverFechasServicio(factura, params.fechaEmision)
    data.FchServDesde = toAfipDate(servicio.desde)
    data.FchServHasta = toAfipDate(servicio.hasta)
    data.FchVtoPago = toAfipDate(servicio.vtoPago)
  }

  if (tipo.startsWith('Nota de')) {
    if (!params.referencia) {
      throw new FacturaInvalidaError('La nota de crédito/débito debe referenciar el comprobante original.')
    }
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
