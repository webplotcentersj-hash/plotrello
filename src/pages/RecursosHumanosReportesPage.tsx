import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RecursosHumanosReportesPage.css'

const RecursosHumanosReportesPage = () => {
  const navigate = useNavigate()
  const { usuario, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [reporteTipo, setReporteTipo] = useState<'usuario' | 'sector' | 'periodo'>('usuario')
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string>('todos')
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [reporteData, setReporteData] = useState<any>(null)

  useEffect(() => {
    loadUsuarios()
  }, [])

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
    setLoading(true)
    try {
      // Aquí implementarías la lógica para generar reportes
      // Por ahora simulamos datos
      setReporteData({
        tipo: reporteTipo,
        periodo: { desde: fechaDesde, hasta: fechaHasta },
        datos: []
      })
    } catch (error) {
      console.error('Error generando reporte:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportarPDF = () => {
    // Implementar exportación a PDF
    alert('Función de exportación a PDF próximamente')
  }

  const exportarExcel = () => {
    // Implementar exportación a Excel
    alert('Función de exportación a Excel próximamente')
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
              <p>Aquí se mostrarán los resultados del reporte...</p>
              {/* Aquí irían los datos del reporte */}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecursosHumanosReportesPage

