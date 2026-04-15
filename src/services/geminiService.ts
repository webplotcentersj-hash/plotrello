import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Task, TeamMember } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'

// La API key se puede configurar como variable de entorno
// Por ahora usaremos una variable de entorno o un valor por defecto
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null

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
  if (!genAI) {
    throw new Error('Gemini API key no configurada. Por favor, configura VITE_GEMINI_API_KEY en tu archivo .env')
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  // Preparar datos para el prompt
  const workloadSummary = analysisData.workloadByPerson
    .map((w) => `- ${w.member.name}: ${w.taskCount} tareas, ${w.highPriorityCount} alta prioridad, ${Math.round(w.avgProgress)}% progreso promedio, carga: ${Math.round(w.workload)} pts`)
    .join('\n')

  const bottlenecks = analysisData.bottlenecksByColumn
    .filter((b) => b.isBottleneck)
    .map((b) => `- ${b.column.label}: ${b.taskCount} tareas, ${b.avgDays.toFixed(1)} días promedio`)
    .join('\n')

  const blockedTasksInfo = analysisData.blockedTasks
    .map((t) => `- ${t.title} (OP: ${t.opNumber}): bloqueada desde ${new Date(t.updatedAt).toLocaleDateString('es-AR')}`)
    .join('\n')

  const suggestionsSummary = analysisData.suggestions
    .map((s, i) => `${i + 1}. ${s.type}: ${s.taskTitle} - ${s.reason}`)
    .join('\n')

  const totalTasks = analysisData.tasks.length
  const completedTasks = analysisData.tasks.filter((t) => t.status === 'almacen-entrega').length
  const inProgressTasks = analysisData.tasks.filter((t) => 
    !['diseno-grafico', 'almacen-entrega'].includes(t.status)
  ).length

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

1. RESUMEN EJECUTIVO: Un resumen general del estado del sprint (2-3 párrafos)

2. ANÁLISIS DE CARGA DE TRABAJO: 
   - Identifica desequilibrios en la distribución de trabajo
   - Señala personas sobrecargadas o subutilizadas
   - Recomendaciones específicas para balancear la carga

3. ANÁLISIS DE FLUJO:
   - Identifica cuellos de botella en el proceso
   - Analiza el tiempo promedio en cada etapa
   - Sugiere mejoras en el flujo de trabajo

4. RIESGOS Y BLOQUEOS:
   - Lista tareas bloqueadas y su impacto
   - Identifica riesgos potenciales (fechas de entrega, recursos, etc.)
   - Prioriza acciones para desbloquear tareas

5. RECOMENDACIONES ESTRATÉGICAS:
   - Acciones inmediatas (esta semana)
   - Mejoras a mediano plazo (este mes)
   - Optimizaciones a largo plazo

6. MÉTRICAS CLAVE:
   - Tasa de completitud
   - Velocidad del equipo
   - Tiempo promedio de ciclo
   - Eficiencia por etapa

El informe debe ser profesional, claro, accionable y específico para el contexto de producción gráfica e imprenta. Usa formato markdown para mejor legibilidad.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Error generando informe con Gemini:', error)
    throw new Error('Error al generar el informe. Por favor, verifica tu API key de Gemini.')
  }
}

