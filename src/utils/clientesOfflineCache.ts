import type { ClienteRecord } from '../types/api'
import { clienteCoincideBusqueda } from './clienteDuplicados'
import { plotLabOfflineDbSuffix } from './plotLabOffline'
import { patchOfflineCacheMeta } from './plotLabOfflineMeta'

const STORE = 'by_id'
const DB_VERSION = 1
const MAX_ROWS = 2500

function dbName(): string {
  return `plotlab_clientes_${plotLabOfflineDbSuffix()}_v1`
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
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB clientes'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB request'))
  })
}

/** Upsert resultados de búsqueda para poder filtrar offline. */
export async function mergeClientesOfflineCache(rows: ClienteRecord[]): Promise<void> {
  if (typeof window === 'undefined' || !rows.length) return
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const row of rows) {
        if (!row?.id) continue
        store.put(row)
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error || new Error('IDB tx'))
      })
      patchOfflineCacheMeta({ clientesTouchedAt: Date.now() })

      const count = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).count())
      if (count > MAX_ROWS) {
        const all = (await reqToPromise(
          db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
        )) as ClienteRecord[]
        all.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
        const drop = all.slice(MAX_ROWS)
        const tx2 = db.transaction(STORE, 'readwrite')
        for (const r of drop) tx2.objectStore(STORE).delete(r.id)
        await new Promise<void>((resolve, reject) => {
          tx2.oncomplete = () => resolve()
          tx2.onerror = () => reject(tx2.error || new Error('IDB trim'))
        })
      }
    } finally {
      db.close()
    }
  } catch {
    /* quota / private */
  }
}

export async function buscarClientesOffline(
  query: string,
  limit = 50
): Promise<ClienteRecord[]> {
  if (typeof window === 'undefined') return []
  const q = query.trim()
  if (!q) return []
  try {
    const db = await openDb()
    let rows: ClienteRecord[] = []
    try {
      rows = (await reqToPromise(
        db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      )) as ClienteRecord[]
    } finally {
      db.close()
    }
    return rows
      .filter((c) => c && c.activo !== false && clienteCoincideBusqueda(c, q))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
      .slice(0, Math.min(Math.max(limit, 1), 150))
  } catch {
    return []
  }
}
