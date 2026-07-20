const STORAGE_KEY = 'plotlab_briefs_vistos_v1'

export function readBriefsVistos(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(
      arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    )
  } catch {
    return new Set()
  }
}

export function persistBriefsVistos(ids: Set<number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-500)))
  } catch {
    /* ignore */
  }
}

export function markBriefVisto(id: number): Set<number> {
  const next = readBriefsVistos()
  if (Number.isFinite(id) && id > 0) {
    next.add(id)
    persistBriefsVistos(next)
  }
  return next
}

export function markBriefsVistos(ids: number[]): Set<number> {
  const next = readBriefsVistos()
  for (const id of ids) {
    if (Number.isFinite(id) && id > 0) next.add(id)
  }
  persistBriefsVistos(next)
  return next
}

export function parseBriefIdFromNotification(n: {
  brief_id?: number | null
  description?: string | null
  title?: string | null
}): number | null {
  if (n.brief_id != null && Number.isFinite(Number(n.brief_id)) && Number(n.brief_id) > 0) {
    return Number(n.brief_id)
  }
  const desc = n.description || ''
  const m = desc.match(/\[brief:#(\d+)\]/i)
  if (m?.[1]) {
    const id = Number(m[1])
    return Number.isFinite(id) && id > 0 ? id : null
  }
  return null
}

export function notificationIsBriefPublico(n: {
  title?: string | null
  brief_id?: number | null
  description?: string | null
}): boolean {
  if (n.brief_id != null && Number(n.brief_id) > 0) return true
  const title = (n.title || '').toLowerCase()
  if (title.includes('brief público') || title.includes('brief publico')) return true
  return Boolean(parseBriefIdFromNotification(n))
}

export function briefsPendientesPath(briefId?: number | null): string {
  if (briefId != null && Number.isFinite(briefId) && briefId > 0) {
    return `/briefs-pendientes?brief=${briefId}`
  }
  return '/briefs-pendientes'
}
