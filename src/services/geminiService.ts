import type { Task, TeamMember } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'

export interface SprintAnalysisData {
  tasks: Task[]
  teamMembers: TeamMember[]
  workloadByPerson: Array<{
    member: TeamMember
    taskCount: number
    highPriorityCount: number
    totalStoryPoints: number
    avgProgress: number
    workload: number
  }>
  bottlenecksByColumn: Array<{
    column: { id: string; label: string }
    taskCount: number
    avgDays: number
    isBottleneck: boolean
  }>
  blockedTasks: Task[]
  suggestions: Array<{
    type: 'reassign' | 'move' | 'priority'
    taskId: string
    taskTitle: string
    currentValue: string
    suggestedValue: string
    reason: string
    impact: 'high' | 'medium' | 'low'
  }>
}

export async function generateSprintReport(analysisData: SprintAnalysisData): Promise<string> {
  // En producción, generamos el informe desde el servidor (Vercel /api) para no exponer API keys en el navegador.
  // Nota: en dev con `vite`, las rutas `/api/*` no existen y devuelve 404 (ahí hacemos fallback al modo cliente).
  try {
    const resp = await fetch('/api/plotai/sprint-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisData: {
          ...analysisData,
          columns: BOARD_COLUMNS
        }
      })
    })

    if (resp.status !== 404) {
      const json = (await resp.json().catch(() => ({}))) as { report?: string; error?: string }
      if (!resp.ok) throw new Error(json.error || 'Error al generar el informe con IA.')
      const report = (json.report || '').trim()
      if (!report) throw new Error('La IA no devolvió contenido para el informe.')
      return report
    }
  } catch {
    // continue to fallback below
  }

  const { callGeminiGenerateContent } = await import('./geminiApiClient')

  // Fallback local (vite sin vercel dev): mismo prompt vía servidor o dev key.
  const workloadSummary = analysisData.workloadByPerson
    .map(
      (w) =>
        `- ${w.member.name}: ${w.taskCount} tareas, ${w.highPriorityCount} alta prioridad, ${Math.round(w.avgProgress)}% progreso promedio, carga: ${Math.round(w.workload)} pts`
    )
    .join('\n')

  const bottlenecks = analysisData.bottlenecksByColumn
    .filter((b) => b.isBottleneck)
    .map((b) => `- ${b.column.label}: ${b.taskCount} tareas, ${b.avgDays.toFixed(1)} días promedio`)
    .join('\n')

  const blockedTasksInfo = analysisData.blockedTasks
    .map((t) => `- ${t.title} (OP: ${t.opNumber}): bloqueada desde ${new Date(t.updatedAt).toLocaleDateString('es-AR')}`)
    .join('\n')

  const suggestionsSummary = analysisData.suggestions.map((s, i) => `${i + 1}. ${s.type}: ${s.taskTitle} - ${s.reason}`).join('\n')

  const totalTasks = analysisData.tasks.length
  const completedTasks = analysisData.tasks.filter((t) => t.status === 'almacen-entrega').length
  const inProgressTasks = analysisData.tasks.filter((t) => !['diseno-grafico', 'almacen-entrega'].includes(t.status)).length

  const prompt = `Eres un experto en gestión de proyectos y análisis de sprints. Analiza los siguientes datos de un sprint de producción gráfica e imprenta y genera un informe detallado y profesional en español.

REGLA CLAVE DEL FLUJO (muy importante):
- Cuando un usuario mueve una tarea a otra columna, se considera que FINALIZÓ su trabajo en la etapa/columna anterior (aunque la OP continúe en otra etapa).

CONTEXTO DEL SPRINT:
- Total de tareas: ${totalTasks}
- Tareas completadas: ${completedTasks}
- Tareas en progreso: ${inProgressTasks}
- Miembros del equipo: ${analysisData.teamMembers.length}

CARGA DE TRABAJO POR PERSONA:
${workloadSummary}

CUELLOS DE BOTELLA DETECTADOS:
${bottlenecks || 'Ninguno detectado'}

TAREAS BLOQUEADAS:
${blockedTasksInfo || 'Ninguna tarea bloqueada'}

SUGERENCIAS DE OPTIMIZACIÓN:
${suggestionsSummary || 'No hay sugerencias'}

ESTRUCTURA DEL FLUJO DE TRABAJO:
${BOARD_COLUMNS.map((col) => {
  const tasksInColumn = analysisData.tasks.filter((t) => t.status === col.id).length
  return `- ${col.label}: ${tasksInColumn} tareas`
}).join('\n')}

Por favor, genera un informe detallado que incluya:
1. RESUMEN EJECUTIVO
2. ANÁLISIS DE CARGA DE TRABAJO
3. ANÁLISIS DE FLUJO
4. RIESGOS Y BLOQUEOS
5. RECOMENDACIONES ESTRATÉGICAS
6. MÉTRICAS CLAVE

El informe debe ser profesional, claro, accionable y específico para el contexto de producción gráfica e imprenta. Usa formato markdown para mejor legibilidad.`

  return callGeminiGenerateContent({ model: 'gemini-2.5-flash', contents: prompt })
}

