import type { CcCuentaMovimiento } from '../types/api'

/** Estado de cuenta ordenado cronológicamente con saldo corrido. */
export function movimientosConSaldoCorrido(movs: CcCuentaMovimiento[]): CcCuentaMovimiento[] {
  const sorted = [...movs].sort((a, b) => {
    const fa = a.fecha || ''
    const fb = b.fecha || ''
    if (fa !== fb) return fa.localeCompare(fb)
    return (a.id ?? 0) - (b.id ?? 0)
  })
  let saldo = 0
  return sorted.map((m) => {
    saldo += (Number(m.debe) || 0) - (Number(m.haber) || 0)
    return { ...m, saldo_acumulado: saldo }
  })
}

export function formatMontoArs(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}
