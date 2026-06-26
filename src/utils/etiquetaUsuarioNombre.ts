import {
  resolveDisplayNombre,
  resolveOperarioAsignadoLabel
} from './legajoDisplayRegistry'

/** Nombre visible de un usuario (legajo si existe; nunca email completo). */
export function etiquetaUsuarioNombre(
  raw: string | null | undefined,
  id?: number | null
): string {
  if (raw == null) return '—'
  const s = String(raw).trim()
  if (!s) return '—'
  return resolveDisplayNombre(s, id)
}

export { resolveOperarioAsignadoLabel as etiquetaOperarioAsignado }
