import type { ConfigAjustesPreciosVentas } from '../constants/ventasListasPrecio'

const KEY = 'plotlab_precios_config_v1'
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14

type Payload = { savedAt: number; config: ConfigAjustesPreciosVentas }

export function writePreciosConfigOfflineCache(config: ConfigAjustesPreciosVentas): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), config } satisfies Payload))
  } catch {
    /* quota */
  }
}

export function readPreciosConfigOfflineCache(): ConfigAjustesPreciosVentas | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Payload
    if (!p?.savedAt || !p.config || Date.now() - p.savedAt > MAX_AGE_MS) return null
    return p.config
  } catch {
    return null
  }
}
