import { normalizeEstadoCc } from '../constants/cuentaCorriente'

export type CcCarteraStats = {
  total: number
  pendiente: number
  aprobada: number
  rechazada: number
  /** Suma algebraica de saldos (aprobados). */
  saldoCartera: number
  /** Suma de saldos positivos de clientes aprobados (lo que deben). */
  deudaTotal: number
  clientesConDeuda: number
}

type Row = {
  estado?: string | null
  alta_completa?: boolean | null
  saldo_actual?: number | null
}

export function calcCarteraStatsCuentaCorriente(registros: Row[]): CcCarteraStats {
  const porEstado = { pendiente: 0, aprobada: 0, rechazada: 0 }
  let saldoCartera = 0
  let deudaTotal = 0
  let clientesConDeuda = 0

  for (const r of registros) {
    const est = normalizeEstadoCc(r)
    porEstado[est] += 1
    if (est !== 'aprobada') continue
    const saldo = Number(r.saldo_actual) || 0
    saldoCartera += saldo
    if (saldo > 0) {
      deudaTotal += saldo
      clientesConDeuda += 1
    }
  }

  return {
    total: registros.length,
    ...porEstado,
    saldoCartera,
    deudaTotal,
    clientesConDeuda
  }
}
