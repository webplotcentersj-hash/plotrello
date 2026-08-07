export type CobroOpEstado = 'ninguno' | 'pagado' | 'parcial' | 'cuenta_corriente' | 'sin_pago'

export function resolveCobroOpEstado(task: {
  marcadaPagada?: boolean
  sinPago?: boolean
  pagoCuentaCorriente?: boolean
  montoPagoParcial?: number | null
}): CobroOpEstado {
  if (task.marcadaPagada) return 'pagado'
  if (task.montoPagoParcial != null && Number(task.montoPagoParcial) > 0) return 'parcial'
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
  montoRaw: string
): {
  marcadaPagada: boolean
  sinPago: boolean
  pagoCuentaCorriente: boolean
  montoPagoParcial: number | null
} {
  if (estado === 'pagado') {
    return {
      marcadaPagada: true,
      sinPago: false,
      pagoCuentaCorriente: false,
      montoPagoParcial: null
    }
  }
  if (estado === 'sin_pago') {
    return {
      marcadaPagada: false,
      sinPago: true,
      pagoCuentaCorriente: false,
      montoPagoParcial: null
    }
  }
  if (estado === 'cuenta_corriente') {
    return {
      marcadaPagada: false,
      sinPago: false,
      pagoCuentaCorriente: true,
      montoPagoParcial: null
    }
  }
  if (estado === 'parcial') {
    return {
      marcadaPagada: false,
      sinPago: false,
      pagoCuentaCorriente: false,
      montoPagoParcial: parseMontoPagoParcial(montoRaw)
    }
  }
  return {
    marcadaPagada: false,
    sinPago: false,
    pagoCuentaCorriente: false,
    montoPagoParcial: null
  }
}
