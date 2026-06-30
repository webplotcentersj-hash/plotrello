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

export const PLOT_LAB_LOGO_URL = `${PLOT_LAB_PRIMARY_ORIGIN}/Group%20187.png`
