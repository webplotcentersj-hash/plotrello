export const fmtArs = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export const fmtArs0 = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR').format(n)
}

export const parseNum = (v: unknown): number => {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

export const fmtDateAr = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

export const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
