import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import type { Task, TeamMember } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'
import { generateSprintReport, type SprintAnalysisData } from '../services/geminiService'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { plotAiGetSprintPrediction, plotAiRecordSprintSnapshot } from '../services/plotaiSprintPredictionService'
import './SprintOptimizerModal.css'

type SprintOptimizerModalProps = {
  tasks: Task[]
  teamMembers: TeamMember[]
  onClose: () => void
  onApplyOptimization?: (suggestions: OptimizationSuggestion[]) => void
}

type OptimizationSuggestion = {
  type: 'reassign' | 'move' | 'priority'
  taskId: string
  taskTitle: string
  currentValue: string
  suggestedValue: string
  reason: string
  impact: 'high' | 'medium' | 'low'
}

const SprintOptimizerModal = ({
  tasks,
  teamMembers,
  onClose,
  onApplyOptimization
}: SprintOptimizerModalProps) => {
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [serverPrediction, setServerPrediction] = useState<{
    velocity_per_day?: number
    eta_days?: number | null
    eta_range_days?: { low: number; high: number } | null
    snapshots_used?: number
  } | null>(null)
  const reportRef = useRef<HTMLDivElement | null>(null)

  const displayUserName = (raw: string): string => {
    const s = (raw ?? '').trim()
    if (!s) return '—'
    const noAtPrefix = s.startsWith('@') ? s.slice(1) : s
    const beforeAt = noAtPrefix.split('@')[0] ?? noAtPrefix
    const first = beforeAt.trim().split(/\s+/)[0]
    return first || beforeAt.trim() || noAtPrefix
  }

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of teamMembers) map.set(m.id, displayUserName(m.name))
    return map
  }, [teamMembers])

  const taskById = useMemo(() => {
    const map = new Map<string, Task>()
    for (const t of tasks) map.set(t.id, t)
    return map
  }, [tasks])

  useEffect(() => {
    if (!aiReport && !reportError) return
    reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [aiReport, reportError])

  useEffect(() => {
    // Aprendizaje: guardamos snapshot y consultamos predicción basada en histórico.
    // Si falla, no afecta el flujo del optimizador.
    let cancelled = false
    ;(async () => {
      try {
        await plotAiRecordSprintSnapshot(tasks, null)
        const pred = await plotAiGetSprintPrediction(null)
        if (!cancelled && pred?.has_data) {
          setServerPrediction({
            velocity_per_day: pred.velocity_per_day,
            eta_days: pred.eta_days ?? null,
            eta_range_days: pred.eta_range_days ?? null,
            snapshots_used: pred.snapshots_used
          })
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tasks])

  const analysis = useMemo(() => {
    // Análisis de carga de trabajo por persona
    const workloadByPerson = teamMembers.map((member) => {
      const memberTasks = tasks.filter((task) => task.ownerId === member.id)
      const highPriorityTasks = memberTasks.filter((task) => task.priority === 'alta').length
      const totalStoryPoints = memberTasks.reduce((sum, task) => sum + task.storyPoints, 0)
      const avgProgress = memberTasks.length > 0
        ? memberTasks.reduce((sum, task) => sum + task.progress, 0) / memberTasks.length
        : 0

      return {
        member,
        taskCount: memberTasks.length,
        highPriorityCount: highPriorityTasks,
        totalStoryPoints,
        avgProgress,
        workload: memberTasks.length * 10 + totalStoryPoints * 2
      }
    })

    const avgWorkload = workloadByPerson.reduce((sum, w) => sum + w.workload, 0) / teamMembers.length

    // Análisis de cuellos de botella por columna
    const bottlenecksByColumn = BOARD_COLUMNS.map((column) => {
      const columnTasks = tasks.filter((task) => task.status === column.id)
      const avgDaysInColumn = columnTasks.map((task) => {
        const days = (new Date().getTime() - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        return days
      })
      const avgDays = avgDaysInColumn.length > 0
        ? avgDaysInColumn.reduce((sum, days) => sum + days, 0) / avgDaysInColumn.length
        : 0

      return {
        column,
        taskCount: columnTasks.length,
        avgDays,
        isBottleneck: columnTasks.length > 5 || avgDays > 3
      }
    })

    // Tareas bloqueadas (en espera por mucho tiempo)
    const blockedTasks = tasks.filter((task) => {
      const daysSinceUpdate = (new Date().getTime() - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      return task.status === 'en-espera' && daysSinceUpdate > 2
    })

    // Generar sugerencias
    const suggestions: OptimizationSuggestion[] = []

    // Sugerencias de redistribución de carga
    workloadByPerson.forEach((workload) => {
      if (workload.workload > avgWorkload * 1.5) {
        const overloadedTasks = tasks
          .filter((task) => task.ownerId === workload.member.id && task.priority !== 'alta')
          .slice(0, 2)

        const underloadedMembers = workloadByPerson
          .filter((w) => w.workload < avgWorkload * 0.7 && w.member.id !== workload.member.id)
          .sort((a, b) => a.workload - b.workload)

        if (underloadedMembers.length > 0 && overloadedTasks.length > 0) {
          overloadedTasks.forEach((task) => {
            suggestions.push({
              type: 'reassign',
              taskId: task.id,
              taskTitle: task.title,
              currentValue: displayUserName(workload.member.name),
              suggestedValue: displayUserName(underloadedMembers[0].member.name),
              reason: `${displayUserName(workload.member.name)} tiene ${workload.taskCount} tareas (${Math.round(workload.workload)} pts). Redistribuir carga.`,
              impact: 'high'
            })
          })
        }
      }
    })

    // Sugerencias de movimiento de tareas bloqueadas
    blockedTasks.forEach((task) => {
      const daysBlocked = Math.floor(
        (new Date().getTime() - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      suggestions.push({
        type: 'move',
        taskId: task.id,
        taskTitle: task.title,
        currentValue: 'En Espera',
        suggestedValue: 'Diseño en Proceso',
        reason: `Tarea bloqueada por ${daysBlocked} días. Revisar y mover a siguiente etapa.`,
        impact: 'medium'
      })
    })

    // Sugerencias de priorización
    tasks
      .filter((task) => {
        const daysUntilDue = (new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        return daysUntilDue < 3 && task.priority !== 'alta' && task.status !== 'almacen-entrega'
      })
      .forEach((task) => {
        suggestions.push({
          type: 'priority',
          taskId: task.id,
          taskTitle: task.title,
          currentValue: task.priority,
          suggestedValue: 'alta',
          reason: `Vence en ${Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} días. Aumentar prioridad.`,
          impact: 'high'
        })
      })

    return {
      workloadByPerson,
      bottlenecksByColumn,
      blockedTasks,
      suggestions: suggestions.slice(0, 10) // Limitar a 10 sugerencias
    }
  }, [tasks, teamMembers])

  const insights = useMemo(() => {
    const byPriority = [
      { name: 'Alta', key: 'alta', value: tasks.filter((t) => t.priority === 'alta').length, color: '#ef4444' },
      { name: 'Media', key: 'media', value: tasks.filter((t) => t.priority === 'media').length, color: '#f59e0b' },
      { name: 'Baja', key: 'baja', value: tasks.filter((t) => t.priority === 'baja').length, color: '#10b981' }
    ].filter((x) => x.value > 0)

    const byStatus = BOARD_COLUMNS.map((c) => {
      const count = tasks.filter((t) => t.status === c.id).length
      return { name: c.label, key: c.id, value: count, color: c.accent }
    }).filter((x) => x.value > 0)

    const doneStatusId = 'almacen-entrega'
    const now = Date.now()
    const ms7d = 7 * 24 * 60 * 60 * 1000
    const doneLast7d = tasks.filter(
      (t) => t.status === doneStatusId && now - new Date(t.updatedAt).getTime() <= ms7d
    ).length
    const velocityPerDay = doneLast7d / 7
    const remaining = tasks.filter((t) => t.status !== doneStatusId).length
    const etaDays = velocityPerDay > 0 ? Math.ceil(remaining / velocityPerDay) : null
    const etaRange =
      velocityPerDay > 0
        ? {
            low: Math.ceil(remaining / (velocityPerDay * 1.25)),
            high: Math.ceil(remaining / (velocityPerDay * 0.75))
          }
        : null

    const etaDate = (days: number) => {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return d.toLocaleDateString('es-AR')
    }

    return {
      byPriority,
      byStatus,
      prediction: {
        doneLast7d,
        velocityPerDay: serverPrediction?.velocity_per_day ?? velocityPerDay,
        remaining,
        etaDays: serverPrediction?.eta_days ?? etaDays,
        etaRange: serverPrediction?.eta_range_days ?? etaRange,
        etaDate
      }
    }
  }, [tasks, serverPrediction])

  const handleApplySuggestion = (suggestion: OptimizationSuggestion) => {
    if (onApplyOptimization) {
      onApplyOptimization([suggestion])
    }
  }

  const handleApplyAll = () => {
    if (onApplyOptimization) {
      onApplyOptimization(analysis.suggestions)
    }
  }

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    setReportError(null)
    try {
      const analysisData: SprintAnalysisData = {
        tasks,
        teamMembers,
        workloadByPerson: analysis.workloadByPerson,
        bottlenecksByColumn: analysis.bottlenecksByColumn,
        blockedTasks: analysis.blockedTasks,
        suggestions: analysis.suggestions
      }
      const report = await generateSprintReport(analysisData)
      setAiReport(report)
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Error al generar el informe')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sprint-optimizer-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Optimizador de Sprint</h2>
          <div className="header-actions">
            <button
              type="button"
              className="btn-generate-report"
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
            >
              {isGeneratingReport ? 'Generando...' : 'Generar informe con IA'}
            </button>
            <button type="button" className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="optimizer-body">
          <section className="optimizer-section">
            <div className="insights-header">
              <h3>Panel visual (PlotAI)</h3>
              <div className="insights-kpis">
                <span className="insights-pill">
                  <strong>{tasks.length}</strong> tareas
                </span>
                <span className="insights-pill">
                  <strong>{insights.prediction.remaining}</strong> pendientes
                </span>
                <span className="insights-pill">
                  <strong>{insights.prediction.doneLast7d}</strong> finalizadas (7 días)
                </span>
              </div>
            </div>

            <div className="insights-grid">
              <div className="insight-card">
                <div className="insight-card-head">
                  <h4>Prioridades</h4>
                </div>
                <div className="insight-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={insights.byPriority}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {insights.byPriority.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#0b1020',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 12
                        }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center" aria-hidden>
                    <div className="donut-center-big">{tasks.length}</div>
                    <div className="donut-center-sub">tareas</div>
                  </div>
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-card-head">
                  <h4>Distribución por columna</h4>
                </div>
                <div className="insight-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={insights.byStatus}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={95}
                        paddingAngle={1}
                      >
                        {insights.byStatus.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#0b1020',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 12
                        }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center" aria-hidden>
                    <div className="donut-center-big">
                      {insights.prediction.velocityPerDay > 0 ? insights.prediction.velocityPerDay.toFixed(1) : '—'}
                    </div>
                    <div className="donut-center-sub">tareas/día</div>
                  </div>
                </div>
              </div>

              <div className="insight-card insight-card-wide">
                <div className="insight-card-head">
                  <h4>Predicción</h4>
                </div>
                <div className="prediction-grid">
                  <div className="prediction-metric">
                    <div className="prediction-label">Pendientes</div>
                    <div className="prediction-value">{insights.prediction.remaining}</div>
                  </div>
                  <div className="prediction-metric">
                    <div className="prediction-label">Throughput (7d)</div>
                    <div className="prediction-value">{insights.prediction.doneLast7d}</div>
                  </div>
                  <div className="prediction-metric">
                    <div className="prediction-label">Ritmo estimado</div>
                    <div className="prediction-value">
                      {insights.prediction.velocityPerDay > 0 ? insights.prediction.velocityPerDay.toFixed(2) : '—'}
                      <span className="prediction-unit"> / día</span>
                    </div>
                  </div>
                  <div className="prediction-metric">
                    <div className="prediction-label">ETA</div>
                    <div className="prediction-value">
                      {insights.prediction.etaDays != null ? `${insights.prediction.etaDays} días` : 'Sin datos'}
                    </div>
                    {insights.prediction.etaRange ? (
                      <div className="prediction-sub">
                        Rango: {insights.prediction.etaRange.low}–{insights.prediction.etaRange.high} días (≈{' '}
                        {insights.prediction.etaDate(insights.prediction.etaRange.low)} –{' '}
                        {insights.prediction.etaDate(insights.prediction.etaRange.high)})
                      </div>
                    ) : (
                      <div className="prediction-sub">
                        Para activar predicción: mover tareas a <strong>Almacén de Entrega</strong> y mantener historial de 7 días.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Análisis de Carga de Trabajo */}
          <section className="optimizer-section">
            <h3>Carga de Trabajo por Persona</h3>
            <div className="workload-grid">
              {analysis.workloadByPerson.map((workload) => {
                const isOverloaded = workload.workload > analysis.workloadByPerson.reduce((sum, w) => sum + w.workload, 0) / teamMembers.length * 1.2
                return (
                  <div key={workload.member.id} className={`workload-card ${isOverloaded ? 'overloaded' : ''}`}>
                    <div className="workload-header">
                      <strong>{displayUserName(workload.member.name)}</strong>
                      <span className="workload-badge">{workload.taskCount} tareas</span>
                    </div>
                    <div className="workload-stats">
                      <div>
                        <span>Prioridad Alta:</span>
                        <strong>{workload.highPriorityCount}</strong>
                      </div>
                      <div>
                        <span>Progreso Promedio:</span>
                        <strong>{Math.round(workload.avgProgress)}%</strong>
                      </div>
                      <div>
                        <span>Carga Total:</span>
                        <strong>{Math.round(workload.workload)} pts</strong>
                      </div>
                    </div>
                    {isOverloaded && (
                      <div className="workload-warning">⚠️ Sobrecarga detectada</div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Cuellos de Botella */}
          <section className="optimizer-section">
            <h3>Cuellos de Botella</h3>
            <div className="bottlenecks-list">
              {analysis.bottlenecksByColumn
                .filter((b) => b.isBottleneck)
                .map((bottleneck) => (
                  <div key={bottleneck.column.id} className="bottleneck-card">
                    <div className="bottleneck-header">
                      <strong>{bottleneck.column.label}</strong>
                      <span className="bottleneck-count">{bottleneck.taskCount} tareas</span>
                    </div>
                    <div className="bottleneck-info">
                      <span>Tiempo promedio: {bottleneck.avgDays.toFixed(1)} días</span>
                      {bottleneck.taskCount > 5 && (
                        <span className="bottleneck-warning">⚠️ Demasiadas tareas</span>
                      )}
                      {bottleneck.avgDays > 3 && (
                        <span className="bottleneck-warning">⚠️ Tiempo excesivo</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Sugerencias de Optimización */}
          <section className="optimizer-section">
            <div className="suggestions-header">
              <h3>Sugerencias de Optimización</h3>
              {analysis.suggestions.length > 0 && (
                <button className="btn-apply-all" onClick={handleApplyAll}>
                  Aplicar Todas
                </button>
              )}
            </div>
            {analysis.suggestions.length === 0 ? (
              <div className="no-suggestions">
                <p>✅ No se encontraron optimizaciones necesarias. El sprint está bien balanceado.</p>
              </div>
            ) : (
              <div className="suggestions-list">
                {analysis.suggestions.map((suggestion, index) => {
                  const t = taskById.get(suggestion.taskId)
                  const owner = t ? (memberNameById.get(t.ownerId) ?? '—') : '—'
                  const statusLabel = t ? (BOARD_COLUMNS.find((c) => c.id === t.status)?.label ?? t.status) : ''
                  return (
                    <div key={index} className={`suggestion-card impact-${suggestion.impact}`}>
                      <div className="suggestion-top">
                        <div className="suggestion-type">
                          {suggestion.type === 'reassign' && '🔄'}
                          {suggestion.type === 'move' && '➡️'}
                          {suggestion.type === 'priority' && '⚡'}
                          <span className="suggestion-type-label">
                            {suggestion.type === 'reassign' && 'Reasignar'}
                            {suggestion.type === 'move' && 'Mover'}
                            {suggestion.type === 'priority' && 'Priorizar'}
                          </span>
                        </div>
                        <span className={`impact-badge impact-${suggestion.impact}`}>
                          {suggestion.impact === 'high' && 'Alto'}
                          {suggestion.impact === 'medium' && 'Medio'}
                          {suggestion.impact === 'low' && 'Bajo'}
                        </span>
                      </div>

                      <div className="suggestion-main">
                        <div className="suggestion-title-row">
                          <strong className="suggestion-title">{suggestion.taskTitle}</strong>
                          {t?.opNumber && <span className="pill pill-op">OP {t.opNumber}</span>}
                          {t?.priority && <span className={`pill pill-priority pri-${t.priority}`}>{t.priority}</span>}
                          {statusLabel && <span className="pill pill-status">{statusLabel}</span>}
                        </div>
                        <div className="suggestion-sub">
                          <span className="muted">Operario:</span> <strong>{owner}</strong>
                          {t?.dueDate && (
                            <>
                              <span className="dot">•</span>
                              <span className="muted">Entrega:</span>{' '}
                              <strong>{new Date(t.dueDate).toLocaleDateString('es-AR')}</strong>
                            </>
                          )}
                        </div>

                        <p className="suggestion-reason">{suggestion.reason}</p>
                        <div className="suggestion-change">
                          <span className="change-from">{suggestion.currentValue}</span>
                          <span className="change-arrow">→</span>
                          <span className="change-to">{suggestion.suggestedValue}</span>
                        </div>
                      </div>

                      <div className="suggestion-actions">
                        <button className="btn-apply-suggestion" onClick={() => handleApplySuggestion(suggestion)}>
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Informe Generado por IA */}
          {(aiReport || reportError) && (
            <section className="optimizer-section">
              <h3>Informe detallado generado por IA</h3>
              {reportError ? (
                <div className="report-error">
                  <p>❌ {reportError}</p>
                  <p className="error-hint">
                    Por favor, configura tu API key de Gemini en Vercel (server) o en un archivo .env:
                    <br />
                    <code>GEMINI_API_KEY=tu_api_key_aqui</code>
                  </p>
                </div>
              ) : (
                <div className="ai-report" ref={reportRef}>
                  <div
                    className="report-content"
                    dangerouslySetInnerHTML={{
                      __html: aiReport ? marked.parse(aiReport) : ''
                    }}
                  />
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}

export default SprintOptimizerModal

