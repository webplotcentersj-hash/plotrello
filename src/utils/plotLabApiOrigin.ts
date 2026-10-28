import { PLOT_LAB_LEGACY_STATIC_HOSTS, PLOT_LAB_SITE_ORIGIN } from '../constants/plotLabSite'

/**
 * Origen de las APIs serverless de PlotLab.
 * En plotcenterlab.com.ar usa mismo origen (ignora VITE_PLOTLAB_API_ORIGIN legacy).
 * En trello.plotcenter.com.ar (solo SPA estático) apunta al dominio principal.
 *
 * LAN / on-prem: si `VITE_PLOTLAB_API_ORIGIN` está seteado y
 * `VITE_PLOTLAB_FORCE_API_ORIGIN=1` (o `VITE_PLOTLAB_LAN=1`), siempre usa ese origen.
 */
export function getPlotLabApiOrigin(): string {
  const envOrigin = String(import.meta.env.VITE_PLOTLAB_API_ORIGIN || '').trim().replace(/\/$/, '')
  const forceEnv =
    String(import.meta.env.VITE_PLOTLAB_FORCE_API_ORIGIN || '').trim() === '1' ||
    String(import.meta.env.VITE_PLOTLAB_LAN || '').trim() === '1' ||
    String(import.meta.env.VITE_PLOTLAB_LAN || '').toLowerCase() === 'true'

  if (forceEnv && envOrigin) return envOrigin

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    const origin = window.location.origin.replace(/\/$/, '')

    // Host privado (10.x / 192.168 / .local): preferir mismo origen o env LAN.
    if (
      /^10\.\d+\.\d+\.\d+$/.test(host) ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.lan')
    ) {
      return envOrigin || origin
    }

    if (
      host.includes('plotcenterlab.com.ar') ||
      host.includes('vercel.app') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return origin
    }

    if (PLOT_LAB_LEGACY_STATIC_HOSTS.has(host)) {
      return PLOT_LAB_SITE_ORIGIN
    }
  }

  if (envOrigin) return envOrigin

  return PLOT_LAB_SITE_ORIGIN
}

/** URL absoluta a un endpoint /api/... */
export function plotLabApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getPlotLabApiOrigin()}${normalized}`
}

/** fetch() hacia la API de PlotLab (Vercel o mismo origen). */
export function plotLabFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(plotLabApiUrl(path), init)
}
