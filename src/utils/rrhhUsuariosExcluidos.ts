/**
 * Cuentas de sistema / áreas genéricas: no son operarios humanos y no deben
 * recibir asistencia, tardanzas ni novedades de RRHH.
 */
const LOGINS_GENERICOS_RRHH = new Set([
  'admin',
  'administracion',
  'administracion@plotcenter.com.ar',
  'ale',
  'caja',
  'caja@plotcenter.com.ar',
  'instalaciones',
  'instalaciones@plotcenter.com.ar',
  'plotai',
  'plotai@plotcenter.com.ar',
  'rrhh'
])

export function normalizarLoginUsuario(nombre: string): string {
  return String(nombre ?? '').trim().toLowerCase()
}

/** true si el login/email corresponde a una cuenta genérica (no operario). */
export function esUsuarioGenericoRrhh(nombreOrEmail: string): boolean {
  const raw = normalizarLoginUsuario(nombreOrEmail)
  if (!raw) return false
  if (LOGINS_GENERICOS_RRHH.has(raw)) return true
  const local = raw.includes('@') ? raw.split('@')[0]! : raw
  return LOGINS_GENERICOS_RRHH.has(local)
}

export function esUsuarioRrhhExcluido(usuario: {
  nombre: string
  email?: string | null
}): boolean {
  if (esUsuarioGenericoRrhh(usuario.nombre)) return true
  if (usuario.email && esUsuarioGenericoRrhh(usuario.email)) return true
  return false
}

export function filtrarUsuariosRrhhOperarios<T extends { nombre: string; email?: string | null }>(
  usuarios: T[]
): T[] {
  return usuarios.filter((u) => !esUsuarioRrhhExcluido(u))
}

export function idsUsuariosGenericosRrhh(
  usuarios: Array<{ id: number; nombre: string; email?: string | null }>
): Set<number> {
  const ids = new Set<number>()
  for (const u of usuarios) {
    if (esUsuarioRrhhExcluido(u)) ids.add(u.id)
  }
  return ids
}
