import type { ArticuloStock } from '../types/pedidos'

const DB_NAME = 'plotlab_stock_v1'
const STORE = 'snap'
const KEY = 'articulos'
const DB_VERSION = 1
const MAX_ROWS = 5000

type Snapshot = { savedAt: number; rows: ArticuloStock[] }

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
    req.onerror = () => reject(req.error || new Error('IDB stock'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB request'))
  })
}

export async function writeStockArticulosOfflineCache(rows: ArticuloStock[]): Promise<void> {
  if (typeof window === 'undefined' || !rows.length) return
  const snap: Snapshot = { savedAt: Date.now(), rows: rows.slice(0, MAX_ROWS) }
  try {
    const db = await openDb()
    try {
      await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(snap, KEY))
    } finally {
      db.close()
    }
  } catch {
    /* quota */
  }
}

export async function readStockArticulosOfflineCache(
  maxAgeMs = 1000 * 60 * 60 * 24 * 3
): Promise<ArticuloStock[] | null> {
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

export function filterStockArticulosOffline(
  rows: ArticuloStock[],
  opts: { search?: string; stockBajo?: boolean; sector?: string }
): ArticuloStock[] {
  let out = rows.filter((a) => a.activo !== false)
  const sector = opts.sector
  if (sector && sector !== 'Todos') {
    if (sector === 'Gral') {
      out = out.filter((a) => !a.sector || a.sector === 'Gral')
    } else {
      out = out.filter((a) => a.sector === sector)
    }
  }
  const search = opts.search?.trim()
  if (search && search.length >= 2) {
    const q = search.toLowerCase()
    out = out.filter(
      (a) =>
        (a.descripcion || '').toLowerCase().includes(q) ||
        (a.codigo || '').toLowerCase().includes(q)
    )
  }
  if (opts.stockBajo) {
    out = out.filter((art) => {
      const stock = art.stock != null ? Number(art.stock) : 0
      const stockMinimo = art.stock_minimo != null ? Number(art.stock_minimo) : 10
      return stock === 0 || stock <= stockMinimo
    })
  }
  return out
}
