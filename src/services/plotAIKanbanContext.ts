import type { Task, ActivityEvent, TeamMember } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'
import { findTaskForActivityEvent, findTeamMemberForActorId } from '../utils/activityTaskResolve'

/**
 * Formatea información detallada del kanban para PlotAI
 * Incluye información precisa y profesional sobre el estado actual del tablero
 */
export function formatKanbanDetailedContext(
  tasks: Task[],
  activity: ActivityEvent[],
  teamMembers: TeamMember[]
): string {
  if (tasks.length === 0) {
    return 'No hay tareas en el kanban actualmente.'
  }

  // Agrupar tareas por estado
  const tasksByStatus: Record<string, Task[]> = {}
  tasks.forEach(task => {
    if (!tasksByStatus[task.status]) {
      tasksByStatus[task.status] = []
    }
    tasksByStatus[task.status].push(task)
  })

  // Información detallada por columna
  const columnDetails = BOARD_COLUMNS.map(column => {
    const columnTasks = tasksByStatus[column.id] || []
    const urgentTasks = columnTasks.filter(t => t.priority === 'alta')
    const atrasadas = columnTasks.filter(t => {
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
      detalles: columnTasks.slice(0, 10).map(t => ({
        op: t.opNumber,
        cliente: t.title,
        prioridad: t.priority,
        operario: teamMembers.find(m => m.id === t.ownerId)?.name || t.ownerId || 'Sin asignar',
        fechaEntrega: t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-AR') : 'Sin fecha',
        sector: t.assignedSector || 'Sin sector',
        progreso: t.progress || 0,
        materiales: t.materials?.length || 0,
        diasEnEstado: t.updatedAt ? Math.floor((Date.now() - new Date(t.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0
      }))
    }
  })

  // Movimientos recientes (últimas 20 actividades)
  const recentMovements = activity.slice(0, 20).map(event => {
    const fromCol = BOARD_COLUMNS.find(col => col.id === event.from)
    const toCol = BOARD_COLUMNS.find(col => col.id === event.to)
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
    .filter(c => c.count > 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Tareas críticas (urgentes + atrasadas)
  const criticalTasks = tasks.filter(t => {
    const isUrgent = t.priority === 'alta'
    const isFinalizado = t.status === 'finalizado-taller' || t.status === 'almacen-entrega'
    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && !isFinalizado
    return isUrgent || isOverdue
  })

  // Construir el contexto detallado
  let context = `
=== ESTADO DETALLADO DEL KANBAN ===

RESUMEN GENERAL:
- Total de OPs en el sistema: ${tasks.length}
- OPs críticas (urgentes o atrasadas): ${criticalTasks.length}
- OPs finalizadas: ${tasks.filter(t => t.status === 'finalizado-taller' || t.status === 'almacen-entrega').length}
- OPs en proceso: ${tasks.filter(t => t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega').length}

`

  // Detalles por columna
  context += `\n=== DETALLE POR COLUMNA DEL KANBAN ===\n\n`
  columnDetails.forEach(({ column, count, urgent, atrasadas, detalles }) => {
    if (count === 0) return
    
    context += `📋 ${column.label.toUpperCase()} (${column.id}):\n`
    context += `   - Total de OPs: ${count}\n`
    if (urgent > 0) context += `   - ⚠️ Urgentes: ${urgent}\n`
    if (atrasadas > 0) context += `   - 🔴 Atrasadas: ${atrasadas}\n`
    context += `   - Descripción: ${column.description}\n\n`
    
    if (detalles.length > 0) {
      context += `   OPs en esta columna:\n`
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
        context += `   ... y ${count - detalles.length} OP(s) más en esta columna\n\n`
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
    criticalTasks.slice(0, 10).forEach((task, idx) => {
      const isUrgent = task.priority === 'alta'
      const isFinalizado = task.status === 'finalizado-taller' || task.status === 'almacen-entrega'
      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isFinalizado
      const operario = teamMembers.find(m => m.id === task.ownerId)?.name || task.ownerId || 'Sin asignar'
      
      context += `${idx + 1}. OP ${task.opNumber} - ${task.title}\n`
      context += `   Estado: ${BOARD_COLUMNS.find(c => c.id === task.status)?.label || task.status}\n`
      if (isUrgent) context += `   ⚠️ PRIORIDAD ALTA\n`
      if (isOverdue) context += `   🔴 ATRASADA (venció ${new Date(task.dueDate!).toLocaleDateString('es-AR')})\n`
      context += `   Operario: ${operario}\n`
      context += `   Sector: ${task.assignedSector || 'Sin sector'}\n`
      context += `\n`
    })
  }

  // Distribución por operario
  const tasksByOperator: Record<string, Task[]> = {}
  tasks.forEach(task => {
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
      const operator = teamMembers.find(m => m.id === operatorId)?.name || operatorId
      const urgent = operatorTasks.filter(t => t.priority === 'alta').length
      context += `👤 ${operator}: ${operatorTasks.length} OPs`
      if (urgent > 0) context += ` (${urgent} urgentes)`
      context += `\n`
    })

  return context
}

