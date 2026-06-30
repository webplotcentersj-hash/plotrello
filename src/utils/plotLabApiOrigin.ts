import { PLOT_LAB_LEGACY_STATIC_HOSTS, PLOT_LAB_SITE_ORIGIN } from '../constants/plotLabSite'

/**
 * Origen de las APIs serverless de PlotLab.
 * Producción: www.plotcenterlab.com.ar (app + /api en Vercel).
 * Legacy: trello.plotcenter.com.ar puede servir solo el SPA; las APIs van al dominio principal.
 */
export function getPlotLabApiOrigin(): string {
  const envOrigin = String(import.meta.env.VITE_PLOTLAB_API_ORIGIN || '').trim().replace(/\/$/, '')
  if (envOrigin) return envOrigin

  if (typeof window === 'undefined') return PLOT_LAB_SITE_ORIGIN

  const host = window.location.hostname.toLowerCase()
  if (PLOT_LAB_LEGACY_STATIC_HOSTS.has(host)) return PLOT_LAB_SITE_ORIGIN

  return window.location.origin
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
