/** Igual que en BoardPage/TaskEditModal: comparar operario_asignado (id o nombre) con el usuario de sesión. */
export function normalizePersonNameKey(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const atIndex = trimmed.indexOf('@')
  const base = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed
  return base.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function matchesOperarioAsignado(
  usuario: { id: number; nombre: string; nombreVisible?: string } | null | undefined,
  operarioAsignado: string | null | undefined
): boolean {
  if (!usuario) return false
  const raw = (operarioAsignado ?? '').trim()
  if (!raw || raw === 'sin-asignar') return false
  const myIdStr = String(usuario.id)
  if (myIdStr && raw === myIdStr) return true
  const me = normalizePersonNameKey(usuario.nombreVisible ?? usuario.nombre)
  if (me && normalizePersonNameKey(raw) === me) return true
  return false
}
