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

/** El rol principal incluye estos otros (sin tocar el registro en DB). */
const ROLES_INCLUIDOS_POR_PRINCIPAL: Partial<Record<UserRole, ReadonlyArray<UserRole>>> = {
  imprenta: ['mostrador'],
  'taller-grafico': ['mostrador']
}

export function rolesExtraUsuario(
  usuario: Pick<UsuarioConRol, 'nombre'> | null | undefined
): ReadonlyArray<UserRole> {
  if (!usuario?.nombre) return []
  return ROLES_EXTRA_POR_LOGIN[usuario.nombre.trim().toLowerCase()] ?? []
}

function rolCanonico(rol: string | undefined | null): UserRole | '' {
  const r = String(rol || '').trim().toLowerCase()
  if (r === 'taller-imprenta' || r === 'taller_imprenta' || r === 'taller de imprenta') return 'imprenta'
  if (r === 'taller_grafico' || r === 'taller grafico' || r === 'taller gráfico') return 'taller-grafico'
  return r as UserRole
}

export function usuarioTieneRol(
  usuario: Pick<UsuarioConRol, 'nombre' | 'rol'> | null | undefined,
  rol: UserRole
): boolean {
  if (!usuario) return false
  const principal = rolCanonico(usuario.rol)
  if (principal === rol) return true
  if (usuario.rol === rol) return true
  if (rolesExtraUsuario(usuario).includes(rol)) return true
  return (principal ? ROLES_INCLUIDOS_POR_PRINCIPAL[principal] : undefined)?.includes(rol) ?? false
}

export function usuarioTieneAlgunRol(
  usuario: Pick<UsuarioConRol, 'nombre' | 'rol'> | null | undefined,
  roles: ReadonlyArray<UserRole>
): boolean {
  return roles.some((rol) => usuarioTieneRol(usuario, rol))
}
