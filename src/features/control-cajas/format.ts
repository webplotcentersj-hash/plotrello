export const fmtArs = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export const fmtArs0 = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR').format(n)
}

/**
 * Parsea montos tipados en es-AR ("1.234.567,89") o toString de number ("40497.99").
 * Cuidado: String(40497.99) no es formato argentino — un replace ciego de "." lo infla.
 */
export const parseNum = (v: unknown): number => {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  if (!s) return 0
  // Punto decimal anglosajón / Number#toString (un solo punto, 1–2 decimales)
  if (/^-?\d+\.\d{1,2}$/.test(s)) {
    const n = parseFloat(s)
    return Number.isNaN(n) ? 0 : n
  }
  // es-AR: miles con punto, decimales con coma
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}

/** Valor seguro para inputs de monto (evita "40497.99" → parseNum inflado). */
export function montoInputFromNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return ''
  const rounded = Math.round(n * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded).replace('.', ',')
}

export const fmtDateAr = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

/** Monto que debe mostrarse en listas (planilla, comprobante MP, Excel o manual). */
export function montoVisibleMovimiento(m: {
  monto_total?: number | null
  efectivo?: number
  otros?: number
  tarjeta?: number | null
  cuenta_corriente?: number | null
  transferencia_bancaria?: number | null
  cheque_propio?: number | null
  cheque_tercero?: number | null
  documento?: number | null
  cuenta_contable?: number | null
}): number {
  if (m.monto_total != null && m.monto_total > 0) return m.monto_total
  const tarj = m.tarjeta ?? 0
  const ef = m.efectivo ?? 0
  const ot = m.otros ?? 0
  const cc = m.cuenta_corriente ?? 0
  const tr = m.transferencia_bancaria ?? 0
  const extra =
    (m.cheque_propio ?? 0) +
    (m.cheque_tercero ?? 0) +
    (m.documento ?? 0) +
    (m.cuenta_contable ?? 0)
  if (tarj > 0 || tr > 0 || cc > 0 || extra > 0) return ef + tarj + tr + cc + ot + extra
  return ef + ot
}

export function montoCuentaCorriente(m: { cuenta_corriente?: number | null }): number {
  return Number(m.cuenta_corriente) || 0
}

/** Cobrado en caja (excluye cuenta corriente contable). */
export function montoCobradoCaja(m: Parameters<typeof montoVisibleMovimiento>[0]): number {
  return Math.max(0, montoVisibleMovimiento(m) - montoCuentaCorriente(m))
}

export const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
