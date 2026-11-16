import type { Venta } from '../types/api'

export function montoCobradoVentaLocal(venta: Pick<Venta, 'valor_total' | 'estado_pago' | 'monto_pagado'>): number {
  const total = Number(venta.valor_total) || 0
  if (total <= 0) return 0
  if (venta.estado_pago === 'Cancelado') return 0
  if (venta.estado_pago === 'Parcial') {
    const pagado = Number(venta.monto_pagado) || 0
    return Math.min(Math.max(0, pagado), total)
  }
  if (venta.estado_pago === 'Pagado') return total
  return 0
}

/**
 * Cobrado a mostrar en el panel de cobros. Las ventas cobradas en un solo paso
 * (venta rápida, MP) no siempre tienen filas en el historial: sin filas, se usa
 * lo que dice la venta en vez de mostrar "Cobrado $ 0" en una venta Pagada.
 */
export function cobradoMostradoVenta(
  venta: Pick<Venta, 'valor_total' | 'estado_pago' | 'monto_pagado'>,
  cobros: Array<{ monto: number | string | null | undefined }>
): number {
  if (cobros.length > 0) {
    return Math.round(cobros.reduce((s, c) => s + (Number(c.monto) || 0), 0) * 100) / 100
  }
  return montoCobradoVentaLocal(venta)
}

export function ventaPuedeDevolverDinero(venta: Pick<Venta, 'estado_pago' | 'valor_total' | 'monto_pagado' | 'metodo_pago'>): boolean {
  if (venta.estado_pago === 'Cancelado') return false
  if ((venta.metodo_pago || '') === 'Cuenta Corriente' && venta.estado_pago === 'Pendiente') return false
  return montoCobradoVentaLocal(venta) > 0.009
}

export function clampMontoDevolucion(monto: number, cobrado: number): number {
  if (!Number.isFinite(monto) || monto <= 0) return 0
  const cap = Math.max(0, cobrado)
  return Math.round(Math.min(monto, cap) * 100) / 100
}

export function esDevolucionTotalDinero(monto: number, cobrado: number): boolean {
  return cobrado > 0 && Math.abs(monto - cobrado) <= 0.02
}

export function estadoPagoTrasDevolucion(opts: {
  cobradoAntes: number
  montoDevuelto: number
  cancelarVenta: boolean
}): 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado' {
  if (opts.cancelarVenta) return 'Cancelado'
  const queda = Math.round((opts.cobradoAntes - opts.montoDevuelto) * 100) / 100
  if (queda <= 0.02) return 'Pendiente'
  return 'Parcial'
}
