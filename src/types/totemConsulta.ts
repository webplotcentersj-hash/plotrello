import type { HistorialMovimiento, OrdenTrabajo } from './api'

export type TotemConsultaOpNavigationState = {
  ordenes: OrdenTrabajo[]
  historial: Record<number, HistorialMovimiento[]>
  searchOp: string
}
