import type { Task, TeamMember, ActivityEvent } from '../../types/board'
import { generateContent } from '../../services/plotAIService'

export interface ReportOptions {
  type: 'kanban' | 'performance' | 'workload' | 'bottlenecks' | 'custom'
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  dateRange: {
    from: string
    to: string
  }
  userName?: string
}

/**
 * Genera un reporte online usando PlotAI
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { type, tasks, activity, teamMembers, dateRange, userName } = options

  // Filtrar tareas por rango de fechas
  const filteredTasks = tasks.filter(task => {
    const taskDate = new Date(task.createdAt)
    const fromDate = new Date(dateRange.from)
    const toDate = new Date(dateRange.to)
    toDate.setHours(23, 59, 59, 999) // Incluir todo el día
    return taskDate >= fromDate && taskDate <= toDate
  })

  // Filtrar actividad por rango de fechas
  const filteredActivity = activity.filter(event => {
    const eventDate = new Date(event.timestamp)
    const fromDate = new Date(dateRange.from)
    const toDate = new Date(dateRange.to)
    toDate.setHours(23, 59, 59, 999)
    return eventDate >= fromDate && eventDate <= toDate
  })

  // Construir prompt según el tipo de reporte
  let prompt = ''

  switch (type) {
    case 'kanban':
      prompt = `Genera un reporte detallado del estado del Kanban para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

Incluye:
1. Resumen ejecutivo con métricas clave
2. Distribución de OPs por estado/columna
3. OPs críticas (urgentes o atrasadas) con detalles
4. Análisis de movimientos recientes
5. Identificación de cuellos de botella
6. Recomendaciones de acción

Usa los datos reales del sistema proporcionados en el contexto.`
      break

    case 'performance':
      prompt = `Genera un reporte de rendimiento y productividad para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

Incluye:
1. Métricas de productividad (OPs completadas, tiempo promedio, etc.)
2. Análisis de rendimiento por operario
3. Análisis de rendimiento por sector
4. Tendencias y comparaciones
5. Identificación de áreas de mejora
6. Recomendaciones específicas

Usa los datos reales del sistema proporcionados en el contexto.`
      break

    case 'workload':
      prompt = `Genera un reporte de carga de trabajo para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

Incluye:
1. Distribución de carga por operario
2. Identificación de sobrecargas
3. Análisis de balance de trabajo
4. OPs de alta prioridad por operario
5. Tiempo promedio en estado por operario
6. Recomendaciones de redistribución

Usa los datos reales del sistema proporcionados en el contexto.`
      break

    case 'bottlenecks':
      prompt = `Genera un reporte de cuellos de botella y bloqueos para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

Incluye:
1. Identificación de cuellos de botella por columna/estado
2. OPs estancadas (más tiempo del esperado en un estado)
3. Análisis de causas raíz
4. Impacto en el flujo de trabajo
5. OPs bloqueadas o con dependencias
6. Plan de acción para resolver bloqueos

Usa los datos reales del sistema proporcionados en el contexto.`
      break

    case 'custom':
      prompt = `Genera un reporte personalizado y completo del sistema para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

Incluye:
1. Resumen ejecutivo general
2. Análisis completo del estado del Kanban
3. Métricas de rendimiento y productividad
4. Análisis de carga de trabajo
5. Identificación de cuellos de botella
6. Tendencias y patrones
7. Recomendaciones estratégicas
8. Plan de acción priorizado

Usa los datos reales del sistema proporcionados en el contexto.`
      break
  }

  // Generar el reporte usando PlotAI
  const report = await generateContent({
    contents: prompt,
    tasks: filteredTasks,
    activity: filteredActivity,
    teamMembers,
    useCompleteContext: true,
    userName
  })

  // Formatear el reporte con encabezado
  const formattedReport = `
═══════════════════════════════════════════════════════════════
  REPORTE ADMIN - ${type.toUpperCase()}
═══════════════════════════════════════════════════════════════

Período: ${new Date(dateRange.from).toLocaleDateString('es-AR')} - ${new Date(dateRange.to).toLocaleDateString('es-AR')}
Generado: ${new Date().toLocaleString('es-AR')}
Generado por: ${userName || 'Admin'}

═══════════════════════════════════════════════════════════════

${report}

═══════════════════════════════════════════════════════════════
Fin del Reporte
═══════════════════════════════════════════════════════════════
`

  return formattedReport
}

