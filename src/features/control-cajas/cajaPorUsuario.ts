import type { CajaRegistro } from './types'

const SLUG_PREFIX = 'u-'

export function cajaSlugForUsuario(usuarioId: number): string {
  return `${SLUG_PREFIX}${usuarioId}`
}

export function esCajaSlugUsuario(slug: string): boolean {
  return slug.startsWith(SLUG_PREFIX)
}

export function cajaNombreForUsuario(usuarioNombre: string): string {
  const n = usuarioNombre.trim()
  if (!n) return 'Caja'
  if (n.toLowerCase().startsWith('caja ')) return n
  return `Caja ${n}`
}

/** Caja operativa nueva: fondo en 0 hasta que lo configure el operador/admin. */
export function buildCajaRegistroUsuario(usuarioId: number, usuarioNombre: string): CajaRegistro {
  return {
    slug: cajaSlugForUsuario(usuarioId),
    nombre: cajaNombreForUsuario(usuarioNombre),
    fondo_fijo: 0,
    activa: true
  }
}
