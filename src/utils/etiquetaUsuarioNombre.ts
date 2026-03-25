/** Si el valor parece email, solo la parte antes de @; si no, el texto recortado. */
export function etiquetaUsuarioNombre(raw: string | null | undefined): string {
  if (raw == null) return '—'
  const s = String(raw).trim()
  if (!s) return '—'
  const i = s.indexOf('@')
  if (i > 0) return s.slice(0, i)
  return s
}
