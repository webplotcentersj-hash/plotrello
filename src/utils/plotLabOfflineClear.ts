import { clearOfflineCacheMeta } from './plotLabOfflineMeta'
import { clearOfflineConflicts } from './plotLabOfflineConflicts'
import { blobOutboxClearAll } from './plotLabBlobOutbox'
import { plotLabOfflineDbSuffix } from './plotLabOffline'

/** Borra DBs IndexedDB conocidas del usuario (logout / cambio de sesión). */
export async function clearPlotLabOfflineForCurrentUser(): Promise<void> {
  const suffix = plotLabOfflineDbSuffix()
  const names = [
    `plotlab_tablero_${suffix}_v1`,
    `plotlab_sync_${suffix}_v1`,
    `plotlab_clientes_${suffix}_v1`,
    `plotlab_articulos_${suffix}_v1`,
    `plotlab_stock_${suffix}_v1`,
    `plotlab_blob_outbox_${suffix}_v1`,
    // legacy sin sufijo (migración)
    'plotlab_tablero_v1',
    'plotlab_sync_v1',
    'plotlab_clientes_v1',
    'plotlab_articulos_v1',
    'plotlab_stock_v1'
  ]

  clearOfflineCacheMeta()
  clearOfflineConflicts()
  try {
    await blobOutboxClearAll()
  } catch {
    /* ignore */
  }

  for (const name of names) {
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(name)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      })
    } catch {
      /* ignore */
    }
  }
}
