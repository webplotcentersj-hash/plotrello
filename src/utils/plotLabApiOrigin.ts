/**
 * Origen de las APIs serverless de PlotLab.
 * Hostinger (trello.plotcenter.com.ar) sirve solo el SPA estático;
 * las rutas /api/* viven en Vercel (plotrello.vercel.app).
 */
const VERCEL_API_ORIGIN = 'https://plotrello.vercel.app'

const STATIC_HOSTS = new Set(['trello.plotcenter.com.ar', 'www.trello.plotcenter.com.ar'])

export function getPlotLabApiOrigin(): string {
  const envOrigin = String(import.meta.env.VITE_PLOTLAB_API_ORIGIN || '').trim().replace(/\/$/, '')
  if (envOrigin) return envOrigin

  if (typeof window === 'undefined') return VERCEL_API_ORIGIN

  const host = window.location.hostname.toLowerCase()
  if (STATIC_HOSTS.has(host)) return VERCEL_API_ORIGIN

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
