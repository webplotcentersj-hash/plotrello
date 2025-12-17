import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RecursosHumanosEstadisticasPage.css'

const RecursosHumanosEstadisticasPage = () => {
  const navigate = useNavigate()
  const { usuario, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
        
        // Calcular estadísticas avanzadas
        setStats({
          totalUsuarios: usuariosResponse.data.length,
          usuariosPorRol: {},
          actividadPromedio: 0,
          productividad: {}
        })
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rrhh-estadisticas-loading">
        <div className="spinner"></div>
        <p>Cargando estadísticas...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-estadisticas-page">
      <header className="rrhh-estadisticas-header">
        <div className="rrhh-header-content">
          <h1>📈 Estadísticas Avanzadas</h1>
          <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <div className="rrhh-estadisticas-content">
        <div className="rrhh-stats-grid">
          <div className="rrhh-stat-card-large">
            <h3>Análisis de Productividad</h3>
            <p>Gráficos y métricas de productividad por usuario y sector</p>
          </div>

          <div className="rrhh-stat-card-large">
            <h3>Horas Trabajadas</h3>
            <p>Tracking de horas trabajadas por usuario y período</p>
          </div>

          <div className="rrhh-stat-card-large">
            <h3>Asistencia</h3>
            <p>Registro de asistencia y ausencias</p>
          </div>

          <div className="rrhh-stat-card-large">
            <h3>Rendimiento</h3>
            <p>Métricas de rendimiento y eficiencia</p>
          </div>
        </div>

        <div className="rrhh-info-box">
          <p>📊 Esta sección mostrará estadísticas avanzadas de personal, productividad, horas trabajadas y asistencia.</p>
          <p>Próximamente: Gráficos interactivos, comparativas, y análisis predictivo.</p>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosEstadisticasPage

