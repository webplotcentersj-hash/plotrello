import type { ArticuloEmpresaRecord } from '../types/api'
import { plotLabOfflineDbSuffix } from './plotLabOffline'
import { patchOfflineCacheMeta } from './plotLabOfflineMeta'

const STORE = 'snap'
const KEY = 'catalogo'
const DB_VERSION = 1
const MAX_ROWS = 4000

type Snapshot = { savedAt: number; rows: ArticuloEmpresaRecord[] }

function dbName(): string {
  return `plotlab_articulos_${plotLabOfflineDbSuffix()}_v1`
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
    req.onerror = () => reject(req.error || new Error('IDB articulos'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB request'))
  })
}

export async function writeArticulosEmpresaOfflineCache(
  rows: ArticuloEmpresaRecord[]
): Promise<void> {
  if (typeof window === 'undefined' || !rows.length) return
  const trimmed = rows.slice(0, MAX_ROWS)
  const savedAt = Date.now()
  const snap: Snapshot = { savedAt, rows: trimmed }
  try {
    const db = await openDb()
    try {
      await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(snap, KEY))
      patchOfflineCacheMeta({ articulosSavedAt: savedAt })
    } finally {
      db.close()
    }
  } catch {
    /* quota */
  }
}

export async function readArticulosEmpresaOfflineCache(
  maxAgeMs = 1000 * 60 * 60 * 24 * 7
): Promise<ArticuloEmpresaRecord[] | null> {
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
    if (!snap?.savedAt || !Array.isArray(snap.rows) || !snap.rows.length) return null
    if (Date.now() - snap.savedAt > maxAgeMs) return null
    return snap.rows
  } catch {
    return null
  }
}
