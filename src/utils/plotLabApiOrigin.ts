import { PLOT_LAB_LEGACY_STATIC_HOSTS, PLOT_LAB_SITE_ORIGIN } from '../constants/plotLabSite'

/**
 * Origen de las APIs serverless de PlotLab.
 * En plotcenterlab.com.ar usa mismo origen (ignora VITE_PLOTLAB_API_ORIGIN legacy).
 * En trello.plotcenter.com.ar (solo SPA estático) apunta al dominio principal.
 */
export function getPlotLabApiOrigin(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    const origin = window.location.origin.replace(/\/$/, '')

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

  const envOrigin = String(import.meta.env.VITE_PLOTLAB_API_ORIGIN || '').trim().replace(/\/$/, '')
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
