import type { Task, ActivityEvent, TeamMember } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'
import { findTaskForActivityEvent, findTeamMemberForActorId } from '../utils/activityTaskResolve'

const pipeSafe = (s: string, max: number) =>
  (s || '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim()
    .slice(0, max)

/** Normaliza token de OP/Ficha para comparar con task.opNumber */
export function normalizeOpTokenForMatch(token: string): string {
  return token
    .replace(/^OP-?/i, '')
    .replace(/^FICHA[\s._-]*/i, '')
    .trim()
    .toLowerCase()
}

/**
 * Extrae posibles números/referencias de OP del texto del usuario (para enfocar contexto).
 */
export function extractOpTokensFromUserMessage(message: string): string[] {
  if (!message?.trim()) return []
  const tokens = new Set<string>()
  const patterns: RegExp[] = [
    /(?:^|[\s,:.¿?¡!('"])\s*(?:OP|N[°º]?\s*(?:de\s+)?OP)\s*[#.:_-]?\s*([A-Za-z0-9][A-Za-z0-9._-]*)/gi,
    /\bFICHA\s*[#.:_-]?\s*([A-Za-z0-9][A-Za-z0-9._-]*)/gi,
    /(?:orden|ficha)\s+(?:n(?:ú|u)mero|num|nro\.?)\s*[#.:_-]?\s*([A-Za-z0-9][A-Za-z0-9._-]*)/gi
  ]
  for (const re of patterns) {
    const r = new RegExp(re.source, re.flags)
    let x: RegExpExecArray | null
    while ((x = r.exec(message)) !== null) {
      const t = (x[1] || '').trim()
      if (t.length >= 1 && t.length <= 40) tokens.add(t)
    }
  }
  return [...tokens]
}

/** Busca tareas cuyo numero_op coincide con los tokens (OP- / FICHA- tolerantes). */
export function findTasksMatchingOpTokens(tasks: Task[], tokens: string[]): Task[] {
  if (!tokens.length) return []
  const normalizedTokens = tokens.map(normalizeOpTokenForMatch).filter(Boolean)
  return tasks.filter((task) => {
    const op = (task.opNumber || '').trim()
    if (!op) return false
    const nOp = normalizeOpTokenForMatch(op)
    const rawLower = op.toLowerCase()
    return normalizedTokens.some((tok) => {
      if (!tok) return false
      return (
        nOp === tok ||
        rawLower === tok ||
        rawLower === `op-${tok}` ||
        rawLower === `op${tok}` ||
        nOp.endsWith(tok) ||
        rawLower.endsWith(tok)
      )
    })
  })
}

function operarioLabel(teamMembers: TeamMember[], ownerId: string): string {
  return findTeamMemberForActorId(teamMembers, ownerId)?.name || ownerId || 'Sin asignar'
}

/** Una línea por OP visible en tablero: fuente de verdad para “buscar OP”. */
export function formatKanbanOpMasterIndex(tasks: Task[], teamMembers: TeamMember[]): string {
  if (tasks.length === 0) return ''
  const sorted = [...tasks].sort((a, b) =>
    String(a.opNumber || '').localeCompare(String(b.opNumber || ''), undefined, { numeric: true })
  )
  const header =
    '=== ÍNDICE COMPLETO DE OPs EN TABLERO (FUENTE DE VERDAD) ===\n' +
    'Cada fila es UNA ficha visible. Para responder sobre una OP puntual: localizá su numero_op en esta lista.\n' +
    'Formato: numero_op | id_orden | cliente | columna_kanban | sector | operario | prioridad | entrega\n\n'
  const lines = sorted.map((t) => {
    const col = BOARD_COLUMNS.find((c) => c.id === t.status)
    const colLabel = col?.label || t.status
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-AR') : 'Sin fecha'
    return `${pipeSafe(t.opNumber, 32)} | ${pipeSafe(t.id, 12)} | ${pipeSafe(t.title, 40)} | ${pipeSafe(
      colLabel,
      28
    )} | ${pipeSafe(t.assignedSector || '', 20)} | ${pipeSafe(operarioLabel(teamMembers, t.ownerId), 22)} | ${t.priority} | ${due}`
  })
  return header + lines.join('\n') + '\n'
}

function formatOpQueryFocusBlock(
  userQuery: string | undefined,
  tasks: Task[],
  teamMembers: TeamMember[]
): string {
  const q = userQuery?.trim()
  if (!q) return ''
  const tokens = extractOpTokensFromUserMessage(q)
  if (!tokens.length) return ''

  const matched = findTasksMatchingOpTokens(tasks, tokens)
  let block =
    '\n=== CONSULTA POR OP / FICHA (detección automática en el mensaje del usuario) ===\n' +
    `Tokens detectados: ${tokens.join(', ')}\n`

  if (matched.length === 0) {
    block +=
      'RESULTADO: Ninguna ficha del tablero actual coincide con ese número/referencia.\n' +
      'DEBÉS decir al usuario que esa OP no figura en las fichas cargadas del tablero (puede estar archivada, ' +
      'oculta por fusión, o el número no coincide). NO inventes cliente, estado, sector ni fechas.\n\n'
    return block
  }

  block += `RESULTADO: ${matched.length} ficha(s) coincidente(s). Usá SOLO estos datos (no completes con suposiciones):\n\n`
  matched.forEach((t, i) => {
    const col = BOARD_COLUMNS.find((c) => c.id === t.status)
    block += `${i + 1}) numero_op: ${t.opNumber} | id_orden: ${t.id}\n`
    block += `   Cliente (campo título): ${t.title}\n`
    block += `   Descripción breve: ${pipeSafe(t.summary || '', 200)}\n`
    block += `   Columna kanban: ${col?.label || t.status} (${t.status})\n`
    block += `   Sector: ${t.assignedSector || '—'}\n`
    block += `   Operario: ${operarioLabel(teamMembers, t.ownerId)}\n`
    block += `   Prioridad: ${t.priority} | Progreso: ${t.progress ?? 0}%\n`
    block += `   Entrega: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-AR') : 'Sin fecha'}\n`
    block += `   Duplicado sector: ${t.esDuplicado ? 'sí' : 'no'}${t.idOrdenOriginal != null ? ` | id_orden_original: ${t.idOrdenOriginal}` : ''}\n\n`
  })
  return block
}

export type KanbanContextOptions = {
  /** Mensaje del usuario: si menciona OP/Ficha, se inyecta bloque de coincidencias exactas */
  userQuery?: string
}

/**
 * Formatea información detallada del kanban para PlotAI
 * Incluye información precisa y profesional sobre el estado actual del tablero
 */
export function formatKanbanDetailedContext(
  tasks: Task[],
  activity: ActivityEvent[],
  teamMembers: TeamMember[],
  options?: KanbanContextOptions
): string {
  if (tasks.length === 0) {
    return 'No hay tareas en el kanban actualmente.'
  }

  const indexBlock = formatKanbanOpMasterIndex(tasks, teamMembers)
  const focusBlock = formatOpQueryFocusBlock(options?.userQuery, tasks, teamMembers)

  // Agrupar tareas por estado
  const tasksByStatus: Record<string, Task[]> = {}
  tasks.forEach((task) => {
    if (!tasksByStatus[task.status]) {
      tasksByStatus[task.status] = []
    }
    tasksByStatus[task.status].push(task)
  })

  // Información detallada por columna (vista ampliada; el índice arriba lista todas las OPs)
  const columnDetails = BOARD_COLUMNS.map((column) => {
    const columnTasks = tasksByStatus[column.id] || []
    const urgentTasks = columnTasks.filter((t) => t.priority === 'alta')
    const atrasadas = columnTasks.filter((t) => {
      if (!t.dueDate) return false
      const dueDate = new Date(t.dueDate)
      const isFinalizado = t.status === 'finalizado-taller' || t.status === 'almacen-entrega'
      return dueDate < new Date() && !isFinalizado
    })

    return {
      column,
      tasks: columnTasks,
      count: columnTasks.length,
      urgent: urgentTasks.length,
      atrasadas: atrasadas.length,
      detalles: columnTasks.slice(0, 25).map((t) => ({
        op: t.opNumber,
        cliente: t.title,
        prioridad: t.priority,
        operario: operarioLabel(teamMembers, t.ownerId),
        fechaEntrega: t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-AR') : 'Sin fecha',
        sector: t.assignedSector || 'Sin sector',
        progreso: t.progress || 0,
        materiales: t.materials?.length || 0,
        diasEnEstado: t.updatedAt
          ? Math.floor((Date.now() - new Date(t.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      }))
    }
  })

  // Movimientos recientes (últimas 20 actividades)
  const recentMovements = activity.slice(0, 20).map((event) => {
    const fromCol = BOARD_COLUMNS.find((col) => col.id === event.from)
    const toCol = BOARD_COLUMNS.find((col) => col.id === event.to)
    const task = findTaskForActivityEvent(tasks, event.taskId)
    const actor = findTeamMemberForActorId(teamMembers, event.actorId)?.name || event.actorId

    return {
      op: task?.opNumber || 'N/A',
      cliente: task?.title || 'N/A',
      desde: fromCol?.label || event.from,
      hacia: toCol?.label || event.to,
      usuario: actor,
      timestamp: new Date(event.timestamp).toLocaleString('es-AR'),
      nota: event.note || ''
    }
  })

  // Análisis de cuellos de botella
  const bottlenecks = columnDetails
    .filter((c) => c.count > 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Tareas críticas (urgentes + atrasadas)
  // PlotAI: excluir Almacén de Entrega de conteos/resúmenes
  const tasksForAI = tasks.filter((t) => t.status !== 'almacen-entrega')

  const criticalTasks = tasksForAI.filter((t) => {
    const isUrgent = t.priority === 'alta'
    const isFinalizado = t.status === 'finalizado-taller'
    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && !isFinalizado
    return isUrgent || isOverdue
  })

  let context = indexBlock + focusBlock

  context += `
=== ESTADO DETALLADO DEL KANBAN ===

REGLA ANTI-ALUCINACIÓN:
- Si el usuario pregunta por una OP y NO aparece en el ÍNDICE COMPLETO ni en CONSULTA POR OP, respondé que no está en el tablero cargado. No inventes datos.
- Los totales del bloque "CONTEXTO COMPLETO DEL SISTEMA" son agregados; para una OP concreta usá solo filas del índice / foco / detalle.

RESUMEN GENERAL:
- Total de OPs en el sistema: ${tasksForAI.length}
- OPs críticas (urgentes o atrasadas): ${criticalTasks.length}
- OPs finalizadas: ${tasksForAI.filter((t) => t.status === 'finalizado-taller').length}
- OPs en proceso: ${tasksForAI.filter((t) => t.status !== 'finalizado-taller').length}

`

  // Detalles por columna
  context += `\n=== DETALLE POR COLUMNA DEL KANBAN ===\n`
  context +=
    '(Las primeras 25 OPs por columna; el listado íntegro está en el ÍNDICE COMPLETO al inicio.)\n\n'
  columnDetails.forEach(({ column, count, urgent, atrasadas, detalles }) => {
    if (count === 0) return

    context += `📋 ${column.label.toUpperCase()} (${column.id}):\n`
    context += `   - Total de OPs: ${count}\n`
    if (urgent > 0) context += `   - ⚠️ Urgentes: ${urgent}\n`
    if (atrasadas > 0) context += `   - 🔴 Atrasadas: ${atrasadas}\n`
    context += `   - Descripción: ${column.description}\n\n`

    if (detalles.length > 0) {
      context += `   OPs en esta columna (muestra):\n`
      detalles.forEach((det, idx) => {
        context += `   ${idx + 1}. OP ${det.op} - ${det.cliente}\n`
        context += `      • Prioridad: ${det.prioridad.toUpperCase()}\n`
        context += `      • Operario asignado: ${det.operario}\n`
        context += `      • Sector: ${det.sector}\n`
        context += `      • Fecha entrega: ${det.fechaEntrega}\n`
        context += `      • Progreso: ${det.progreso}%\n`
        if (det.materiales > 0) context += `      • Materiales: ${det.materiales}\n`
        if (det.diasEnEstado > 0) context += `      • Días en este estado: ${det.diasEnEstado}\n`
        context += `\n`
      })
      if (count > detalles.length) {
        context += `   ... y ${count - detalles.length} OP(s) más en esta columna (ver índice completo)\n\n`
      }
    }
  })

  // Movimientos recientes
  if (recentMovements.length > 0) {
    context += `\n=== MOVIMIENTOS RECIENTES EN EL KANBAN ===\n\n`
    recentMovements.slice(0, 15).forEach((mov, idx) => {
      context += `${idx + 1}. OP ${mov.op} (${mov.cliente})\n`
      context += `   Movimiento: ${mov.desde} → ${mov.hacia}\n`
      context += `   Usuario: ${mov.usuario}\n`
      context += `   Fecha: ${mov.timestamp}\n`
      if (mov.nota) context += `   Nota: ${mov.nota}\n`
      context += `\n`
    })
  }

  // Cuellos de botella
  if (bottlenecks.length > 0) {
    context += `\n=== CUELLOS DE BOTELLA DETECTADOS ===\n\n`
    bottlenecks.forEach(({ column, count }) => {
      context += `⚠️ ${column.label}: ${count} OPs (posible sobrecarga)\n`
    })
    context += `\n`
  }

  // Tareas críticas
  if (criticalTasks.length > 0) {
    context += `\n=== OPs CRÍTICAS (URGENTES O ATRASADAS) ===\n\n`
    criticalTasks.slice(0, 25).forEach((task, idx) => {
      const isUrgent = task.priority === 'alta'
      const isFinalizado = task.status === 'finalizado-taller' || task.status === 'almacen-entrega'
      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isFinalizado
      const operario = operarioLabel(teamMembers, task.ownerId)

      context += `${idx + 1}. OP ${task.opNumber} - ${task.title}\n`
      context += `   Estado: ${BOARD_COLUMNS.find((c) => c.id === task.status)?.label || task.status}\n`
      if (isUrgent) context += `   ⚠️ PRIORIDAD ALTA\n`
      if (isOverdue) context += `   🔴 ATRASADA (venció ${new Date(task.dueDate!).toLocaleDateString('es-AR')})\n`
      context += `   Operario: ${operario}\n`
      context += `   Sector: ${task.assignedSector || 'Sin sector'}\n`
      context += `\n`
    })
    if (criticalTasks.length > 25) {
      context += `... y ${criticalTasks.length - 25} OP(s) críticas más (ver índice completo)\n\n`
    }
  }

  // Distribución por operario
  const tasksByOperator: Record<string, Task[]> = {}
  tasksForAI.forEach((task) => {
    const operator = task.ownerId || 'Sin asignar'
    if (!tasksByOperator[operator]) {
      tasksByOperator[operator] = []
    }
    tasksByOperator[operator].push(task)
  })

  context += `\n=== DISTRIBUCIÓN DE TRABAJO POR OPERARIO ===\n\n`
  Object.entries(tasksByOperator)
    .sort(([, a], [, b]) => b.length - a.length)
    .forEach(([operatorId, operatorTasks]) => {
      const operator = findTeamMemberForActorId(teamMembers, operatorId)?.name || operatorId
      const urgent = operatorTasks.filter((t) => t.priority === 'alta').length
      context += `👤 ${operator}: ${operatorTasks.length} OPs`
      if (urgent > 0) context += ` (${urgent} urgentes)`
      context += `\n`
    })

  return context
}
