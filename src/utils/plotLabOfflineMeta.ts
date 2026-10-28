/** Metadatos visibles de caché offline (edad / límites). */

const META_KEY = 'plotlab_offline_meta_v1'

export type OfflineCacheMeta = {
  tableroSavedAt?: number
  articulosSavedAt?: number
  stockSavedAt?: number
  clientesTouchedAt?: number
  lastFlushAt?: number
  lastFlushOk?: number
  lastConflictAt?: number
}

function scopeKey(): string {
  try {
    const uid = localStorage.getItem('usuario_id') || 'anon'
    return `${META_KEY}_${uid}`
  } catch {
    return META_KEY
  }
}

export function readOfflineCacheMeta(): OfflineCacheMeta {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(scopeKey())
    if (!raw) return {}
    return JSON.parse(raw) as OfflineCacheMeta
  } catch {
    return {}
  }
}

export function patchOfflineCacheMeta(patch: Partial<OfflineCacheMeta>): void {
  if (typeof localStorage === 'undefined') return
  try {
    const next = { ...readOfflineCacheMeta(), ...patch }
    localStorage.setItem(scopeKey(), JSON.stringify(next))
  } catch {
    /* quota */
  }
}

export function clearOfflineCacheMeta(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(scopeKey())
  } catch {
    /* ignore */
  }
}

export function formatCacheAge(savedAt: number | undefined, now = Date.now()): string | null {
  if (!savedAt) return null
  const mins = Math.max(0, Math.round((now - savedAt) / 60000))
  if (mins < 1) return 'hace instantes'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.round(mins / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}
