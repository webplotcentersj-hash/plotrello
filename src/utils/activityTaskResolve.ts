import type { Task, TeamMember } from '../types/board'

/**
 * Resuelve la tarea del tablero asociada a un evento de actividad.
 * - `taskId` suele ser el id numérico de la orden (string).
 * - Tras fusión, eventos locales pueden usar prefijo `task-` (hook legacy).
 * - Si la ficha duplicada ya no está en `tasks`, intenta coincidir por id numérico
 *   o por vínculo de duplicado (`idOrdenOriginal`).
 */
export function findTaskForActivityEvent(tasks: Task[], eventTaskId: string): Task | undefined {
  if (!eventTaskId) return undefined

  const direct = tasks.find((t) => t.id === eventTaskId)
  if (direct) return direct

  const stripped = eventTaskId.replace(/^task-/i, '').trim()
  const idNum = Number.parseInt(stripped, 10)
  if (Number.isNaN(idNum)) return undefined

  const byNumericId = tasks.find((t) => Number.parseInt(String(t.id), 10) === idNum)
  if (byNumericId) return byNumericId

  // Duplicado visible: el historial apunta al id de esa fila
  const duplicateRow = tasks.find(
    (t) => t.esDuplicado && Number.parseInt(String(t.id), 10) === idNum
  )
  if (duplicateRow) return duplicateRow

  // Ficha principal cuando el evento referencia el id "original" del grupo
  const byOriginalLink = tasks.find((t) => t.idOrdenOriginal === idNum)
  if (byOriginalLink) return byOriginalLink

  return undefined
}

export function findTeamMemberForActorId(
  teamMembers: TeamMember[],
  actorId: string
): TeamMember | undefined {
  if (!actorId) return undefined
  let m = teamMembers.find((x) => x.id === actorId)
  if (m) return m
  const withoutPrefix = actorId.replace(/^user-/i, '')
  m = teamMembers.find((x) => x.id === withoutPrefix)
  if (m) return m
  return teamMembers.find((x) => x.id === `user-${actorId}`)
}
