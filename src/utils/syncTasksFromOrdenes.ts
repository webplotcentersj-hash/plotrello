import type { OrdenTrabajo } from '../types/api'
import type { Task, TaskStatus } from '../types/board'
import {
  isOrdenMarcadaEliminada,
  isOrdenVisibleOnTablero,
  isTaskHiddenFromKanban,
  ordenToTask,
  taskFromRealtimeOrdenUpdate
} from './dataMappers'

export type RealtimeOrdenGuard = {
  recentUserMoves: Map<string, { estado: string; timestamp: number }>
  recentUserEdits: Map<string, { status: TaskStatus; timestamp: number }>
  /** OP multi-sector en settle: ignorar realtime de esa OP. */
  settlingNumeroOpNorm?: string | null
  normNumeroOp?: (n: unknown) => string
}

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
        o.fecha_ultimo_movimiento ?? '',
        o.panol_slot ?? '',
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

function shouldSkipRealtimeOrden(orden: OrdenTrabajo, guard: RealtimeOrdenGuard): boolean {
  if (!orden?.id) return true
  const norm = guard.normNumeroOp ?? ((n: unknown) => String(n ?? '').trim().toLowerCase())
  const settling = guard.settlingNumeroOpNorm
  const opNorm = norm(orden.numero_op)
  if (settling && opNorm && opNorm === settling) return true

  const taskId = String(orden.id)
  const recentMove = guard.recentUserMoves.get(taskId)
  const incomingEliminada = isOrdenMarcadaEliminada(orden)
  if (recentMove && !incomingEliminada) {
    const timeSinceMove = Date.now() - recentMove.timestamp
    if (timeSinceMove >= 3000) {
      guard.recentUserMoves.delete(taskId)
    } else if (
      orden.estado != null &&
      String(orden.estado).trim() !== '' &&
      timeSinceMove < 3000 &&
      String(orden.estado) !== String(recentMove.estado)
    ) {
      return true
    }
  }
  return false
}

/** Una OP realtime sin reemplazar referencias de fichas que no cambiaron. */
export function applyOrdenRealtimeToTasks(
  prev: Task[],
  orden: OrdenTrabajo,
  guard: RealtimeOrdenGuard
): Task[] {
  if (shouldSkipRealtimeOrden(orden, guard)) return prev

  const taskId = String(orden.id)
  const idx = prev.findIndex((task) => task.id === taskId)
  const mapped =
    idx >= 0 ? taskFromRealtimeOrdenUpdate(prev[idx], orden) : ordenToTask(orden)

  const recentEdit = guard.recentUserEdits.get(taskId)
  if (recentEdit && idx >= 0) {
    const timeSinceEdit = Date.now() - recentEdit.timestamp
    if (timeSinceEdit < 5000) {
      mapped.status = recentEdit.status
    } else {
      guard.recentUserEdits.delete(taskId)
    }
  }

  const hidden = isTaskHiddenFromKanban(mapped)
  if (idx >= 0) {
    if (hidden) {
      const next = prev.filter((task) => task.id !== taskId)
      return next.length === prev.length ? prev : next
    }
    if (prev[idx] === mapped || taskBoardFieldsEqual(prev[idx], mapped)) return prev
    const next = [...prev]
    next[idx] = mapped
    return next
  }

  if (hidden) return prev
  return [mapped, ...prev]
}

export function applyOrdenRealtimeBatch(
  prev: Task[],
  ordenes: OrdenTrabajo[],
  guard: RealtimeOrdenGuard
): Task[] {
  if (ordenes.length === 0) return prev
  let next = prev
  for (const orden of ordenes) {
    const updated = applyOrdenRealtimeToTasks(next, orden, guard)
    if (updated !== next) next = updated
  }
  return next
}
