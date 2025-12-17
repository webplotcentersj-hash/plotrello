import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import './RecursosHumanosEstadisticasPage.css'

const SECTORES_DISPONIBLES = [
  'Taller Gráfico',
  'Instalaciones',
  'Taller de Imprenta',
  'Metalúrgica',
  'Diseño Gráfico',
  'Mostrador',
  'Compras'
]

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const RecursosHumanosEstadisticasPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'trimestre'>('mes')
  const [estadisticasUsuarios, setEstadisticasUsuarios] = useState<any[]>([])
  const [estadisticasSectores, setEstadisticasSectores] = useState<any[]>([])
  const [estadisticasPeriodo, setEstadisticasPeriodo] = useState<any>(null)

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadData()
  }, [periodo, canManageRecursosHumanos, navigate, authLoading])

  const getFechaDesde = () => {
    if (periodo === 'semana') {
      const hace7Dias = new Date()
      hace7Dias.setDate(hace7Dias.getDate() - 7)
      return hace7Dias.toISOString().split('T')[0]
    } else if (periodo === 'mes') {
      const haceUnMes = new Date()
      haceUnMes.setMonth(haceUnMes.getMonth() - 1)
      return haceUnMes.toISOString().split('T')[0]
    } else {
      const hace3Meses = new Date()
      hace3Meses.setMonth(hace3Meses.getMonth() - 3)
      return hace3Meses.toISOString().split('T')[0]
    }
  }

  const getFechaHasta = () => {
    return new Date().toISOString().split('T')[0]
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const fechaDesde = getFechaDesde()
      const fechaHasta = getFechaHasta()

      // Cargar usuarios
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        // Obtener estadísticas de todos los usuarios
        const statsPromises = usuariosResponse.data.map(async (usuario) => {
          const response = await apiService.getEstadisticasUsuario(
            usuario.id,
            fechaDesde,
            fechaHasta
          )
          return response.success && response.data ? response.data : null
        })

        const statsUsuarios = (await Promise.all(statsPromises)).filter(s => s !== null)
        setEstadisticasUsuarios(statsUsuarios)

        // Obtener estadísticas de todos los sectores
        const statsSectoresPromises = SECTORES_DISPONIBLES.map(async (sector) => {
          const response = await apiService.getEstadisticasSector(
            sector,
            fechaDesde,
            fechaHasta
          )
          return response.success && response.data ? { ...response.data, sector } : null
        })

        const statsSectores = (await Promise.all(statsSectoresPromises)).filter(s => s !== null)
        setEstadisticasSectores(statsSectores)

        // Obtener estadísticas generales del período
        const periodoResponse = await apiService.getEstadisticasPeriodo(fechaDesde, fechaHasta)
        if (periodoResponse.success && periodoResponse.data) {
          setEstadisticasPeriodo(periodoResponse.data)
        }
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Preparar datos para gráficos
  const datosProductividadUsuarios = estadisticasUsuarios
    .map(u => ({
      nombre: u.nombre_usuario || 'N/A',
      completadas: u.ordenes_completadas || 0,
      enProceso: u.ordenes_en_proceso || 0,
      total: u.total_ordenes || 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const datosProductividadSectores = estadisticasSectores.map((s, index) => ({
    sector: s.sector || 'N/A',
    completadas: s.ordenes_completadas || 0,
    enProceso: s.ordenes_en_proceso || 0,
    total: s.total_ordenes || 0,
    color: COLORS[index % COLORS.length]
  }))

  const datosDistribucionSectores = estadisticasSectores.map((s, index) => ({
    name: s.sector || 'N/A',
    value: s.total_ordenes || 0,
    color: COLORS[index % COLORS.length]
  }))

  const datosTasaCompletitud = estadisticasSectores
    .filter(s => s.tasa_completitud !== null && s.tasa_completitud !== undefined)
    .map((s, index) => ({
      sector: s.sector || 'N/A',
      tasa: parseFloat((s.tasa_completitud || 0).toFixed(1)),
      color: COLORS[index % COLORS.length]
    }))
    .sort((a, b) => b.tasa - a.tasa)

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
          <div className="rrhh-header-actions">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as 'semana' | 'mes' | 'trimestre')}
              className="rrhh-periodo-select"
            >
              <option value="semana">Última Semana</option>
              <option value="mes">Último Mes</option>
              <option value="trimestre">Último Trimestre</option>
            </select>
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-estadisticas-content">
        {/* Resumen general */}
        {estadisticasPeriodo && (
          <div className="rrhh-stats-summary">
            <div className="rrhh-summary-card">
              <h3>Total de Órdenes</h3>
              <p className="rrhh-summary-value">{estadisticasPeriodo.total_ordenes || 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Completadas</h3>
              <p className="rrhh-summary-value success">{estadisticasPeriodo.ordenes_completadas || 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>En Proceso</h3>
              <p className="rrhh-summary-value warning">{estadisticasPeriodo.ordenes_en_proceso || 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Usuarios Activos</h3>
              <p className="rrhh-summary-value">{estadisticasPeriodo.usuarios_activos || 0}</p>
            </div>
            {estadisticasPeriodo.ordenes_por_dia && (
              <div className="rrhh-summary-card">
                <h3>Órdenes por Día</h3>
                <p className="rrhh-summary-value">{estadisticasPeriodo.ordenes_por_dia.toFixed(1)}</p>
              </div>
            )}
          </div>
        )}

        {/* Gráfico de barras - Productividad por usuario */}
        {datosProductividadUsuarios.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Productividad por Usuario (Top 10)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={datosProductividadUsuarios}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completadas" fill="#10b981" name="Completadas" />
                <Bar dataKey="enProceso" fill="#f59e0b" name="En Proceso" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de barras - Productividad por sector */}
        {datosProductividadSectores.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Productividad por Sector</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={datosProductividadSectores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sector" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completadas" fill="#10b981" name="Completadas" />
                <Bar dataKey="enProceso" fill="#f59e0b" name="En Proceso" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de pastel - Distribución por sector */}
        {datosDistribucionSectores.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Distribución de Órdenes por Sector</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={datosDistribucionSectores}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {datosDistribucionSectores.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de barras - Tasa de completitud por sector */}
        {datosTasaCompletitud.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Tasa de Completitud por Sector (%)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={datosTasaCompletitud}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sector" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="tasa" fill="#3b82f6" name="Tasa de Completitud (%)">
                  {datosTasaCompletitud.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecursosHumanosEstadisticasPage

