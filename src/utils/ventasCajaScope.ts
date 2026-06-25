/**
 * Criterio compartido entre /ventas y /caja (vista operativa):
 * - Administración y presupuestos: ven todo el equipo.
 * - Mostrador / caja (vendedor con caja propia): solo lo propio.
 */
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
