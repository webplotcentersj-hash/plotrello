import type { Task, TeamMember, ActivityEvent } from '../../types/board'
import { generateContent } from '../../services/plotAIService'

export interface ReportOptions {
  type: 'kanban' | 'performance' | 'workload' | 'bottlenecks' | 'ventas' | 'clientes' | 'completo' | 'custom'
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  dateRange: {
    from: string
    to: string
  }
  userName?: string
  ventas?: any[]
  clientes?: any[]
  presupuestos?: any[]
  metrics?: any
}

/**
 * Genera un reporte online usando PlotAI
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { type, tasks, activity, teamMembers, dateRange, userName, metrics } = options

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
    case 'completo':
      prompt = `Genera un REPORTE COMPLETO Y EXHAUSTIVO del sistema para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

INCLUYE TODOS LOS ASPECTOS:

1. RESUMEN EJECUTIVO
   - Métricas clave generales
   - Estado general del negocio
   - Tendencias principales

2. ANÁLISIS DE VENTAS
   - Total de facturas emitidas: ${metrics?.totalFacturas || 0}
   - Total de ventas: $${metrics?.totalVentas?.toLocaleString('es-AR') || 0}
   - Análisis de facturación por período
   - Top clientes por facturación
   - Tendencias de ventas

3. ANÁLISIS DE CLIENTES
   - Total de clientes: ${metrics?.totalClientes || 0}
   - Clientes activos: ${metrics?.clientesActivos || 0}
   - Análisis de base de clientes
   - Clientes nuevos en el período
   - Segmentación de clientes

4. ANÁLISIS DE PRESUPUESTOS
   - Total de presupuestos: ${metrics?.totalPresupuestos || 0}
   - Presupuestos aceptados: ${metrics?.presupuestosAceptados || 0}
   - Valor de presupuestos aceptados: $${metrics?.valorPresupuestos?.toLocaleString('es-AR') || 0}
   - Tasa de conversión
   - Análisis de presupuestos rechazados

5. ESTADO DEL KANBAN
   - Total de OPs: ${metrics?.totalOps || 0}
   - OPs en proceso: ${metrics?.opsEnProceso || 0}
   - OPs completadas: ${metrics?.opsCompletadas || 0}
   - Distribución por estado
   - Distribución por prioridad
   - OPs urgentes: ${metrics?.opsUrgentes || 0}
   - OPs atrasadas: ${metrics?.opsAtrasadas || 0}

6. RENDIMIENTO Y PRODUCTIVIDAD
   - Análisis de rendimiento por operario
   - Análisis de rendimiento por sector
   - Métricas de productividad
   - Tiempos promedio
   - Comparaciones y tendencias

7. CARGA DE TRABAJO
   - Distribución de carga por operario
   - Identificación de sobrecargas
   - Balance de trabajo
   - OPs de alta prioridad por operario

8. CUELLOS DE BOTELLA
   - Identificación de bloqueos
   - OPs estancadas
   - Análisis de causas raíz
   - Impacto en el flujo

9. RECOMENDACIONES ESTRATÉGICAS
   - Acciones prioritarias
   - Oportunidades de mejora
   - Plan de acción
   - Objetivos sugeridos

Usa TODOS los datos proporcionados en el contexto. Sé detallado, preciso y profesional.`
      break

    case 'ventas':
      prompt = `Genera un reporte DETALLADO DE VENTAS para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

INCLUYE:
1. Resumen ejecutivo de ventas
2. Total de facturas: ${metrics?.totalFacturas || 0}
3. Total de ventas: $${metrics?.totalVentas?.toLocaleString('es-AR') || 0}
4. Análisis de facturación por período
5. Distribución de ventas por cliente
6. Top 10 clientes por facturación
7. Análisis de presupuestos convertidos
8. Tendencias de ventas
9. Comparación con períodos anteriores (si aplica)
10. Análisis de productos/servicios más vendidos
11. Recomendaciones para aumentar ventas

Usa los datos reales de facturas y presupuestos proporcionados.`
      break

    case 'clientes':
      prompt = `Genera un reporte COMPLETO DE CLIENTES para el período del ${new Date(dateRange.from).toLocaleDateString('es-AR')} al ${new Date(dateRange.to).toLocaleDateString('es-AR')}.

INCLUYE:
1. Resumen ejecutivo de clientes
2. Total de clientes: ${metrics?.totalClientes || 0}
3. Clientes activos: ${metrics?.clientesActivos || 0}
4. Análisis de base de clientes
5. Clientes nuevos en el período
6. Segmentación de clientes
7. Análisis de clientes por volumen de compra
8. Clientes más frecuentes
9. Análisis de retención de clientes
10. Oportunidades de crecimiento
11. Recomendaciones para fidelización

Usa los datos reales de clientes proporcionados.`
      break

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
