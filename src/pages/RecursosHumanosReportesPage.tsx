import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import './RecursosHumanosReportesPage.css'
import {
  ReportePieTorta,
  pieOrdenesPorEstado,
  agregarPieOrdenesUsuarios,
} from '../components/ReportePieTorta'

const SECTORES_DISPONIBLES = [
  'Taller Gráfico',
  'Instalaciones',
  'Taller de Imprenta',
  'Metalúrgica',
  'Diseño Gráfico',
  'Mostrador',
  'Compras',
  'Administración',
  'Gerencia'
]

const RecursosHumanosReportesPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [reporteTipo, setReporteTipo] = useState<'usuario' | 'sector' | 'periodo'>('usuario')
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string>('todos')
  const [sectorSeleccionado, setSectorSeleccionado] = useState<string>('')
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [reporteData, setReporteData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadUsuarios()
    // Establecer fechas por defecto (último mes)
    const hoy = new Date()
    const haceUnMes = new Date()
    haceUnMes.setMonth(haceUnMes.getMonth() - 1)
    setFechaHasta(hoy.toISOString().split('T')[0])
    setFechaDesde(haceUnMes.toISOString().split('T')[0])
  }, [canManageRecursosHumanos, navigate, authLoading])

  const loadUsuarios = async () => {
    try {
      const response = await apiService.getUsuarios()
      if (response.success && response.data) {
        setUsuarios(response.data)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const generarReporte = async () => {
    if (!fechaDesde || !fechaHasta) {
      setError('Por favor, selecciona un rango de fechas')
      return
    }

    setLoading(true)
    setError(null)
    try {
      let data: any = null

      if (reporteTipo === 'usuario') {
        if (usuarioSeleccionado === 'todos') {
          // Generar reporte para todos los usuarios
          const reportesUsuarios = await Promise.all(
            usuarios.map(async (usuario) => {
              const response = await apiService.getEstadisticasUsuario(
                usuario.id,
                fechaDesde,
                fechaHasta
              )
              return response.success ? response.data : null
            })
          )
          data = {
            tipo: 'usuario',
            usuarios: reportesUsuarios.filter(r => r !== null),
            periodo: { desde: fechaDesde, hasta: fechaHasta }
          }
        } else {
          const response = await apiService.getEstadisticasUsuario(
            parseInt(usuarioSeleccionado),
            fechaDesde,
            fechaHasta
          )
          if (response.success) {
            data = {
              tipo: 'usuario',
              usuario: response.data,
              periodo: { desde: fechaDesde, hasta: fechaHasta }
            }
          } else {
            setError(response.error || 'Error al obtener estadísticas del usuario')
            return
          }
        }
      } else if (reporteTipo === 'sector') {
        if (!sectorSeleccionado) {
          setError('Por favor, selecciona un sector')
          return
        }
        const response = await apiService.getEstadisticasSector(
          sectorSeleccionado,
          fechaDesde,
          fechaHasta
        )
        if (response.success) {
          data = {
            tipo: 'sector',
            sector: response.data,
            periodo: { desde: fechaDesde, hasta: fechaHasta }
          }
        } else {
          setError(response.error || 'Error al obtener estadísticas del sector')
          return
        }
      } else if (reporteTipo === 'periodo') {
        const response = await apiService.getEstadisticasPeriodo(fechaDesde, fechaHasta)
        if (response.success) {
          data = {
            tipo: 'periodo',
            estadisticas: response.data,
            periodo: { desde: fechaDesde, hasta: fechaHasta }
          }
        } else {
          setError(response.error || 'Error al obtener estadísticas del período')
          return
        }
      }

      setReporteData(data)
    } catch (error: any) {
      console.error('Error generando reporte:', error)
      setError(error.message || 'Error al generar el reporte')
    } finally {
      setLoading(false)
    }
  }

  const exportarPDF = () => {
    if (!reporteData) return

    const doc = new jsPDF()
    let y = 20

    // Título
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Reporte de Personal', 14, y)
    y += 10

    // Información del reporte
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-AR')}`, 14, y)
    y += 5
    doc.text(`Período: ${new Date(reporteData.periodo.desde).toLocaleDateString('es-AR')} - ${new Date(reporteData.periodo.hasta).toLocaleDateString('es-AR')}`, 14, y)
    y += 5
    doc.text(`Tipo: ${reporteData.tipo === 'usuario' ? 'Por Usuario' : reporteData.tipo === 'sector' ? 'Por Sector' : 'Por Período'}`, 14, y)
    y += 10

    // Datos según el tipo de reporte
    if (reporteData.tipo === 'usuario') {
      if (reporteData.usuario) {
        // Reporte de un solo usuario
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`Usuario: ${reporteData.usuario.nombre_usuario || 'N/A'}`, 14, y)
        y += 8
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Total de órdenes: ${reporteData.usuario.total_ordenes || 0}`, 14, y)
        y += 5
        doc.text(`Órdenes completadas: ${reporteData.usuario.ordenes_completadas || 0}`, 14, y)
        y += 5
        doc.text(`Órdenes en proceso: ${reporteData.usuario.ordenes_en_proceso || 0}`, 14, y)
        y += 5
        doc.text(`Órdenes pendientes: ${reporteData.usuario.ordenes_pendientes || 0}`, 14, y)
        y += 5
        doc.text(`Movimientos realizados: ${reporteData.usuario.movimientos_realizados || 0}`, 14, y)
        y += 5
        if (reporteData.usuario.promedio_dias_completar) {
          doc.text(`Promedio días para completar: ${reporteData.usuario.promedio_dias_completar.toFixed(1)} días`, 14, y)
          y += 5
        }
        if (reporteData.usuario.sector_principal) {
          doc.text(`Sector principal: ${reporteData.usuario.sector_principal}`, 14, y)
          y += 5
        }
        if (reporteData.usuario.ultima_actividad) {
          doc.text(`Última actividad: ${new Date(reporteData.usuario.ultima_actividad).toLocaleDateString('es-AR')}`, 14, y)
        }
      } else if (reporteData.usuarios) {
        // Reporte de múltiples usuarios
        reporteData.usuarios.forEach((usuario: any, index: number) => {
          if (y > 270) {
            doc.addPage()
            y = 20
          }
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.text(`${index + 1}. ${usuario.nombre_usuario || 'N/A'}`, 14, y)
          y += 8
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.text(`Total órdenes: ${usuario.total_ordenes || 0} | Completadas: ${usuario.ordenes_completadas || 0} | En proceso: ${usuario.ordenes_en_proceso || 0}`, 14, y)
          y += 5
          doc.text(`Movimientos: ${usuario.movimientos_realizados || 0}`, 14, y)
          y += 8
        })
      }
    } else if (reporteData.tipo === 'sector' && reporteData.sector) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`Sector: ${reporteData.sector.sector || 'N/A'}`, 14, y)
      y += 8
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total de órdenes: ${reporteData.sector.total_ordenes || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes completadas: ${reporteData.sector.ordenes_completadas || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes en proceso: ${reporteData.sector.ordenes_en_proceso || 0}`, 14, y)
      y += 5
      doc.text(`Usuarios activos: ${reporteData.sector.usuarios_activos || 0}`, 14, y)
      y += 5
      if (reporteData.sector.promedio_dias_completar) {
        doc.text(`Promedio días para completar: ${reporteData.sector.promedio_dias_completar.toFixed(1)} días`, 14, y)
        y += 5
      }
      if (reporteData.sector.tasa_completitud !== null && reporteData.sector.tasa_completitud !== undefined) {
        doc.text(`Tasa de completitud: ${reporteData.sector.tasa_completitud.toFixed(1)}%`, 14, y)
      }
    } else if (reporteData.tipo === 'periodo' && reporteData.estadisticas) {
      const stats = reporteData.estadisticas
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Estadísticas Generales del Período', 14, y)
      y += 8
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total de órdenes: ${stats.total_ordenes || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes completadas: ${stats.ordenes_completadas || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes en proceso: ${stats.ordenes_en_proceso || 0}`, 14, y)
      y += 5
      doc.text(`Usuarios activos: ${stats.usuarios_activos || 0}`, 14, y)
      y += 5
      doc.text(`Movimientos totales: ${stats.movimientos_totales || 0}`, 14, y)
      y += 5
      if (stats.promedio_dias_completar) {
        doc.text(`Promedio días para completar: ${stats.promedio_dias_completar.toFixed(1)} días`, 14, y)
        y += 5
      }
      if (stats.ordenes_por_dia) {
        doc.text(`Órdenes por día: ${stats.ordenes_por_dia.toFixed(2)}`, 14, y)
      }
    }

    doc.save(`reporte-personal-${reporteData.tipo}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportarExcel = () => {
    if (!reporteData) return

    let datos: any[] = []

    if (reporteData.tipo === 'usuario') {
      if (reporteData.usuario) {
        datos = [{
          'Usuario': reporteData.usuario.nombre_usuario || 'N/A',
          'Total Órdenes': reporteData.usuario.total_ordenes || 0,
          'Completadas': reporteData.usuario.ordenes_completadas || 0,
          'En Proceso': reporteData.usuario.ordenes_en_proceso || 0,
          'Pendientes': reporteData.usuario.ordenes_pendientes || 0,
          'Movimientos': reporteData.usuario.movimientos_realizados || 0,
          'Promedio Días': reporteData.usuario.promedio_dias_completar ? reporteData.usuario.promedio_dias_completar.toFixed(1) : 'N/A',
          'Sector Principal': reporteData.usuario.sector_principal || 'N/A',
          'Última Actividad': reporteData.usuario.ultima_actividad ? new Date(reporteData.usuario.ultima_actividad).toLocaleDateString('es-AR') : 'N/A'
        }]
      } else if (reporteData.usuarios) {
        datos = reporteData.usuarios.map((usuario: any) => ({
          'Usuario': usuario.nombre_usuario || 'N/A',
          'Total Órdenes': usuario.total_ordenes || 0,
          'Completadas': usuario.ordenes_completadas || 0,
          'En Proceso': usuario.ordenes_en_proceso || 0,
          'Pendientes': usuario.ordenes_pendientes || 0,
          'Movimientos': usuario.movimientos_realizados || 0,
          'Promedio Días': usuario.promedio_dias_completar ? usuario.promedio_dias_completar.toFixed(1) : 'N/A',
          'Sector Principal': usuario.sector_principal || 'N/A',
          'Última Actividad': usuario.ultima_actividad ? new Date(usuario.ultima_actividad).toLocaleDateString('es-AR') : 'N/A'
        }))
      }
    } else if (reporteData.tipo === 'sector' && reporteData.sector) {
      datos = [{
        'Sector': reporteData.sector.sector || 'N/A',
        'Total Órdenes': reporteData.sector.total_ordenes || 0,
        'Completadas': reporteData.sector.ordenes_completadas || 0,
        'En Proceso': reporteData.sector.ordenes_en_proceso || 0,
        'Usuarios Activos': reporteData.sector.usuarios_activos || 0,
        'Promedio Días': reporteData.sector.promedio_dias_completar ? reporteData.sector.promedio_dias_completar.toFixed(1) : 'N/A',
        'Tasa Completitud (%)': reporteData.sector.tasa_completitud ? reporteData.sector.tasa_completitud.toFixed(1) : 'N/A'
      }]
    } else if (reporteData.tipo === 'periodo' && reporteData.estadisticas) {
      const stats = reporteData.estadisticas
      datos = [{
        'Período Inicio': new Date(stats.periodo_inicio).toLocaleDateString('es-AR'),
        'Período Fin': new Date(stats.periodo_fin).toLocaleDateString('es-AR'),
        'Total Órdenes': stats.total_ordenes || 0,
        'Completadas': stats.ordenes_completadas || 0,
        'En Proceso': stats.ordenes_en_proceso || 0,
        'Usuarios Activos': stats.usuarios_activos || 0,
        'Movimientos Totales': stats.movimientos_totales || 0,
        'Promedio Días': stats.promedio_dias_completar ? stats.promedio_dias_completar.toFixed(1) : 'N/A',
        'Órdenes por Día': stats.ordenes_por_dia ? stats.ordenes_por_dia.toFixed(2) : 'N/A'
      }]
    }

    if (datos.length === 0) return

    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Personal')
    XLSX.writeFile(wb, `reporte-personal-${reporteData.tipo}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading && !reporteData) {
    return (
      <div className="rrhh-reportes-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-reportes-page">
      <header className="rrhh-reportes-header">
        <div className="rrhh-header-content">
          <h1>📊 Reportes de Personal</h1>
          <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <div className="rrhh-reportes-content">
        {/* Filtros de reporte */}
        <div className="rrhh-reporte-filters">
          <div className="rrhh-filter-section">
            <label>Tipo de Reporte</label>
            <select
              value={reporteTipo}
              onChange={(e) => setReporteTipo(e.target.value as 'usuario' | 'sector' | 'periodo')}
              className="rrhh-filter-select"
            >
              <option value="usuario">Por Usuario</option>
              <option value="sector">Por Sector</option>
              <option value="periodo">Por Período</option>
            </select>
          </div>

          {reporteTipo === 'usuario' && (
            <div className="rrhh-filter-section">
              <label>Usuario</label>
              <select
                value={usuarioSeleccionado}
                onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                className="rrhh-filter-select"
              >
                <option value="todos">Todos los usuarios</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id.toString()}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reporteTipo === 'sector' && (
            <div className="rrhh-filter-section">
              <label>Sector</label>
              <select
                value={sectorSeleccionado}
                onChange={(e) => setSectorSeleccionado(e.target.value)}
                className="rrhh-filter-select"
              >
                <option value="">Selecciona un sector</option>
                {SECTORES_DISPONIBLES.map(sector => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rrhh-filter-section">
            <label>Fecha Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="rrhh-date-input"
            />
          </div>

          <div className="rrhh-filter-section">
            <label>Fecha Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="rrhh-date-input"
            />
          </div>

          <button className="btn-primary" onClick={generarReporte}>
            Generar Reporte
          </button>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="rrhh-error-message">
            <p>⚠️ {error}</p>
          </div>
        )}

        {/* Resultados del reporte */}
        {reporteData && (
          <div className="rrhh-reporte-results">
            <div className="rrhh-reporte-header">
              <h2>Resultados del Reporte</h2>
              <div className="rrhh-export-buttons">
                <button className="btn-export" onClick={exportarPDF}>
                  📄 Exportar PDF
                </button>
                <button className="btn-export" onClick={exportarExcel}>
                  📊 Exportar Excel
                </button>
              </div>
            </div>

            <div className="rrhh-reporte-content">
              {reporteData.tipo === 'usuario' && (
                <>
                  {reporteData.usuario ? (
                    <div className="rrhh-stats-grid">
                      <div className="rrhh-stat-card rrhh-stat-card--with-pie">
                        <h3>{reporteData.usuario.nombre_usuario || 'Usuario'}</h3>
                        <div className="rrhh-stat-rows">
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Total de órdenes:</span>
                          <span className="rrhh-stat-value">{reporteData.usuario.total_ordenes || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Completadas:</span>
                          <span className="rrhh-stat-value success">{reporteData.usuario.ordenes_completadas || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">En proceso:</span>
                          <span className="rrhh-stat-value warning">{reporteData.usuario.ordenes_en_proceso || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Pendientes:</span>
                          <span className="rrhh-stat-value">{reporteData.usuario.ordenes_pendientes || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Movimientos:</span>
                          <span className="rrhh-stat-value">{reporteData.usuario.movimientos_realizados || 0}</span>
                        </div>
                        {reporteData.usuario.promedio_dias_completar && (
                          <div className="rrhh-stat-item">
                            <span className="rrhh-stat-label">Promedio días:</span>
                            <span className="rrhh-stat-value">{reporteData.usuario.promedio_dias_completar.toFixed(1)}</span>
                          </div>
                        )}
                        {reporteData.usuario.sector_principal && (
                          <div className="rrhh-stat-item">
                            <span className="rrhh-stat-label">Sector principal:</span>
                            <span className="rrhh-stat-value">{reporteData.usuario.sector_principal}</span>
                          </div>
                        )}
                        {reporteData.usuario.ultima_actividad && (
                          <div className="rrhh-stat-item">
                            <span className="rrhh-stat-label">Última actividad:</span>
                            <span className="rrhh-stat-value">{new Date(reporteData.usuario.ultima_actividad).toLocaleDateString('es-AR')}</span>
                          </div>
                        )}
                        </div>
                        <ReportePieTorta
                          title="Órdenes por estado"
                          data={pieOrdenesPorEstado(reporteData.usuario)}
                          height={260}
                          outerRadius={92}
                        />
                      </div>
                    </div>
                  ) : reporteData.usuarios && reporteData.usuarios.length > 0 ? (
                    <div className="rrhh-usuarios-list">
                      <h3>Estadísticas por Usuario</h3>
                      {reporteData.usuarios.length > 1 && (
                        <ReportePieTorta
                          className="rrhh-reporte-pie-global"
                          title="Distribución global (todos los usuarios)"
                          data={agregarPieOrdenesUsuarios(reporteData.usuarios)}
                          height={280}
                          outerRadius={100}
                        />
                      )}
                      <div className="rrhh-stats-grid">
                        {reporteData.usuarios.map((usuario: any, index: number) => (
                          <div key={index} className="rrhh-stat-card rrhh-stat-card--with-pie">
                            <h4>{usuario.nombre_usuario || 'Usuario'}</h4>
                            <div className="rrhh-stat-rows">
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Total:</span>
                              <span className="rrhh-stat-value">{usuario.total_ordenes || 0}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Completadas:</span>
                              <span className="rrhh-stat-value success">{usuario.ordenes_completadas || 0}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">En proceso:</span>
                              <span className="rrhh-stat-value warning">{usuario.ordenes_en_proceso || 0}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Movimientos:</span>
                              <span className="rrhh-stat-value">{usuario.movimientos_realizados || 0}</span>
                            </div>
                            </div>
                            <ReportePieTorta
                              compact
                              data={pieOrdenesPorEstado(usuario)}
                              height={200}
                              outerRadius={64}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p>No se encontraron datos para el período seleccionado.</p>
                  )}
                </>
              )}

              {reporteData.tipo === 'sector' && reporteData.sector && (
                <div className="rrhh-stats-grid">
                  <div className="rrhh-stat-card rrhh-stat-card--with-pie">
                    <h3>{reporteData.sector.sector || 'Sector'}</h3>
                    <div className="rrhh-stat-rows">
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Total de órdenes:</span>
                      <span className="rrhh-stat-value">{reporteData.sector.total_ordenes || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Completadas:</span>
                      <span className="rrhh-stat-value success">{reporteData.sector.ordenes_completadas || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">En proceso:</span>
                      <span className="rrhh-stat-value warning">{reporteData.sector.ordenes_en_proceso || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Usuarios activos:</span>
                      <span className="rrhh-stat-value">{reporteData.sector.usuarios_activos || 0}</span>
                    </div>
                    {reporteData.sector.promedio_dias_completar && (
                      <div className="rrhh-stat-item">
                        <span className="rrhh-stat-label">Promedio días:</span>
                        <span className="rrhh-stat-value">{reporteData.sector.promedio_dias_completar.toFixed(1)}</span>
                      </div>
                    )}
                    {reporteData.sector.tasa_completitud !== null && reporteData.sector.tasa_completitud !== undefined && (
                      <div className="rrhh-stat-item">
                        <span className="rrhh-stat-label">Tasa de completitud:</span>
                        <span className="rrhh-stat-value success">{reporteData.sector.tasa_completitud.toFixed(1)}%</span>
                      </div>
                    )}
                    </div>
                    <ReportePieTorta
                      title="Órdenes por estado"
                      data={pieOrdenesPorEstado(reporteData.sector)}
                      height={260}
                      outerRadius={92}
                    />
                  </div>
                </div>
              )}

              {reporteData.tipo === 'periodo' && reporteData.estadisticas && (
                <div className="rrhh-stats-grid">
                  <div className="rrhh-stat-card rrhh-stat-card--with-pie">
                    <h3>Estadísticas Generales</h3>
                    <div className="rrhh-stat-rows">
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Total de órdenes:</span>
                      <span className="rrhh-stat-value">{reporteData.estadisticas.total_ordenes || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Completadas:</span>
                      <span className="rrhh-stat-value success">{reporteData.estadisticas.ordenes_completadas || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">En proceso:</span>
                      <span className="rrhh-stat-value warning">{reporteData.estadisticas.ordenes_en_proceso || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Usuarios activos:</span>
                      <span className="rrhh-stat-value">{reporteData.estadisticas.usuarios_activos || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Movimientos totales:</span>
                      <span className="rrhh-stat-value">{reporteData.estadisticas.movimientos_totales || 0}</span>
                    </div>
                    {reporteData.estadisticas.promedio_dias_completar && (
                      <div className="rrhh-stat-item">
                        <span className="rrhh-stat-label">Promedio días:</span>
                        <span className="rrhh-stat-value">{reporteData.estadisticas.promedio_dias_completar.toFixed(1)}</span>
                      </div>
                    )}
                    {reporteData.estadisticas.ordenes_por_dia && (
                      <div className="rrhh-stat-item">
                        <span className="rrhh-stat-label">Órdenes por día:</span>
                        <span className="rrhh-stat-value">{reporteData.estadisticas.ordenes_por_dia.toFixed(2)}</span>
                      </div>
                    )}
                    </div>
                    <ReportePieTorta
                      title="Órdenes por estado"
                      data={pieOrdenesPorEstado(reporteData.estadisticas)}
                      height={260}
                      outerRadius={92}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecursosHumanosReportesPage

