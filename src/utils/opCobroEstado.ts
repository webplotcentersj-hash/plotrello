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

/**
 * Acepta pesos en formato AR (`19.645,50` / `19645,5`) o punto decimal (`19645.00`).
 * Antes se borraban todos los `.` y `19645.00` pasaba a `1964500`.
 */
export function parseMontoPagoParcial(raw: string): number | null {
  let s = String(raw ?? '').replace(/[^\d.,]/g, '').trim()
  if (!s) return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234.567,89
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234,567.89
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasDot) {
    const parts = s.split('.')
    // Un solo punto con 1–2 decimales → decimal (19645.00), no miles.
    if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) {
      // keep 19645.00
    } else {
      // 1.964.500 o 1.964
      s = s.replace(/\./g, '')
    }
  }

  const n = Number(s)
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
    const saldo = Math.max(0, Math.round(total - pagado))
    // Enteros en string: evita que parseMonto trate "19645.00" como miles.
    const asPesos = (n: number) => String(Math.round(n))
    return {
      estado: 'parcial',
      monto: pagado > 0 ? asPesos(pagado) : '',
      saldo: saldo > 0 ? asPesos(saldo) : ''
    }
  }
  return { estado: 'sin_pago', monto: '', saldo: '' }
}
