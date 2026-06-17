const DEFAULT_ORIGIN = 'https://trello.plotcenter.com.ar'

export function plotLabOrigin(): string {
  const raw = import.meta.env.VITE_PLOTLAB_ORIGIN?.trim()
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : DEFAULT_ORIGIN
}

export function plotLabPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${plotLabOrigin()}${normalized}`
}
