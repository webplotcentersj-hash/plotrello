export type OfflineSyncConflict = {
  id: string
  kind: 'tablero_mover'
  ordenId: number
  estadoOrigen?: string
  estadoActual?: string
  nuevoEstado?: string
  createdAt: string
  /** Si true, el move ya se aplicó al servidor pese al conflicto. */
  applied: boolean
}

const KEY = 'plotlab_offline_conflicts_v1'
const LISTENERS = new Set<() => void>()

function scopeKey(): string {
  try {
    const uid = localStorage.getItem('usuario_id') || 'anon'
    return `${KEY}_${uid}`
  } catch {
    return KEY
  }
}

export function listOfflineConflicts(): OfflineSyncConflict[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(scopeKey())
    if (!raw) return []
    const rows = JSON.parse(raw) as OfflineSyncConflict[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function writeAll(rows: OfflineSyncConflict[]): void {
  localStorage.setItem(scopeKey(), JSON.stringify(rows.slice(-20)))
  for (const l of LISTENERS) {
    try {
      l()
    } catch {
      /* ignore */
    }
  }
}

export function pushOfflineConflict(
  c: Omit<OfflineSyncConflict, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): OfflineSyncConflict {
  const row: OfflineSyncConflict = {
    id: c.id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: c.createdAt || new Date().toISOString(),
    kind: c.kind,
    ordenId: c.ordenId,
    estadoOrigen: c.estadoOrigen,
    estadoActual: c.estadoActual,
    nuevoEstado: c.nuevoEstado,
    applied: c.applied
  }
  const prev = listOfflineConflicts().filter(
    (x) => !(x.ordenId === row.ordenId && x.nuevoEstado === row.nuevoEstado)
  )
  writeAll([...prev, row])
  return row
}

export function dismissOfflineConflict(id: string): void {
  writeAll(listOfflineConflicts().filter((c) => c.id !== id))
}

export function clearOfflineConflicts(): void {
  writeAll([])
}

export function subscribeOfflineConflicts(listener: () => void): () => void {
  LISTENERS.add(listener)
  return () => LISTENERS.delete(listener)
}
