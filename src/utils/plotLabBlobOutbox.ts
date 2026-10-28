/**
 * Outbox de blobs (firma entrega / foto reloj) para subir al volver la red.
 * Guarda dataURL o blob serializado en IndexedDB.
 */

import { plotLabOfflineDbSuffix } from './plotLabOffline'

export type BlobOutboxKind = 'entrega_firma' | 'reloj_foto'

export type BlobOutboxItem = {
  id: string
  kind: BlobOutboxKind
  createdAt: string
  /** data URL (firma) o referencia */
  dataUrl: string
  meta: Record<string, unknown>
  attempts: number
  lastError?: string
}

const STORE = 'blobs'
const DB_VERSION = 1

function dbName(): string {
  return `plotlab_blob_outbox_${plotLabOfflineDbSuffix()}_v1`
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
    req.onerror = () => reject(req.error || new Error('IDB blob outbox'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB request'))
  })
}

export async function blobOutboxEnqueue(
  kind: BlobOutboxKind,
  dataUrl: string,
  meta: Record<string, unknown> = {}
): Promise<BlobOutboxItem> {
  const item: BlobOutboxItem = {
    id: `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    createdAt: new Date().toISOString(),
    dataUrl,
    meta,
    attempts: 0
  }
  const db = await openDb()
  try {
    await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).add(item))
  } finally {
    db.close()
  }
  return item
}

export async function blobOutboxList(): Promise<BlobOutboxItem[]> {
  const db = await openDb()
  try {
    const rows = (await reqToPromise(
      db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    )) as BlobOutboxItem[]
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } finally {
    db.close()
  }
}

export async function blobOutboxCount(): Promise<number> {
  const db = await openDb()
  try {
    return await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).count())
  } finally {
    db.close()
  }
}

export async function blobOutboxRemove(id: string): Promise<void> {
  const db = await openDb()
  try {
    await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  } finally {
    db.close()
  }
}

/** Limpia el store del usuario actual (logout). */
export async function blobOutboxClearAll(): Promise<void> {
  const db = await openDb()
  try {
    await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).clear())
  } finally {
    db.close()
  }
}
