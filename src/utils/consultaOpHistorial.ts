import type { HistorialMovimiento, OrdenTrabajo } from '../types/api'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

/** Reparte movimientos de una query .in(id_orden) por cada ficha, orden cronológico. */
export function historialPorOrdenId(
  movimientos: HistorialMovimiento[],
  ordenIds: number[]
): Record<number, HistorialMovimiento[]> {
  const map: Record<number, HistorialMovimiento[]> = {}
  for (const id of ordenIds) map[id] = []
  for (const m of movimientos) {
    if (map[m.id_orden] !== undefined) map[m.id_orden].push(m)
  }
  const t = (x: HistorialMovimiento) => new Date(x.timestamp).getTime()
  for (const id of ordenIds) {
    map[id].sort((a, b) => t(a) - t(b))
  }
  return map
}

/** Si hay varias fichas con el mismo número OP (solo dígitos), conviene mostrar un timeline único. */
export function historialUnificadoMismoNumeroOp(
  movimientos: HistorialMovimiento[],
  ordenes: OrdenTrabajo[]
): HistorialMovimiento[] | null {
  if (ordenes.length < 2) return null
  const d0 = digitsOnly(ordenes[0]?.numero_op ?? '')
  if (!d0) return null
  const mismo = ordenes.every((o) => digitsOnly(o.numero_op ?? '') === d0)
  if (!mismo) return null
  const t = (x: HistorialMovimiento) => new Date(x.timestamp).getTime()
  return [...movimientos].sort((a, b) => t(a) - t(b))
}
