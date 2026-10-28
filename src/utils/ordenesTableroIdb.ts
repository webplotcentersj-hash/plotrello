import type { OrdenTrabajo } from '../types/api'
import { isOrdenVisibleOnTablero } from './dataMappers'
import { plotLabOfflineDbSuffix } from './plotLabOffline'
import { patchOfflineCacheMeta } from './plotLabOfflineMeta'

const STORE = 'ordenes'
const KEY = 'snapshot'
const DB_VERSION = 1
/** Máx. filas a persistir (las más recientes por id). */
export const TABLERO_CACHE_MAX_ROWS = 800

type Snapshot = { savedAt: number; rows: OrdenTrabajo[] }

function dbName(): string {
  return `plotlab_tablero_${plotLabOfflineDbSuffix()}_v1`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const req = indexedDB.open(dbName(), DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB tablero'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB request'))
  })
}

export async function writeOrdenesTableroIdb(rows: OrdenTrabajo[]): Promise<void> {
  if (typeof window === 'undefined' || !rows.length) return
  const visible = rows.filter((row) => isOrdenVisibleOnTablero(row))
  if (!visible.length) return
  const sorted = [...visible]
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    .slice(0, TABLERO_CACHE_MAX_ROWS)
  const savedAt = Date.now()
  const snap: Snapshot = { savedAt, rows: sorted }
  try {
    const db = await openDb()
    try {
      await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(snap, KEY))
      patchOfflineCacheMeta({ tableroSavedAt: savedAt })
    } finally {
      db.close()
    }
  } catch {
    /* quota / private mode */
  }
}

export async function readOrdenesTableroIdb(maxAgeMs = 1000 * 60 * 60 * 24): Promise<OrdenTrabajo[] | null> {
  if (typeof window === 'undefined') return null
  try {
    const db = await openDb()
    let snap: Snapshot | undefined
    try {
      snap = (await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY))) as
        | Snapshot
        | undefined
    } finally {
      db.close()
    }
    if (!snap?.savedAt || !Array.isArray(snap.rows) || snap.rows.length === 0) return null
    if (Date.now() - snap.savedAt > maxAgeMs) return null
    const visible = snap.rows.filter((row) => isOrdenVisibleOnTablero(row))
    return visible.length ? visible : null
  } catch {
    return null
  }
}

/** Actualiza estado de una OP en el snapshot (movimientos offline que deben sobrevivir un F5). */
export async function patchOrdenEstadoInTableroIdb(
  ordenId: number,
  nuevoEstado: string
): Promise<void> {
  if (typeof window === 'undefined' || !ordenId) return
  try {
    const db = await openDb()
    try {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
      const snap = (await reqToPromise(store.get(KEY))) as Snapshot | undefined
      if (!snap?.rows?.length) return
      let changed = false
      const rows = snap.rows.map((row) => {
        if (row.id !== ordenId) return row
        changed = true
        return { ...row, estado: nuevoEstado, updated_at: new Date().toISOString() }
      })
      if (!changed) return
      await reqToPromise(
        store.put({ savedAt: Date.now(), rows: rows.filter((r) => isOrdenVisibleOnTablero(r)) }, KEY)
      )
    } finally {
      db.close()
    }
  } catch {
    /* ignore */
  }
}
