/** Rutas que necesitan órdenes del tablero, realtime y cache local. */
export function routeNeedsBoardSync(pathname: string): boolean {
  if (pathname === '/' || pathname === '/tablero') return true
  if (pathname.startsWith('/statistics')) return true
  if (pathname.startsWith('/calendario')) return true
  if (pathname.startsWith('/gantt')) return true
  if (pathname.startsWith('/asesor-presupuestos')) return true
  if (pathname.startsWith('/kanban-etapas/')) return true
  if (pathname.startsWith('/app-campo')) return true
  if (pathname.startsWith('/op/')) return true
  if (pathname === '/admin') return true
  if (pathname.startsWith('/chat')) return true
  if (pathname.startsWith('/taller-grafico/dashboard')) return true
  return false
}
