import type { OrdenTrabajo } from '../types/api'
import { broadcastOrdenesChanged } from './ordenesBroadcast'

/** Actualiza `tasks` en esta pestaña al instante; avisa otras pestañas vía BroadcastChannel. */
export function notifyOrdenChangedLocally(orden: OrdenTrabajo | null | undefined): void {
  if (!orden?.id) return
  window.dispatchEvent(
    new CustomEvent('plotrello-orden-upsert', { detail: { orden } })
  )
  broadcastOrdenesChanged()
}
