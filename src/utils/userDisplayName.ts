/**
 * Si el valor parece un correo, devuelve solo la parte local (antes de @).
 */
export function nombreSinDominioCorreo(raw: string | null | undefined): string {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (s === '') return ''
  const i = s.indexOf('@')
  if (i === -1) return s
  return s.slice(0, i).trim()
}
