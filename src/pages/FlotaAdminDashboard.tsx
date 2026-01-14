import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { RegistroSalidaVehiculo } from '../types/api'
import './FlotaAdminDashboard.css'

const FlotaAdminDashboard = () => {
  const navigate = useNavigate()
  const { isAdmin, isCaja } = useAuth()
  const [estadisticas, setEstadisticas] = useState<{
    total_salidas: number
    vehiculos_en_uso: number
    vehiculos_retrasados: number
    distancia_total_km: number
    tiempo_promedio_horas: number
    registros_retrasados: RegistroSalidaVehiculo[]
  } | null>(null)
  const [registrosRetrasados, setRegistrosRetrasados] = useState<RegistroSalidaVehiculo[]>([])
  const [fechaDesde, setFechaDesde] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  )
  const [fechaHasta, setFechaHasta] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [loading, setLoading] = useState(true)

  const loadEstadisticas = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiService.getEstadisticasFlota(fechaDesde, fechaHasta)
      if (response.success && response.data) {
        setEstadisticas(response.data)
        setRegistrosRetrasados(response.data.registros_retrasados)
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => {
    if (!isAdmin && !isCaja) {
      navigate('/flota')
      return
    }
    void loadEstadisticas()
    
    // Recargar cada 60 segundos
    const interval = setInterval(() => {
      void loadEstadisticas()
    }, 60000)

    return () => clearInterval(interval)
  }, [loadEstadisticas, isAdmin, isCaja, navigate])

  if (!isAdmin && !isCaja) {
    return null
  }

  if (loading) {
    return (
      <div className="flota-admin-page">
        <div style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div className="flota-admin-page">
      <div className="flota-admin-container">
        <header className="flota-admin-header">
          <div>
            <h1>Panel de Administración - Flota</h1>
            <p>Estadísticas y gestión de vehículos</p>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/flota')}>
            ← Volver a Flota
          </button>
        </header>

        {/* Filtros de Fecha */}
        <section className="filtros-section">
          <h2>Filtros</h2>
          <div className="filtros-row">
            <div className="form-group">
              <label>Fecha Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Fecha Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={loadEstadisticas}>
              Aplicar Filtros
            </button>
          </div>
        </section>

        {/* Estadísticas */}
        {estadisticas && (
          <section className="estadisticas-section">
            <h2>Estadísticas</h2>
            <div className="estadisticas-grid">
              <div className="stat-card">
                <div className="stat-icon">🚗</div>
                <div className="stat-content">
                  <div className="stat-label">Total Salidas</div>
                  <div className="stat-value">{estadisticas.total_salidas}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <div className="stat-label">Vehículos en Uso</div>
                  <div className="stat-value">{estadisticas.vehiculos_en_uso}</div>
                </div>
              </div>
              <div className="stat-card retrasados">
                <div className="stat-icon">⚠️</div>
                <div className="stat-content">
                  <div className="stat-label">Vehículos Retrasados</div>
                  <div className="stat-value">{estadisticas.vehiculos_retrasados}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📏</div>
                <div className="stat-content">
                  <div className="stat-label">Distancia Total</div>
                  <div className="stat-value">{estadisticas.distancia_total_km.toLocaleString()} km</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <div className="stat-label">Tiempo Promedio</div>
                  <div className="stat-value">{estadisticas.tiempo_promedio_horas.toFixed(1)} h</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Registros Retrasados */}
        {registrosRetrasados.length > 0 && (
          <section className="retrasados-section">
            <h2 style={{ color: '#ef4444' }}>⚠️ Vehículos Retrasados</h2>
            <div className="retrasados-list">
              {registrosRetrasados.map((registro) => {
                const horaEstimada = registro.hora_estimada_llegada 
                  ? new Date(registro.hora_estimada_llegada)
                  : null
                const ahora = new Date()
                const minutosRetraso = horaEstimada
                  ? Math.floor((ahora.getTime() - horaEstimada.getTime()) / (1000 * 60))
                  : 0

                return (
                  <div key={registro.id} className="retrasado-card">
                    <div className="retrasado-header">
                      <h3>{registro.vehiculo?.nombre || 'Vehículo'}</h3>
                      <span className="retraso-badge">
                        {minutosRetraso > 60 
                          ? `${Math.floor(minutosRetraso / 60)}h ${minutosRetraso % 60}m`
                          : `${minutosRetraso}m`
                        } de retraso
                      </span>
                    </div>
                    <div className="retrasado-info">
                      <div className="info-row">
                        <span className="info-label">Operario:</span>
                        <span className="info-value">{registro.nombre_usuario}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Sector:</span>
                        <span className="info-value">{registro.sector}</span>
                      </div>
                      {registro.numero_op && (
                        <div className="info-row">
                          <span className="info-label">OP:</span>
                          <span className="info-value">{registro.numero_op}</span>
                        </div>
                      )}
                      {horaEstimada && (
                        <div className="info-row">
                          <span className="info-label">Llegada estimada:</span>
                          <span className="info-value retrasado-text">
                            {horaEstimada.toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {registro.ubicacion_destino && (
                        <div className="info-row">
                          <span className="info-label">Destino:</span>
                          <span className="info-value">{registro.ubicacion_destino}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default FlotaAdminDashboard

