import type { OrdenTrabajo } from '../types/api'

const CACHE_KEY = 'plotrello_ordenes_biblioteca_v1'
const MAX_AGE_MS = 1000 * 60 * 60 * 12

type Payload = { savedAt: number; rows: OrdenTrabajo[] }

export function readOrdenesBibliotecaCache(): OrdenTrabajo[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Payload
    if (!p?.savedAt || !Array.isArray(p.rows) || p.rows.length === 0) return null
    if (Date.now() - p.savedAt > MAX_AGE_MS) return null
    return p.rows
  } catch {
    return null
  }
}

export function writeOrdenesBibliotecaCache(rows: OrdenTrabajo[]): void {
  if (typeof window === 'undefined' || rows.length === 0) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows }))
  } catch {
    /* quota */
  }
}
