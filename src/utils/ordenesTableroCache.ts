import type { OrdenTrabajo } from '../types/api'
import { isOrdenVisibleOnTablero } from './dataMappers'
import { readOrdenesTableroIdb, writeOrdenesTableroIdb } from './ordenesTableroIdb'

const CACHE_KEY = 'plotrello_ordenes_tablero_v1'
const MAX_AGE_MS = 1000 * 60 * 60 * 2
/** localStorage legacy desactivado (pesado); la fuente offline es IndexedDB. */
const CACHE_DISABLED = true

type Payload = { savedAt: number; rows: OrdenTrabajo[] }

export function readOrdenesTableroCache(): OrdenTrabajo[] | null {
  if (CACHE_DISABLED || typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Payload
    if (!p?.savedAt || !Array.isArray(p.rows) || p.rows.length === 0) return null
    if (Date.now() - p.savedAt > MAX_AGE_MS) return null
    const visible = p.rows.filter((row) => isOrdenVisibleOnTablero(row))
    return visible.length > 0 ? visible : null
  } catch {
    return null
  }
}

/** Lectura async del snapshot IndexedDB (preferir esto offline). */
export async function readOrdenesTableroCacheAsync(): Promise<OrdenTrabajo[] | null> {
  return readOrdenesTableroIdb()
}

export function writeOrdenesTableroCache(rows: OrdenTrabajo[]): void {
  if (typeof window === 'undefined' || rows.length === 0) return
  // Siempre persistir en IDB para hidratar el tablero sin red.
  void writeOrdenesTableroIdb(rows)

  if (CACHE_DISABLED) return
  const visible = rows.filter((row) => isOrdenVisibleOnTablero(row))
  if (visible.length === 0) return

  const persist = () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows: visible }))
    } catch {
      /* quota */
    }
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(persist, { timeout: 3000 })
  } else {
    window.setTimeout(persist, 0)
  }
}

export function patchOrdenInTableroCache(orden: OrdenTrabajo): void {
  if (typeof window === 'undefined' || !orden?.id) return
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const visible = isOrdenVisibleOnTablero(orden)
    let rows: OrdenTrabajo[] = []
    if (raw) {
      const p = JSON.parse(raw) as Payload
      if (Array.isArray(p?.rows)) rows = [...p.rows]
    }
    const idx = rows.findIndex((r) => r.id === orden.id)
    if (visible) {
      if (idx >= 0) rows[idx] = { ...rows[idx], ...orden }
      else rows.unshift(orden)
    } else if (idx >= 0) {
      rows.splice(idx, 1)
    }
    if (rows.length === 0) {
      localStorage.removeItem(CACHE_KEY)
      return
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows }))
  } catch {
    /* quota / parse */
  }
}
