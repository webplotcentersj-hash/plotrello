import type { OrdenTrabajo } from '../types/api'
import type { Task } from '../types/board'
import {
  isOrdenVisibleOnTablero,
  isTaskHiddenFromKanban,
  ordenToTask,
  taskFromRealtimeOrdenUpdate
} from './dataMappers'

function taskBoardFieldsEqual(a: Task, b: Task): boolean {
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.updatedAt === b.updatedAt &&
    a.title === b.title &&
    a.opNumber === b.opNumber &&
    a.entregado === b.entregado &&
    a.assignedSector === b.assignedSector &&
    a.priority === b.priority &&
    a.ownerId === b.ownerId &&
    a.enReclamo === b.enReclamo &&
    a.ordenEliminada === b.ordenEliminada &&
    a.visibleEnTablero === b.visibleEnTablero
  )
}

/** Huella liviana para detectar si el listado del tablero cambió (evita mapear 400+ órdenes en vano). */
export function ordenesTableroFingerprint(ordenes: OrdenTrabajo[]): string {
  const parts: string[] = []
  for (const o of ordenes) {
    if (!isOrdenVisibleOnTablero(o)) continue
    parts.push(
      [
        o.id,
        o.fecha_ingreso ?? '',
        o.estado ?? '',
        o.entregado ? 1 : 0,
        o.sector ?? '',
        o.prioridad ?? '',
        o.operario_asignado ?? '',
        o.en_reclamo ? 1 : 0
      ].join('|')
    )
  }
  parts.sort((a, b) => Number(b.split('|')[0]) - Number(a.split('|')[0]))
  return parts.join(';')
}

/**
 * Sincroniza `tasks` tras un refetch silencioso sin reemplazar referencias de fichas iguales
 * (React.memo en TaskCard deja de repintar todo el tablero).
 */
export function syncTasksFromOrdenesFetch(prev: Task[], ordenes: OrdenTrabajo[]): Task[] {
  const visible = ordenes.filter((o) => o.id != null && isOrdenVisibleOnTablero(o))
  const sorted = [...visible].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))

  const prevById = new Map<string, Task>()
  for (const t of prev) prevById.set(t.id, t)

  const next: Task[] = []
  let changed = false

  for (const orden of sorted) {
    const id = String(orden.id)
    const prevTask = prevById.get(id)
    const mapped = prevTask ? taskFromRealtimeOrdenUpdate(prevTask, orden) : ordenToTask(orden)
    if (isTaskHiddenFromKanban(mapped)) continue

    if (prevTask && taskBoardFieldsEqual(prevTask, mapped)) {
      next.push(prevTask)
    } else {
      changed = true
      next.push(mapped)
    }
  }

  const prevKanban = prev.filter((t) => !isTaskHiddenFromKanban(t))
  if (prevKanban.length !== next.length) changed = true
  if (!changed) {
    for (let i = 0; i < next.length; i++) {
      if (next[i] !== prevKanban[i]) {
        changed = true
        break
      }
    }
  }

  return changed ? next : prev
}
