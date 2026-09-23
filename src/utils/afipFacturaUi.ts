export type CondicionIvaCliente =
  | 'Responsable Inscripto'
  | 'Monotributista'
  | 'Exento'
  | 'Consumidor Final'
  | 'No Responsable'

export type TipoFactura = 'Factura A' | 'Factura B' | 'Factura C'

/** Concepto AFIP. Servicios (2/3) informan período del servicio y vencimiento del pago. */
export type ConceptoAfip = 1 | 2 | 3

export const CONCEPTOS_AFIP: Array<{ value: ConceptoAfip; label: string }> = [
  { value: 1, label: 'Productos' },
  { value: 2, label: 'Servicios' },
  { value: 3, label: 'Productos y servicios' }
]

export function conceptoLabel(concepto: number | null | undefined): string {
  return CONCEPTOS_AFIP.find((c) => c.value === Number(concepto))?.label || 'Productos'
}

export function letraComprobante(tipo: string): 'A' | 'B' | 'C' {
  if (tipo.includes(' A') || tipo.endsWith('A')) return 'A'
  if (tipo.includes(' C') || tipo.endsWith('C')) return 'C'
  return 'B'
}

export function codigoComprobanteAfip(tipo: string): string {
  const map: Record<string, string> = {
    'Factura A': '01',
    'Nota de Débito A': '02',
    'Nota de Crédito A': '03',
    'Factura B': '06',
    'Nota de Débito B': '07',
    'Nota de Crédito B': '08',
    'Factura C': '11',
    'Nota de Débito C': '12',
    'Nota de Crédito C': '13'
  }
  return map[tipo] || '—'
}

/** Monotributistas y exentos solo pueden emitir comprobantes clase C. */
export function emisorEmiteFacturaC(condicionEmisor: string | null | undefined): boolean {
  const c = (condicionEmisor || '').toLowerCase()
  return c.includes('monotribut') || c.includes('exento')
}

export function tiposFacturaPermitidos(condicionEmisor: string | null | undefined): TipoFactura[] {
  return emisorEmiteFacturaC(condicionEmisor) ? ['Factura C'] : ['Factura A', 'Factura B']
}

/**
 * La letra depende del emisor: monotributo/exento → C.
 * Responsable Inscripto → A a RI y monotributistas (RG 5003/2021), B al resto.
 */
export function inferirTipoFactura(
  _cuit: string | null | undefined,
  condicionCliente: CondicionIvaCliente | '' | null | undefined,
  condicionEmisor: string | null | undefined
): TipoFactura {
  if (emisorEmiteFacturaC(condicionEmisor)) return 'Factura C'
  if (condicionCliente === 'Responsable Inscripto' || condicionCliente === 'Monotributista') return 'Factura A'
  return 'Factura B'
}

export function inferirCondicionIva(cuit: string | null | undefined): CondicionIvaCliente {
  const clean = (cuit || '').replace(/\D/g, '')
  if (clean.length === 11) return 'Responsable Inscripto'
  return 'Consumidor Final'
}

/** CUIT/CUIL de 11 dígitos con dígito verificador correcto. */
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

/** Devuelve un mensaje si el receptor no es válido para la letra (mismas reglas que valida AFIP). */
export function validarReceptorComprobante(
  tipo: string,
  condicionCliente: CondicionIvaCliente | '' | null | undefined,
  cuit: string | null | undefined
): string | null {
  const letra = letraComprobante(tipo)
  if (letra === 'A') {
    if (condicionCliente !== 'Responsable Inscripto' && condicionCliente !== 'Monotributista') {
      return 'La Factura A solo se emite a Responsables Inscriptos o Monotributistas.'
    }
    if (!cuitValido(cuit)) return 'La Factura A requiere un CUIT válido del cliente.'
  }
  if (letra === 'B' && (condicionCliente === 'Responsable Inscripto' || condicionCliente === 'Monotributista')) {
    return 'A un Responsable Inscripto o Monotributista corresponde Factura A, no B.'
  }
  return null
}

export function formatPvNumero(puntoVenta: number, numero: number | string): string {
  const pv = String(puntoVenta || 1).padStart(4, '0')
  const n = String(numero).padStart(8, '0')
  return `${pv}-${n}`
}

export function formatFechaAr(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Fecha local (no UTC) en formato yyyy-mm-dd. */
export function hoyISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Redondeo a centavos, mitad hacia arriba, tolerante a errores de coma flotante (2.205 → 2.21). */
export function redondear2(n: number): number {
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(n) * 100 + 1e-7)) / 100
}

/** Alícuota del ítem; respeta 0% (no la convierte en 21%). */
export function normalizarAlicuota(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 21
}

export type OpcionesCalculoFactura = {
  /** El precio unitario ya incluye IVA (precios de mostrador / ventas). */
  preciosConIva?: boolean
  /** Comprobante clase C: sin IVA discriminado. */
  sinIva?: boolean
}

type ItemCalculable = {
  cantidad: number
  precio_unitario: number
  descuento?: number
  iva_porcentaje?: number
}

/** Neto, IVA y total de una línea, redondeados a centavos (total = neto + iva exacto). */
export function calcularLineaItem(item: ItemCalculable, opts: OpcionesCalculoFactura = {}) {
  const bruto = redondear2(Number(item.cantidad || 0) * Number(item.precio_unitario || 0) - Number(item.descuento || 0))
  if (opts.sinIva) return { neto: bruto, iva: 0, total: bruto, alicuota: 0 }

  const alicuota = normalizarAlicuota(item.iva_porcentaje)
  if (opts.preciosConIva) {
    const neto = redondear2(bruto / (1 + alicuota / 100))
    return { neto, iva: redondear2(bruto - neto), total: bruto, alicuota }
  }
  const iva = redondear2((bruto * alicuota) / 100)
  return { neto: bruto, iva, total: redondear2(bruto + iva), alicuota }
}

export function calcularTotalesFactura(items: ItemCalculable[], opts: OpcionesCalculoFactura = {}) {
  let subtotal = 0
  let descuento = 0
  let iva = 0
  const porAlicuota: Record<string, { neto: number; iva: number }> = {}

  for (const item of items) {
    const linea = calcularLineaItem(item, opts)
    subtotal = redondear2(subtotal + linea.neto)
    descuento = redondear2(descuento + Number(item.descuento || 0))
    iva = redondear2(iva + linea.iva)
    const key = String(linea.alicuota)
    if (!porAlicuota[key]) porAlicuota[key] = { neto: 0, iva: 0 }
    porAlicuota[key].neto = redondear2(porAlicuota[key].neto + linea.neto)
    porAlicuota[key].iva = redondear2(porAlicuota[key].iva + linea.iva)
  }

  return { subtotal, descuento, iva, total: redondear2(subtotal + iva), porAlicuota }
}
