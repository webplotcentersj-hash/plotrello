/** Normaliza valor de <input type="time"> o texto libre a HH:MM. */
export function normalizeHoraEstimada(value: string | null | undefined): string | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw)
  if (!m) return null
  const hh = Math.min(23, Math.max(0, Number(m[1])))
  const mm = Math.min(59, Math.max(0, Number(m[2])))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
