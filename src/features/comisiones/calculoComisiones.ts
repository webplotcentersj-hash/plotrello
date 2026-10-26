/**
 * Fórmula de comisiones, igual que la del servidor (comisiones_recalcular).
 * Se usa para el simulador de la pantalla; los montos reales los calcula la base.
 */

export type BaseComision = 'neto' | 'total'
export type MomentoComision = 'cobro' | 'venta' | 'factura'

export const BASES: Array<{ value: BaseComision; label: string }> = [
  { value: 'total', label: 'Precio de venta' }
]

export const MOMENTOS: Array<{ value: MomentoComision; label: string; ayuda: string }> = [
  { value: 'cobro', label: 'Al cobrar', ayuda: 'Se devenga sobre el precio de venta, en proporción a lo cobrado' },
  { value: 'venta', label: 'Al registrar la venta', ayuda: 'Se devenga sobre el precio de venta, esté cobrada o no' },
  { value: 'factura', label: 'Al facturar', ayuda: 'Se devenga sobre el precio de venta cuando la factura queda autorizada en AFIP' }
]

export function redondear2(n: number): number {
  if (!Number.isFinite(n)) return 0
  const signo = n < 0 ? -1 : 1
  return (signo * Math.round(Math.abs(n) * 100 + 1e-7)) / 100
}

export type VentaParaComision = {
  valor_total: number
  monto_pagado?: number | null
  estado_pago?: string | null
  /** Tiene factura autorizada en AFIP (solo se usa con momento 'factura'). */
  facturada?: boolean
  /** Notas de crédito autorizadas de esa venta. */
  notas_credito?: number
}

/** Monto de la venta que corresponde comisionar según el momento configurado. */
export function montoComisionable(venta: VentaParaComision, momento: MomentoComision): number {
  const total = Number(venta.valor_total) || 0
  if (venta.estado_pago === 'Cancelado') return 0

  let bruto = 0
  if (momento === 'venta') bruto = total
  else if (momento === 'factura') bruto = venta.facturada ? total : 0
  else if (venta.estado_pago === 'Pagado') bruto = total
  else if (venta.estado_pago === 'Parcial') bruto = Math.min(total, Math.max(Number(venta.monto_pagado) || 0, 0))

  return redondear2(Math.max(bruto - (Number(venta.notas_credito) || 0), 0))
}

/** La comisión se calcula sobre el precio de venta, sin descontar el IVA. */
export function baseComisionable(monto: number, _base?: BaseComision, _alicuotaIva?: number): number {
  return redondear2(monto)
}

export function comisionDeVenta(
  venta: VentaParaComision,
  opts: { base: BaseComision; momento: MomentoComision; alicuotaIva: number; porcentaje: number }
): { comisionable: number; base_monto: number; comision: number } {
  const comisionable = montoComisionable(venta, opts.momento)
  const base_monto = baseComisionable(comisionable, opts.base, opts.alicuotaIva)
  const porcentaje = Math.max(Number(opts.porcentaje) || 0, 0)
  return { comisionable, base_monto, comision: redondear2((base_monto * porcentaje) / 100) }
}
