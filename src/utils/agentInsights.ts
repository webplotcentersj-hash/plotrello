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
  /** Resumen corto para badge / briefing de apertura */
  summaryLine: string
  alertCount: number
}

const buildAlertSummary = (title: string, items: string[]) => {
  if (items.length === 0) return `- ${title}: Sin hallazgos críticos.`
  return [`- ${title}:`, ...items.map((item) => `  • ${item}`)].join('\n')
}

const topByCount = (items: string[], limit = 3) => {
  const map = new Map<string, number>()
  for (const item of items) {
    map.set(item, (map.get(item) || 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

export const buildAgenticContext = (
  tasks: Task[],
  activity: ActivityEvent[],
  teamMembers: TeamMember[]
): AgenticContextPayload => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday.getTime() + MS_PER_DAY)

  const activeTasks = tasks.filter((task) => task.status !== 'almacen-entrega')

  const overdueTasks = activeTasks.filter((task) => {
    const due = parseDate(task.dueDate)
    return due !== null && due.getTime() < startOfToday.getTime()
  })

  const dueTodayTasks = activeTasks.filter((task) => {
    const due = parseDate(task.dueDate)
    if (!due) return false
    return due.getTime() >= startOfToday.getTime() && due.getTime() < endOfToday.getTime()
  })

  const dueSoonTasks = activeTasks.filter((task) => {
    const due = parseDate(task.dueDate)
    if (!due) return false
    const diffDays = (due.getTime() - now.getTime()) / MS_PER_DAY
    return diffDays >= 0 && diffDays <= 3
  })

  const staleTasks = activeTasks.filter((task) => {
    const updated = parseDate(task.updatedAt) ?? parseDate(task.createdAt)
    if (!updated) return false
    const diffDays = (now.getTime() - updated.getTime()) / MS_PER_DAY
    return diffDays >= 4 && task.progress < 70
  })

  const highImpactBacklog = activeTasks.filter(
    (task) => task.impact === 'alta' && ['en-espera', 'diseno-proceso', 'diseno-grafico'].includes(task.status)
  )

  const unassignedHigh = activeTasks.filter(
    (task) =>
      (!task.ownerId || task.ownerId === 'unassigned' || task.ownerId === '') &&
      (task.priority === 'alta' || task.impact === 'alta')
  )

  const waitingTasks = activeTasks.filter((task) => task.status === 'en-espera')

  const sectorHotspots = topByCount(
    overdueTasks.map((task) => task.status),
    3
  )

  const workloadByMember = teamMembers.map((member) => ({
    member,
    tasks: activeTasks.filter((task) => task.ownerId === member.id)
  }))

  const maxTasks = Math.max(...workloadByMember.map((entry) => entry.tasks.length), 0)
  const overloadMembers = workloadByMember
    .filter((entry) => entry.tasks.length >= Math.max(3, maxTasks - 1))
    .filter((entry) => entry.tasks.length > 0)

  const recentManualOverrides = activity
    .filter(
      (event) =>
        event.note.toLowerCase().includes('urgente') || event.note.toLowerCase().includes('bloqueado')
    )
    .slice(0, 3)
    .map((event) => {
      const task = findTaskForActivityEvent(activeTasks, event.taskId)
      return `OP ${task?.opNumber || task?.title || event.taskId} movida a ${event.to} (${event.note})`
    })

  const recentMoves = activity.slice(0, 8).map((event) => {
    const task = findTaskForActivityEvent(activeTasks, event.taskId)
    return `${task?.opNumber || task?.title || event.taskId}: ${event.from} → ${event.to}`
  })

  const alerts: string[] = []

  if (overdueTasks.length > 0) {
    alerts.push(
      `${overdueTasks.length} tareas con vencimiento superado (ej: ${overdueTasks[0].title} - OP ${overdueTasks[0].opNumber})`
    )
  }

  if (dueTodayTasks.length > 0) {
    alerts.push(`${dueTodayTasks.length} entregas con vencimiento HOY`)
  }

  if (staleTasks.length > 0) {
    alerts.push(
      `${staleTasks.length} tareas estancadas (+4 días sin movimiento) concentradas en ${[
        ...new Set(staleTasks.map((task) => task.status))
      ]
        .slice(0, 4)
        .join(', ')}`
    )
  }

  if (unassignedHigh.length > 0) {
    alerts.push(`${unassignedHigh.length} OPs de alta prioridad/impacto sin responsable asignado`)
  }

  if (waitingTasks.length >= 8) {
    alerts.push(`Cola grande en En espera: ${waitingTasks.length} fichas`)
  }

  if (overloadMembers.length > 0) {
    alerts.push(
      `Sobrecarga en ${overloadMembers.map((entry) => entry.member.name).join(', ')} (${overloadMembers[0].tasks.length} tareas activas)`
    )
  }

  if (sectorHotspots.length > 0 && overdueTasks.length >= 5) {
    alerts.push(
      `Focos de atraso: ${sectorHotspots.map(([status, count]) => `${status} (${count})`).join(', ')}`
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

  if (recentMoves.length > 0) {
    opportunities.push(`Últimos movimientos del tablero: ${recentMoves.slice(0, 3).join(' · ')}`)
  }

  if (waitingTasks.length > 0 && waitingTasks.length < 8) {
    opportunities.push(`Revisar ${waitingTasks.length} fichas en En espera y destrabar bloqueos`)
  }

  const workloadAlerts = overloadMembers.map(
    (entry) =>
      `${entry.member.name} gestiona ${entry.tasks.length} tareas (prioridades: ${entry.tasks
        .map((task) => task.priority)
        .join(', ')})`
  )

  const strategicFocus: string[] = []

  if (alerts.length === 0 && opportunities.length === 0) {
    strategicFocus.push('Tablero estable. Aprovechá para optimizar tiempos muertos y capacitar al equipo.')
  } else {
    strategicFocus.push('Priorizá mitigar alertas críticas antes de asumir nuevas órdenes.')
  }

  if (dueSoonTasks.length > 0 || overdueTasks.length > 0) {
    strategicFocus.push('Daily de vencimientos + reasignar recursos preventivamente.')
  }

  if (unassignedHigh.length > 0) {
    strategicFocus.push('Asignar responsables a OPs críticas sin dueño antes del mediodía.')
  }

  const suggestedActions: AgenticAction[] = [
    {
      id: 'briefing',
      label: 'Briefing ahora',
      description: 'Resumen ejecutivo de riesgos y próximos pasos.',
      prompt:
        'Actuá como agente de operaciones de Plot Center. Dame un briefing ejecutivo AHORA: 1) top 5 riesgos del tablero con OP y responsable, 2) qué conviene hacer en la próxima hora, 3) qué preguntarle a cada sector. Sé concreto, con datos del contexto.'
    },
    {
      id: 'diagnostic',
      label: 'Diagnóstico integral',
      description: 'Cuellos de botella y plan de mitigación.',
      prompt:
        'Generá un diagnóstico integral del tablero: cuellos de botella, tareas atrasadas, responsables afectados y plan de mitigación priorizado. Incluí acciones concretas por sector.'
    },
    {
      id: 'focus-high-impact',
      label: 'Plan alto impacto',
      description: 'Rescatar tareas estratégicas bloqueadas.',
      prompt:
        'Proponé un plan operativo para destrabar las tareas de alto impacto en backlog o espera, incluyendo responsables y próximos pasos. Si faltan datos, pedime 1 sola aclaración.'
    },
    {
      id: 'workload-balancing',
      label: 'Balancear carga',
      description: 'Reasignar trabajo del equipo.',
      prompt:
        'Evaluá la carga de trabajo por persona y sugerí cómo redistribuir tareas para evitar sobrecargas y mantener entregas. Nombrá OPs concretas.'
    },
    {
      id: 'delivery-forecast',
      label: 'Forecast entregas',
      description: 'Prever vencimientos y recursos.',
      prompt:
        'Construí un forecast de entregas para los próximos 5 días, indicando riesgos de atraso y recursos necesarios para cumplir. Separá por sector.'
    },
    {
      id: 'move-op-voice',
      label: 'Mover / asignar OP',
      description: 'Propuesta; vos confirmás.',
      prompt:
        'Quiero mover o asignar una OP. Pedime número de OP, columna destino y/o responsable. Cuando esté listo emití PLOTAI_ACTION move_op. No digas que ya lo hiciste: yo confirmo.'
    },
    {
      id: 'draft-presu-voice',
      label: 'Borrador presupuesto',
      description: 'Brief → borrador sin inventar precios.',
      prompt:
        'Armá un borrador de presupuesto desde un brief. Si no conocés precios de lista, usá precio 0 y precios_pendientes true. Emití PLOTAI_ACTION draft_presupuesto para que yo confirme. No digas que ya quedó creado.'
    },
    {
      id: 'wa-aviso-voice',
      label: 'Aviso WhatsApp',
      description: 'Abre el chat; vos enviás.',
      prompt:
        'Quiero avisar a un cliente por WhatsApp (listo / falta dato / demora). Pedime OP o teléfono y redactá el mensaje. Emití PLOTAI_ACTION whatsapp_aviso. Aclará que solo se abre WhatsApp y yo envío.'
    },
    {
      id: 'create-op-voice',
      label: 'Crear OP (voz/chat)',
      description: 'Pedí una OP en lenguaje natural y confirmá.',
      prompt:
        'Quiero crear una OP. Pedime los datos mínimos (cliente y descripción del trabajo) y cuando los tenga emití el bloque PLOTAI_ACTION create_op para que yo confirme. No ejecutes solo.'
    },
    {
      id: 'create-venta-voice',
      label: 'Crear venta (voz/chat)',
      description: 'Registrá una venta hablándome.',
      prompt:
        'Quiero registrar una venta de mostrador. Pedime cliente y monto (y medio de pago si hace falta) y cuando esté listo emití el bloque PLOTAI_ACTION create_venta para confirmar. No digas que ya quedó registrada.'
    },
    {
      id: 'find-op',
      label: 'Ubicar OP',
      description: 'Dónde está y qué falta.',
      prompt:
        'Ayudame a ubicar OPs críticas: listá las 8 más urgentes (vencidas o por vencer), en qué columna están, responsable y qué acción conviene ahora.'
    }
  ]

  const alertCount = alerts.length
  const summaryLine =
    alertCount === 0
      ? 'Tablero estable · listo para optimizar'
      : `${alertCount} alerta${alertCount === 1 ? '' : 's'} · ${overdueTasks.length} vencidas · ${dueTodayTasks.length} hoy`

  return {
    alerts,
    opportunities,
    workloadAlerts,
    strategicFocus,
    suggestedActions,
    summaryLine,
    alertCount
  }
}

export const formatAgenticContextForPrompt = (context: AgenticContextPayload): string => {
  const sections = [
    `- Resumen operativo: ${context.summaryLine}`,
    buildAlertSummary('Alertas críticas', context.alerts),
    buildAlertSummary('Oportunidades detectadas', context.opportunities),
    buildAlertSummary('Alertas de carga', context.workloadAlerts),
    buildAlertSummary('Enfoque estratégico sugerido', context.strategicFocus)
  ]

  return `${sections.join('\n')}\n- Acciones sugeridas:\n${context.suggestedActions
    .map((action) => `  • ${action.label}: ${action.description}`)
    .join('\n')}`
}

/** Mensaje de apertura proactivo para el chat PlotAI */
export function buildPlotAIOpeningBrief(context: AgenticContextPayload, userName?: string): string {
  const hi = userName ? `¡Hola ${userName}!` : '¡Hola!'
  const alertsBlock =
    context.alerts.length > 0
      ? context.alerts
          .slice(0, 4)
          .map((a) => `• ${a}`)
          .join('\n')
      : '• Sin alertas críticas en este momento.'

  const actionsHint = context.suggestedActions
    .slice(0, 3)
    .map((a) => `**${a.label}**`)
    .join(' · ')

  return `${hi} Soy **PlotAI**, tu agente de operaciones en Plot Lab.

**Estado ahora:** ${context.summaryLine}

**Alertas que estoy mirando:**
${alertsBlock}

Puedo diagnosticar el tablero y **proponer** (nunca solo): crear OP/venta, mover/asignar OP, borrador de presupuesto y aviso WhatsApp. Vos confirmás cada acción. También dictado 🎙️, adjuntos 📎 y voz 🔊.

Atajos útiles: ${actionsHint}.

Ejemplos: «Pasá la OP 104687 a Imprenta», «Armá presupuesto borrador para López: vinilo 2x1», «Avisale que está listo».

¿Qué priorizamos?`
}
