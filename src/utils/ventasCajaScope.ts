/**
 * Criterio compartido entre /ventas y /caja (vista operativa):
 * - Administración y presupuestos: ven todo el equipo.
 * - Mostrador y caja: cada uno ve y contabiliza solo lo propio (ventas, arqueos, cierres).
 */
export function esUsuarioCajaOperativa(rol: string | undefined | null): boolean {
  return rol === 'mostrador' || rol === 'caja'
}

export function esVistaVentasPropiaVendedor(isAdmin: boolean, isPresupuestos: boolean): boolean {
  return !isAdmin && !isPresupuestos
}

export function idVendedorParaConsulta(
  isAdmin: boolean,
  isPresupuestos: boolean,
  usuarioId: number | undefined
): number | undefined {
  if (isAdmin || isPresupuestos || usuarioId == null) return undefined
  return usuarioId
}

/** Filtro de movimientos / arqueos / cierres en vista operativa (propio usuario). */
export function filtroUsuarioCajaOperativa(
  isAdmin: boolean,
  usuarioId: number | undefined
): { usuarioId: number } | undefined {
  if (isAdmin || usuarioId == null) return undefined
  return { usuarioId }
}
