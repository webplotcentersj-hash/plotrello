import type { OrdenTrabajo } from '../types/api'
import { isOrdenVisibleOnTablero } from './dataMappers'

const CACHE_KEY = 'plotrello_ordenes_tablero_v1'
const MAX_AGE_MS = 1000 * 60 * 60 * 12

type Payload = { savedAt: number; rows: OrdenTrabajo[] }

export function readOrdenesTableroCache(): OrdenTrabajo[] | null {
  if (typeof window === 'undefined') return null
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

export function writeOrdenesTableroCache(rows: OrdenTrabajo[]): void {
  if (typeof window === 'undefined' || rows.length === 0) return
  const visible = rows.filter((row) => isOrdenVisibleOnTablero(row))
  if (visible.length === 0) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows: visible }))
  } catch {
    /* quota */
  }
}
