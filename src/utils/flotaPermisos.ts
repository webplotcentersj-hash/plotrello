/** Coincide con useAuth: quién puede autorizar salidas y administrar cierre de viajes en Flota. */
export function puedeFinalizarViajeFlota(rol: string | undefined | null): boolean {
  if (!rol) return false
  return rol === 'caja' || rol === 'mostrador' || rol === 'administracion' || rol === 'gerencia'
}
