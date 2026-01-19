import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task, TeamMember, ActivityEvent } from '../../types/board'
import { generateReport } from '../services/adminReportService'
import { useAuth } from '../../hooks/useAuth'
import './AdminReports.css'

interface AdminReportsProps {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
}

type ReportType = 'kanban' | 'performance' | 'workload' | 'bottlenecks' | 'custom'

export default function AdminReports({
  tasks,
  activity,
  teamMembers
}: AdminReportsProps) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('kanban')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })

  // Calcular métricas para preview
  const metrics = useMemo(() => {
    const totalOps = tasks.length
    const opsEnProceso = tasks.filter(t => 
      t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
    ).length
    const opsCompletadas = tasks.filter(t => 
      t.status === 'finalizado-taller' || t.status === 'almacen-entrega'
    ).length
    const opsUrgentes = tasks.filter(t => t.priority === 'alta').length
    const opsAtrasadas = tasks.filter(t => {
      const dueDate = new Date(t.dueDate)
      const now = new Date()
      return dueDate < now && t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
    }).length

    // Distribución por estado
    const byStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Distribución por prioridad
    const byPriority = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Top operarios
    const byOperator = tasks.reduce((acc, task) => {
      const operator = teamMembers.find(m => m.id === task.ownerId)?.name || 'Sin asignar'
      acc[operator] = (acc[operator] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalOps,
      opsEnProceso,
      opsCompletadas,
      opsUrgentes,
      opsAtrasadas,
      byStatus,
      byPriority,
      byOperator
    }
  }, [tasks, teamMembers])

  const handleGenerateReport = async () => {
    setIsGenerating(true)
    setReportError(null)
    setGeneratedReport(null)

    try {
      const report = await generateReport({
        type: selectedReportType,
        tasks,
        activity,
        teamMembers,
        dateRange,
        userName: usuario?.nombre || 'Admin'
      })

      setGeneratedReport(report)
    } catch (error) {
      console.error('Error generando reporte:', error)
      setReportError(error instanceof Error ? error.message : 'Error desconocido al generar el reporte')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportPDF = () => {
    if (!generatedReport) return

    // Crear un nuevo documento PDF
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Reporte Admin - ${selectedReportType}</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                padding: 20px;
                background: #fff;
                color: #000;
              }
              pre {
                white-space: pre-wrap;
                word-wrap: break-word;
                font-size: 12px;
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <h1>Reporte Admin - ${selectedReportType}</h1>
            <p>Generado el ${new Date().toLocaleString('es-AR')}</p>
            <pre>${generatedReport}</pre>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  return (
    <div className="admin-reports">
      {/* Header */}
      <header className="admin-reports-header">
        <button
          className="admin-reports-back-btn"
          onClick={() => navigate('/')}
        >
          ← Volver
        </button>
        <h1 className="admin-reports-title">Reportes Online</h1>
      </header>

      <div className="admin-reports-content">
        {/* Selector de Tipo de Reporte */}
        <section className="admin-reports-section">
          <h2 className="admin-reports-section-title">Tipo de Reporte</h2>
          <div className="admin-reports-type-grid">
            <button
              className={`admin-reports-type-card ${selectedReportType === 'kanban' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('kanban')}
            >
              <div className="admin-reports-type-icon">📋</div>
              <div className="admin-reports-type-label">Kanban</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'performance' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('performance')}
            >
              <div className="admin-reports-type-icon">⚡</div>
              <div className="admin-reports-type-label">Rendimiento</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'workload' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('workload')}
            >
              <div className="admin-reports-type-icon">👥</div>
              <div className="admin-reports-type-label">Carga de Trabajo</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'bottlenecks' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('bottlenecks')}
            >
              <div className="admin-reports-type-icon">🔴</div>
              <div className="admin-reports-type-label">Cuellos de Botella</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'custom' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('custom')}
            >
              <div className="admin-reports-type-icon">🎯</div>
              <div className="admin-reports-type-label">Personalizado</div>
            </button>
          </div>
        </section>

        {/* Rango de Fechas */}
        <section className="admin-reports-section">
          <h2 className="admin-reports-section-title">Período</h2>
          <div className="admin-reports-date-range">
            <div className="admin-reports-date-input-group">
              <label>Desde</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="admin-reports-date-input"
              />
            </div>
            <div className="admin-reports-date-input-group">
              <label>Hasta</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="admin-reports-date-input"
              />
            </div>
          </div>
        </section>

        {/* Preview de Métricas */}
        <section className="admin-reports-section">
          <h2 className="admin-reports-section-title">Vista Previa</h2>
          <div className="admin-reports-preview">
            <div className="admin-reports-preview-item">
              <span className="admin-reports-preview-label">Total OPs:</span>
              <span className="admin-reports-preview-value">{metrics.totalOps}</span>
            </div>
            <div className="admin-reports-preview-item">
              <span className="admin-reports-preview-label">En Proceso:</span>
              <span className="admin-reports-preview-value">{metrics.opsEnProceso}</span>
            </div>
            <div className="admin-reports-preview-item">
              <span className="admin-reports-preview-label">Completadas:</span>
              <span className="admin-reports-preview-value">{metrics.opsCompletadas}</span>
            </div>
            <div className="admin-reports-preview-item">
              <span className="admin-reports-preview-label">Urgentes:</span>
              <span className="admin-reports-preview-value admin-reports-preview-value-urgent">{metrics.opsUrgentes}</span>
            </div>
            <div className="admin-reports-preview-item">
              <span className="admin-reports-preview-label">Atrasadas:</span>
              <span className="admin-reports-preview-value admin-reports-preview-value-warning">{metrics.opsAtrasadas}</span>
            </div>
          </div>
        </section>

        {/* Botón Generar */}
        <button
          className="admin-reports-generate-btn"
          onClick={handleGenerateReport}
          disabled={isGenerating}
        >
          {isGenerating ? '⏳ Generando...' : '📊 Generar Reporte'}
        </button>

        {/* Error */}
        {reportError && (
          <div className="admin-reports-error">
            <strong>⚠️ Error:</strong> {reportError}
          </div>
        )}

        {/* Reporte Generado */}
        {generatedReport && (
          <section className="admin-reports-section">
            <div className="admin-reports-generated-header">
              <h2 className="admin-reports-section-title">Reporte Generado</h2>
              <button
                className="admin-reports-export-btn"
                onClick={handleExportPDF}
              >
                📄 Exportar PDF
              </button>
            </div>
            <div className="admin-reports-generated-content">
              <pre>{generatedReport}</pre>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

