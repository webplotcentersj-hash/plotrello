export type CondicionIvaCliente =
  | 'Responsable Inscripto'
  | 'Monotributista'
  | 'Exento'
  | 'Consumidor Final'
  | 'No Responsable'

export type TipoFactura = 'Factura A' | 'Factura B' | 'Factura C'

export function letraComprobante(tipo: string): 'A' | 'B' | 'C' {
  if (tipo.includes(' A') || tipo.endsWith('A')) return 'A'
  if (tipo.includes(' C') || tipo.endsWith('C')) return 'C'
  return 'B'
}

export function codigoComprobanteAfip(tipo: string): string {
  const map: Record<string, string> = {
    'Factura A': '01',
    'Factura B': '06',
    'Factura C': '11'
  }
  return map[tipo] || '—'
}

export function inferirTipoFactura(
  cuit: string | null | undefined,
  condicionIva: CondicionIvaCliente | '' | null | undefined
): TipoFactura {
  const clean = (cuit || '').replace(/\D/g, '')
  if (condicionIva === 'Monotributista') return 'Factura C'
  if (clean.length === 11 && condicionIva === 'Responsable Inscripto') return 'Factura A'
  if (clean.length === 11) return 'Factura B'
  return 'Factura B'
}

export function inferirCondicionIva(cuit: string | null | undefined): CondicionIvaCliente {
  const clean = (cuit || '').replace(/\D/g, '')
  if (clean.length === 11) return 'Responsable Inscripto'
  if (clean.length >= 7 && clean.length <= 8) return 'Consumidor Final'
  return 'Consumidor Final'
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

export function calcularLineaItem(item: {
  cantidad: number
  precio_unitario: number
  descuento: number
  iva_porcentaje: number
}) {
  const neto = item.cantidad * item.precio_unitario - (item.descuento || 0)
  const iva = neto * ((item.iva_porcentaje || 0) / 100)
  return { neto, iva, total: neto + iva }
}

export function calcularTotalesFactura(
  items: Array<{ cantidad: number; precio_unitario: number; descuento: number; iva_porcentaje: number }>
) {
  let subtotal = 0
  let descuento = 0
  let iva = 0
  const porAlicuota: Record<string, { neto: number; iva: number }> = {}

  for (const item of items) {
    const bruto = item.cantidad * item.precio_unitario
    const neto = bruto - (item.descuento || 0)
    const ivaItem = neto * ((item.iva_porcentaje || 0) / 100)
    subtotal += neto
    descuento += item.descuento || 0
    iva += ivaItem
    const key = String(item.iva_porcentaje ?? 0)
    if (!porAlicuota[key]) porAlicuota[key] = { neto: 0, iva: 0 }
    porAlicuota[key].neto += neto
    porAlicuota[key].iva += ivaItem
  }

  return { subtotal, descuento, iva, total: subtotal + iva, porAlicuota }
}
