import type { OrdenTrabajo } from '../types/api'
import { isOrdenVisibleOnTablero } from './dataMappers'

const DB_NAME = 'plotlab_tablero_v1'
const STORE = 'ordenes'
const KEY = 'snapshot'
const DB_VERSION = 1
/** Máx. filas a persistir (las más recientes por id). */
const MAX_ROWS = 800

type Snapshot = { savedAt: number; rows: OrdenTrabajo[] }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
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
  const sorted = [...visible].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, MAX_ROWS)
  const snap: Snapshot = { savedAt: Date.now(), rows: sorted }
  try {
    const db = await openDb()
    try {
      await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(snap, KEY))
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
