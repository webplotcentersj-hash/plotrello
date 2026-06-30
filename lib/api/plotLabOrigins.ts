/** Dominio principal de Plot Lab en producción (Vercel). */
export const PLOT_LAB_PRIMARY_ORIGIN = 'https://www.plotcenterlab.com.ar'

export const PLOT_LAB_ORIGINS = [
  PLOT_LAB_PRIMARY_ORIGIN,
  'https://plotcenterlab.com.ar',
  'https://plotrello.vercel.app',
  'https://trello.plotcenter.com.ar',
  'https://www.trello.plotcenter.com.ar',
  'https://plotcenter.com.ar',
  'https://www.plotcenter.com.ar',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
] as const

export const PLOT_LAB_ORIGINS_CSV = PLOT_LAB_ORIGINS.join(',')

export const PLOT_LAB_LOGO_URL = '/plot-lab-logo.png'

/**
 * Orígenes CORS permitidos: defaults del código + extras en PLOT_LAB_ALLOWED_ORIGINS (Vercel).
 * Así un valor legacy en Vercel no bloquea plotcenterlab.com.ar.
 */
export function getPlotLabAllowedOrigins(): string[] {
  const extra = (process.env.PLOT_LAB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set<string>([...PLOT_LAB_ORIGINS, ...extra])]
}

export function getPlotLabAllowedOriginsCsv(): string {
  return getPlotLabAllowedOrigins().join(',')
}
