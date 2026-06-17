import type { Usuario } from '../hooks/useAuth'

const ADMIN_HOME_ROLES: Usuario['rol'][] = ['administracion', 'gerencia']

/** Home del staff con rol administración o gerencia (sesión principal, no admin.html). */
export function adminStaffHomeRoute(rol?: string | null): string | null {
  if (!rol) return null
  return ADMIN_HOME_ROLES.includes(rol as Usuario['rol']) ? '/admin' : null
}

export function isAdminStaffHomeRole(rol?: string | null): boolean {
  return adminStaffHomeRoute(rol) != null
}
