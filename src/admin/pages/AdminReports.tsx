import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task, TeamMember, ActivityEvent } from '../../types/board'
import { generateReport } from '../services/adminReportService'
import { useAuth } from '../../hooks/useAuth'
import apiService from '../../services/api'
import './AdminReports.css'

interface AdminReportsProps {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
}

type ReportType = 'kanban' | 'performance' | 'workload' | 'bottlenecks' | 'ventas' | 'clientes' | 'completo' | 'custom'

export default function AdminReports({
  tasks,
  activity,
  teamMembers
}: AdminReportsProps) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('completo')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })
  
  // Datos adicionales
  const [clientes, setClientes] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [dataError, setDataError] = useState<string | null>(null)

  // Cargar datos adicionales
  useEffect(() => {
    const loadAllData = async () => {
      setLoadingData(true)
      setDataError(null)
      try {
        // Cargar facturas
        const facturasRes = await apiService.getFacturas({
          fechaDesde: dateRange.from,
          fechaHasta: dateRange.to
        })
        if (facturasRes.success && facturasRes.data) {
          setFacturas(facturasRes.data)
        } else {
          console.warn('No se pudieron cargar facturas:', facturasRes.error)
        }

        // Cargar presupuestos de ventas
        const presupuestosRes = await apiService.getPresupuestosVentasAdmin({
          fecha_desde: dateRange.from,
          fecha_hasta: dateRange.to
        })
        if (presupuestosRes.success && presupuestosRes.data) {
          setPresupuestos(presupuestosRes.data)
        } else {
          console.warn('No se pudieron cargar presupuestos:', presupuestosRes.error)
        }

        // Cargar clientes web
        const clientesRes = await apiService.getClientesWeb()
        if (clientesRes.success && clientesRes.data) {
          setClientes(clientesRes.data)
        } else {
          console.warn('No se pudieron cargar clientes:', clientesRes.error)
        }
      } catch (error) {
        console.error('Error cargando datos:', error)
        setDataError(error instanceof Error ? error.message : 'Error al cargar los datos')
      } finally {
        setLoadingData(false)
      }
    }

    loadAllData()
  }, [dateRange])

  // Calcular métricas completas
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

    // Ventas
    const totalFacturas = facturas.length
    const facturasEmitidas = facturas.filter(f => f.estado === 'Emitida').length
    const totalVentas = facturas
      .filter(f => f.estado === 'Emitida')
      .reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0)

    // Presupuestos
    const totalPresupuestos = presupuestos.length
    const presupuestosAceptados = presupuestos.filter(p => p.estado === 'Aceptado').length
    const valorPresupuestos = presupuestos
      .filter(p => p.estado === 'Aceptado')
      .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0)

    // Clientes
    const totalClientes = clientes.length
    const clientesActivos = clientes.filter(c => c.activo !== false).length

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
      totalFacturas,
      facturasEmitidas,
      totalVentas,
      totalPresupuestos,
      presupuestosAceptados,
      valorPresupuestos,
      totalClientes,
      clientesActivos,
      byStatus,
      byPriority,
      byOperator
    }
  }, [tasks, teamMembers, facturas, presupuestos, clientes])

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
        userName: usuario?.nombre || 'Admin',
        metrics: {
          totalOps: metrics.totalOps,
          opsEnProceso: metrics.opsEnProceso,
          opsCompletadas: metrics.opsCompletadas,
          opsUrgentes: metrics.opsUrgentes,
          opsAtrasadas: metrics.opsAtrasadas,
          totalFacturas: metrics.totalFacturas,
          facturasEmitidas: metrics.facturasEmitidas,
          totalVentas: metrics.totalVentas,
          totalPresupuestos: metrics.totalPresupuestos,
          presupuestosAceptados: metrics.presupuestosAceptados,
          valorPresupuestos: metrics.valorPresupuestos,
          totalClientes: metrics.totalClientes,
          clientesActivos: metrics.clientesActivos
        }
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
        <h1 className="admin-reports-title">📊 Informes Completos</h1>
      </header>

      <div className="admin-reports-content">
        {/* Indicador de Carga */}
        {loadingData && (
          <section className="admin-reports-section">
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#b7bed3' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>Cargando datos...</div>
            </div>
          </section>
        )}

        {/* Error de Datos */}
        {dataError && (
          <section className="admin-reports-section">
            <div className="admin-reports-error">
              ⚠️ Error al cargar datos: {dataError}
            </div>
          </section>
        )}

        {/* Métricas Rápidas */}
        {!loadingData && (
          <section className="admin-reports-section admin-reports-metrics-section">
            <h2 className="admin-reports-section-title">📈 Resumen General</h2>
            <div className="admin-reports-metrics-grid">
            <div className="admin-reports-metric-card">
              <div className="admin-reports-metric-icon">📋</div>
              <div className="admin-reports-metric-content">
                <div className="admin-reports-metric-value">{metrics.totalOps}</div>
                <div className="admin-reports-metric-label">Total OPs</div>
              </div>
            </div>
            <div className="admin-reports-metric-card">
              <div className="admin-reports-metric-icon">💰</div>
              <div className="admin-reports-metric-content">
                <div className="admin-reports-metric-value">${metrics.totalVentas.toLocaleString('es-AR')}</div>
                <div className="admin-reports-metric-label">Ventas</div>
              </div>
            </div>
            <div className="admin-reports-metric-card">
              <div className="admin-reports-metric-icon">👥</div>
              <div className="admin-reports-metric-content">
                <div className="admin-reports-metric-value">{metrics.totalClientes}</div>
                <div className="admin-reports-metric-label">Clientes</div>
              </div>
            </div>
            <div className="admin-reports-metric-card">
              <div className="admin-reports-metric-icon">📄</div>
              <div className="admin-reports-metric-content">
                <div className="admin-reports-metric-value">{metrics.totalPresupuestos}</div>
                <div className="admin-reports-metric-label">Presupuestos</div>
              </div>
            </div>
            <div className="admin-reports-metric-card admin-reports-metric-card-urgent">
              <div className="admin-reports-metric-icon">🔴</div>
              <div className="admin-reports-metric-content">
                <div className="admin-reports-metric-value">{metrics.opsUrgentes}</div>
                <div className="admin-reports-metric-label">Urgentes</div>
              </div>
            </div>
            <div className="admin-reports-metric-card admin-reports-metric-card-warning">
              <div className="admin-reports-metric-icon">⚠️</div>
              <div className="admin-reports-metric-content">
                <div className="admin-reports-metric-value">{metrics.opsAtrasadas}</div>
                <div className="admin-reports-metric-label">Atrasadas</div>
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Selector de Tipo de Reporte */}
        {!loadingData && (
          <section className="admin-reports-section">
            <h2 className="admin-reports-section-title">Tipo de Informe</h2>
          <div className="admin-reports-type-grid">
            <button
              className={`admin-reports-type-card ${selectedReportType === 'completo' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('completo')}
            >
              <div className="admin-reports-type-icon">🎯</div>
              <div className="admin-reports-type-label">Completo</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'ventas' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('ventas')}
            >
              <div className="admin-reports-type-icon">💰</div>
              <div className="admin-reports-type-label">Ventas</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'clientes' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('clientes')}
            >
              <div className="admin-reports-type-icon">👥</div>
              <div className="admin-reports-type-label">Clientes</div>
            </button>
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
              <div className="admin-reports-type-label">Carga Trabajo</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'bottlenecks' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('bottlenecks')}
            >
              <div className="admin-reports-type-icon">🔴</div>
              <div className="admin-reports-type-label">Cuellos Botella</div>
            </button>
            <button
              className={`admin-reports-type-card ${selectedReportType === 'custom' ? 'active' : ''}`}
              onClick={() => setSelectedReportType('custom')}
            >
              <div className="admin-reports-type-icon">🎨</div>
              <div className="admin-reports-type-label">Personalizado</div>
            </button>
          </div>
        </section>
        )}

        {/* Rango de Fechas */}
        {!loadingData && (
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
        )}

        {/* Preview de Métricas Detalladas */}
        {!loadingData && (
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
              <span className="admin-reports-preview-label">Facturas:</span>
              <span className="admin-reports-preview-value">{metrics.totalFacturas}</span>
            </div>
            <div className="admin-reports-preview-item">
              <span className="admin-reports-preview-label">Total Ventas:</span>
              <span className="admin-reports-preview-value">${metrics.totalVentas.toLocaleString('es-AR')}</span>
            </div>
            <div className="admin-reports-preview-item">
              <span className="admin-reports-preview-label">Clientes:</span>
              <span className="admin-reports-preview-value">{metrics.totalClientes}</span>
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
        )}

        {/* Botón Generar */}
        {!loadingData && (
          <section className="admin-reports-section">
            <button
              className="admin-reports-generate-btn"
              onClick={handleGenerateReport}
              disabled={isGenerating || loadingData}
            >
              {isGenerating ? '⏳ Generando...' : '📊 Generar Informe'}
            </button>
          </section>
        )}

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
              <h2 className="admin-reports-section-title">Informe Generado</h2>
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
