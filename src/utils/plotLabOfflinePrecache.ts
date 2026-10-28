import { isPlotLabOfflinePartialEnabled } from './plotLabOffline'

/** Precarga idle de lecturas críticas (clientes recientes no; catálogo + stock). */
export function schedulePlotLabOfflinePrecache(): () => void {
  if (typeof window === 'undefined' || !isPlotLabOfflinePartialEnabled()) {
    return () => undefined
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return () => undefined
  }

  let cancelled = false
  const run = () => {
    if (cancelled) return
    void (async () => {
      try {
        const { getApiService } = await import('../services/apiLoader')
        const api = await getApiService()
        // getArticulosEmpresa / getArticulosStock ya escriben caché IDB al OK.
        await Promise.allSettled([
          api.getArticulosEmpresa(undefined, false),
          api.getArticulosStock(),
          api.getConfiguracionPreciosVentas()
        ])
      } catch {
        /* silent */
      }
    })()
  }

  const ric =
    typeof requestIdleCallback === 'function' ? requestIdleCallback(run, { timeout: 12000 }) : null
  const tid = ric == null ? window.setTimeout(run, 4500) : null

  return () => {
    cancelled = true
    if (ric != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(ric as number)
    if (tid != null) window.clearTimeout(tid)
  }
}
