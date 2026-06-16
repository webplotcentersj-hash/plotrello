import type { OrdenTrabajo } from '../types/api'
import { broadcastOrdenesChanged } from './ordenesBroadcast'
import { patchOrdenInBibliotecaCache } from './ordenesBibliotecaCache'
import { patchOrdenInTableroCache } from './ordenesTableroCache'
/** Actualiza `tasks` en esta pestaña al instante; avisa otras pestañas vía BroadcastChannel. */
export function notifyOrdenChangedLocally(orden: OrdenTrabajo | null | undefined): void {
  if (!orden?.id) return
  window.dispatchEvent(
    new CustomEvent('plotrello-orden-upsert', { detail: { orden } })
  )
  broadcastOrdenesChanged()
}

/** Tras restart / restaurar visibilidad: sincroniza cachés locales y demás pestañas. */
export function applyOrdenRestartLocally(orden: OrdenTrabajo | null | undefined): void {
  if (!orden?.id || typeof window === 'undefined') return
  patchOrdenInBibliotecaCache(orden)
  patchOrdenInTableroCache(orden)
  notifyOrdenChangedLocally(orden)
}
