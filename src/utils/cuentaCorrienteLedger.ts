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

/**
 * Parsea entrada de monto (AR): 78.000,50 · 78000,50 · 78000.5
 * Evita que parseFloat('78.000') devuelva 78 por el separador de miles.
 */
export function parseMontoArsInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma > -1 && (lastDot < 0 || lastComma > lastDot)) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  if (lastDot > -1 && lastComma < 0) {
    const after = s.slice(lastDot + 1)
    if (/^\d{3}$/.test(after) && !/\.\d{1,2}$/.test(s)) {
      const n = parseFloat(s.replace(/\./g, ''))
      return Number.isFinite(n) ? n : null
    }
  }

  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
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

/** Monto para KPIs: compacto si es muy largo, siempre con 2 decimales en tooltip vía caller. */
export function formatMontoArsKpi(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 2
    }).format(value)
  }
  if (abs >= 100_000) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(value)
  }
  return formatMontoArs(value)
}
