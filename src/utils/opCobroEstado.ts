export type CobroOpEstado = 'ninguno' | 'pagado' | 'parcial' | 'cuenta_corriente' | 'sin_pago'

export function resolveCobroOpEstado(task: {
  marcadaPagada?: boolean
  sinPago?: boolean
  pagoCuentaCorriente?: boolean
  montoPagoParcial?: number | null
  montoSaldoPendiente?: number | null
}): CobroOpEstado {
  if (task.marcadaPagada) return 'pagado'
  if (
    (task.montoPagoParcial != null && Number(task.montoPagoParcial) > 0) ||
    (task.montoSaldoPendiente != null && Number(task.montoSaldoPendiente) > 0)
  ) {
    return 'parcial'
  }
  if (task.pagoCuentaCorriente) return 'cuenta_corriente'
  if (task.sinPago) return 'sin_pago'
  return 'ninguno'
}

export function parseMontoPagoParcial(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')
  if (!cleaned.trim()) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function formatMontoPagoParcial(n: number): string {
  return Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export function cobroOpToTaskFields(
  estado: CobroOpEstado,
  montoRaw: string,
  saldoRaw?: string | number | null
): {
  marcadaPagada: boolean
  sinPago: boolean
  pagoCuentaCorriente: boolean
  montoPagoParcial: number | null
  montoSaldoPendiente: number | null
} {
  if (estado === 'pagado') {
    return {
      marcadaPagada: true,
      sinPago: false,
      pagoCuentaCorriente: false,
      montoPagoParcial: null,
      montoSaldoPendiente: null
    }
  }
  if (estado === 'sin_pago') {
    return {
      marcadaPagada: false,
      sinPago: true,
      pagoCuentaCorriente: false,
      montoPagoParcial: null,
      montoSaldoPendiente: null
    }
  }
  if (estado === 'cuenta_corriente') {
    return {
      marcadaPagada: false,
      sinPago: false,
      pagoCuentaCorriente: true,
      montoPagoParcial: null,
      montoSaldoPendiente: null
    }
  }
  if (estado === 'parcial') {
    const saldo =
      typeof saldoRaw === 'number'
        ? Number.isFinite(saldoRaw) && saldoRaw > 0
          ? Math.round(saldoRaw)
          : null
        : parseMontoPagoParcial(String(saldoRaw || ''))
    return {
      marcadaPagada: false,
      sinPago: false,
      pagoCuentaCorriente: false,
      montoPagoParcial: parseMontoPagoParcial(montoRaw),
      montoSaldoPendiente: saldo
    }
  }
  return {
    marcadaPagada: false,
    sinPago: false,
    pagoCuentaCorriente: false,
    montoPagoParcial: null,
    montoSaldoPendiente: null
  }
}

/** Cobro de la OP a partir de cómo se cerró la venta rápida. */
export function cobroDesdeVenta(venta: {
  estado_pago?: string | null
  metodo_pago?: string | null
  valor_total?: number | null
  monto_pagado?: number | null
}): { estado: CobroOpEstado; monto: string; saldo: string } {
  const metodo = String(venta.metodo_pago || '')
    .trim()
    .toLowerCase()
  if (metodo === 'cuenta corriente') return { estado: 'cuenta_corriente', monto: '', saldo: '' }
  if (venta.estado_pago === 'Pagado') return { estado: 'pagado', monto: '', saldo: '' }
  if (venta.estado_pago === 'Parcial') {
    const total = Number(venta.valor_total) || 0
    const pagado = Number(venta.monto_pagado) || 0
    const saldo = Math.max(0, Math.round((total - pagado) * 100) / 100)
    return {
      estado: 'parcial',
      monto: pagado > 0 ? String(Math.round(pagado)) : '',
      saldo: saldo > 0 ? String(Math.round(saldo)) : ''
    }
  }
  return { estado: 'sin_pago', monto: '', saldo: '' }
}
