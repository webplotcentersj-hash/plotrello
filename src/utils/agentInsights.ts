import type { Task, TeamMember, ActivityEvent } from '../types/board'
import { findTaskForActivityEvent } from './activityTaskResolve'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const parseDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export type AgenticAction = {
  id: string
  label: string
  description: string
  prompt: string
}

export type AgenticContextPayload = {
  alerts: string[]
  opportunities: string[]
  workloadAlerts: string[]
  strategicFocus: string[]
  suggestedActions: AgenticAction[]
}

const buildAlertSummary = (title: string, items: string[]) => {
  if (items.length === 0) return `- ${title}: Sin hallazgos críticos.`
  return [`- ${title}:`, ...items.map((item) => `  • ${item}`)].join('\n')
}

export const buildAgenticContext = (
  tasks: Task[],
  activity: ActivityEvent[],
  teamMembers: TeamMember[]
): AgenticContextPayload => {
  const now = new Date()

  const overdueTasks = tasks.filter((task) => {
    const due = parseDate(task.dueDate)
    return due !== null && due.getTime() < now.getTime()
  })

  const dueSoonTasks = tasks.filter((task) => {
    const due = parseDate(task.dueDate)
    if (!due) return false
    const diffDays = (due.getTime() - now.getTime()) / MS_PER_DAY
    return diffDays >= 0 && diffDays <= 3
  })

  const staleTasks = tasks.filter((task) => {
    const updated = parseDate(task.updatedAt) ?? parseDate(task.createdAt)
    if (!updated) return false
    const diffDays = (now.getTime() - updated.getTime()) / MS_PER_DAY
    return diffDays >= 4 && task.progress < 70
  })

  const highImpactBacklog = tasks.filter(
    (task) => task.impact === 'alta' && ['en-espera', 'diseno-proceso'].includes(task.status)
  )

  const workloadByMember = teamMembers.map((member) => ({
    member,
    tasks: tasks.filter((task) => task.ownerId === member.id)
  }))

  const maxTasks = Math.max(...workloadByMember.map((entry) => entry.tasks.length), 0)
  const overloadMembers = workloadByMember
    .filter((entry) => entry.tasks.length >= Math.max(3, maxTasks - 1))
    .filter((entry) => entry.tasks.length > 0)

  const recentManualOverrides = activity
    .filter((event) => event.note.toLowerCase().includes('urgente') || event.note.toLowerCase().includes('bloqueado'))
    .slice(0, 3)
    .map((event) => {
      const task = findTaskForActivityEvent(tasks, event.taskId)
      return `OP ${task?.opNumber || task?.title || event.taskId} movida a ${event.to} (${event.note})`
    })

  const alerts: string[] = []

  if (overdueTasks.length > 0) {
    alerts.push(
      `${overdueTasks.length} tareas con vencimiento superado (ej: ${overdueTasks[0].title} - OP ${overdueTasks[0].opNumber})`
    )
  }

  if (staleTasks.length > 0) {
    alerts.push(
      `${staleTasks.length} tareas estancadas (+4 días sin movimiento) concentradas en ${[
        ...new Set(staleTasks.map((task) => task.status))
      ].join(', ')}`
    )
  }

  if (overloadMembers.length > 0) {
    alerts.push(
      `Sobrecarga en ${overloadMembers.map((entry) => entry.member.name).join(', ')} (${overloadMembers[0].tasks.length} tareas activas)`
    )
  }

  const opportunities: string[] = []

  if (dueSoonTasks.length > 0) {
    opportunities.push(
      `Planificar entrega anticipada de ${dueSoonTasks.length} tareas que vencen en los próximos 3 días`
    )
  }

  if (highImpactBacklog.length > 0) {
    opportunities.push(
      `Destrabar ${highImpactBacklog.length} tareas de alto impacto en fases tempranas (p/e ${highImpactBacklog[0].title})`
    )
  }

  if (recentManualOverrides.length > 0) {
    opportunities.push(`Revisar overrides recientes: ${recentManualOverrides.join(' | ')}`)
  }

  const workloadAlerts = overloadMembers.map(
    (entry) => `${entry.member.name} gestiona ${entry.tasks.length} tareas (prioridades: ${entry.tasks.map((task) => task.priority).join(', ')})`
  )

  const strategicFocus = []

  if (alerts.length === 0 && opportunities.length === 0) {
    strategicFocus.push('Tablero estable. Aprovechar para optimizar tiempos muertos y capacitar al equipo.')
  } else {
    strategicFocus.push('Priorizar mitigación de alertas críticas antes de asumir nuevas órdenes.')
  }

  if (dueSoonTasks.length > 0 || overdueTasks.length > 0) {
    strategicFocus.push('Implementar daily reviews de vencimientos y reasignar recursos preventivamente.')
  }

  const suggestedActions: AgenticAction[] = [
    {
      id: 'diagnostic',
      label: 'Diagnóstico Integral',
      description: 'Análisis completo de cuellos de botella y riesgos.',
      prompt:
        'Genera un diagnóstico integral del tablero: cuellos de botella, tareas atrasadas, responsables afectados y plan de mitigación priorizado.'
    },
    {
      id: 'focus-high-impact',
      label: 'Plan Alto Impacto',
      description: 'Rescatar tareas estratégicas bloqueadas.',
      prompt:
        'Propón un plan operativo para destrabar las tareas de alto impacto en backlog o espera, incluyendo responsables y próximos pasos.'
    },
    {
      id: 'workload-balancing',
      label: 'Balancear Carga',
      description: 'Reasignar trabajo del equipo.',
      prompt:
        'Evalúa la carga de trabajo por persona y sugiere cómo redistribuir tareas para evitar sobrecargas y mantener SLA.'
    },
    {
      id: 'delivery-forecast',
      label: 'Forecast Entregas',
      description: 'Prever vencimientos y recursos.',
      prompt:
        'Construye un forecast de entregas para los próximos 5 días, indicando riesgos de atraso y recursos necesarios para cumplir.'
    }
  ]

  return {
    alerts,
    opportunities,
    workloadAlerts,
    strategicFocus,
    suggestedActions
  }
}

export const formatAgenticContextForPrompt = (context: AgenticContextPayload): string => {
  const sections = [
    buildAlertSummary('Alertas críticas', context.alerts),
    buildAlertSummary('Oportunidades detectadas', context.opportunities),
    buildAlertSummary('Alertas de carga', context.workloadAlerts),
    buildAlertSummary('Enfoque estratégico sugerido', context.strategicFocus)
  ]

  return `${sections.join('\n')}\n- Acciones sugeridas:\n${context.suggestedActions
    .map((action) => `  • ${action.label}: ${action.description}`)
    .join('\n')}`
}


