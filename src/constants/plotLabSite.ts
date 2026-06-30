/** Dominio público principal de Plot Lab. */
export const PLOT_LAB_SITE_ORIGIN = 'https://www.plotcenterlab.com.ar'

export const PLOT_LAB_LOGO_URL = `${PLOT_LAB_SITE_ORIGIN}/Group%20187.png`

/** Hosts legacy que sirven solo el SPA estático; las APIs apuntan al dominio principal. */
export const PLOT_LAB_LEGACY_STATIC_HOSTS = new Set([
  'trello.plotcenter.com.ar',
  'www.trello.plotcenter.com.ar'
])

export function isPlotLabAppHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'localhost' ||
    host.includes('vercel.app') ||
    host.includes('plotcenterlab.com.ar') ||
    host.includes('plotcenter.com.ar')
  )
}
