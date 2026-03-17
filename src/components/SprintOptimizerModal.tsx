import { useMemo, useState } from 'react'
import { marked } from 'marked'
import type { Task, TeamMember } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'
import { generateSprintReport, type SprintAnalysisData } from '../services/geminiService'
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
              currentValue: workload.member.name,
              suggestedValue: underloadedMembers[0].member.name,
              reason: `${workload.member.name} tiene ${workload.taskCount} tareas (${Math.round(workload.workload)} pts). Redistribuir carga.`,
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
              {isGeneratingReport ? 'Generando...' : '🤖 Generar Informe con IA'}
            </button>
            <button type="button" className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="optimizer-body">
          {/* Análisis de Carga de Trabajo */}
          <section className="optimizer-section">
            <h3>Carga de Trabajo por Persona</h3>
            <div className="workload-grid">
              {analysis.workloadByPerson.map((workload) => {
                const isOverloaded = workload.workload > analysis.workloadByPerson.reduce((sum, w) => sum + w.workload, 0) / teamMembers.length * 1.2
                return (
                  <div key={workload.member.id} className={`workload-card ${isOverloaded ? 'overloaded' : ''}`}>
                    <div className="workload-header">
                      <strong>{workload.member.name}</strong>
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
                {analysis.suggestions.map((suggestion, index) => (
                  <div key={index} className={`suggestion-card impact-${suggestion.impact}`}>
                    <div className="suggestion-header">
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
                    <div className="suggestion-content">
                      <strong>{suggestion.taskTitle}</strong>
                      <p className="suggestion-reason">{suggestion.reason}</p>
                      <div className="suggestion-change">
                        <span className="change-from">{suggestion.currentValue}</span>
                        <span className="change-arrow">→</span>
                        <span className="change-to">{suggestion.suggestedValue}</span>
                      </div>
                    </div>
                    <button
                      className="btn-apply-suggestion"
                      onClick={() => handleApplySuggestion(suggestion)}
                    >
                      Aplicar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Informe Generado por IA */}
          {(aiReport || reportError) && (
            <section className="optimizer-section">
              <h3>📊 Informe Detallado Generado por IA</h3>
              {reportError ? (
                <div className="report-error">
                  <p>❌ {reportError}</p>
                  <p className="error-hint">
                    Por favor, configura tu API key de Gemini en un archivo .env:
                    <br />
                    <code>VITE_GEMINI_API_KEY=tu_api_key_aqui</code>
                  </p>
                </div>
              ) : (
                <div className="ai-report">
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

