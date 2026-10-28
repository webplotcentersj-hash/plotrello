/**
 * Modo de runtime Plot Lab: nube / LAN / offline (parcial).
 * LAN se activa con VITE_PLOTLAB_API_ORIGIN en red privada, o hostname privado.
 */

export type PlotLabRuntimeMode = 'cloud' | 'lan' | 'offline'

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1') return true
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true
  if (h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.internal')) return true
  return false
}

/** true si el build/host sugiere red privada (no internet público). */
export function isPlotLabLanHost(): boolean {
  if (typeof window === 'undefined') return false
  const force = String(import.meta.env.VITE_PLOTLAB_LAN || '').trim()
  if (force === '1' || force.toLowerCase() === 'true') return true
  return isPrivateHostname(window.location.hostname)
}

export function isPlotLabOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export function getPlotLabRuntimeMode(): PlotLabRuntimeMode {
  if (!isPlotLabOnline()) return 'offline'
  if (isPlotLabLanHost()) return 'lan'
  return 'cloud'
}

export function labelPlotLabRuntimeMode(mode: PlotLabRuntimeMode): string {
  switch (mode) {
    case 'offline':
      return 'Sin conexión'
    case 'lan':
      return 'Red privada'
    default:
      return 'Nube'
  }
}
