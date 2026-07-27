import type { UserRole } from '../types/api'

type UsuarioConRol = {
  nombre: string
  rol: UserRole
}

/** Roles adicionales por login (email), sin cambiar el rol principal en DB. */
const ROLES_EXTRA_POR_LOGIN: Record<string, ReadonlyArray<UserRole>> = {
  'achavez@plotcenter.com.ar': ['mostrador', 'caja'],
  'jbarros@plotcenter.com.ar': ['mostrador', 'caja'],
  'mmilla@plotcenter.com.ar': ['caja'],
  'fvidela@plotcenter.com.ar': ['mostrador', 'caja']
}

export function rolesExtraUsuario(
  usuario: Pick<UsuarioConRol, 'nombre'> | null | undefined
): ReadonlyArray<UserRole> {
  if (!usuario?.nombre) return []
  return ROLES_EXTRA_POR_LOGIN[usuario.nombre.trim().toLowerCase()] ?? []
}

export function usuarioTieneRol(
  usuario: Pick<UsuarioConRol, 'nombre' | 'rol'> | null | undefined,
  rol: UserRole
): boolean {
  if (!usuario) return false
  if (usuario.rol === rol) return true
  return rolesExtraUsuario(usuario).includes(rol)
}

export function usuarioTieneAlgunRol(
  usuario: Pick<UsuarioConRol, 'nombre' | 'rol'> | null | undefined,
  roles: ReadonlyArray<UserRole>
): boolean {
  return roles.some((rol) => usuarioTieneRol(usuario, rol))
}
