import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { Vehiculo, RegistroSalidaVehiculo } from '../types/api'
import RegistroSalidaModal from '../components/RegistroSalidaModal'
import './FlotaPage.css'

const FlotaPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isCaja } = useAuth()
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [registrosActivos, setRegistrosActivos] = useState<RegistroSalidaVehiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [showRegistroModal, setShowRegistroModal] = useState(false)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Actualizar estados retrasados antes de cargar datos
      await apiService.actualizarEstadosRetrasados()
      
      const [vehiculosResp, registrosResp] = await Promise.all([
        apiService.getVehiculos(),
        apiService.getRegistrosSalidasVehiculos({ estado: 'en_uso' })
      ])

      if (vehiculosResp.success && vehiculosResp.data) {
        setVehiculos(vehiculosResp.data)
      }

      if (registrosResp.success && registrosResp.data) {
        // Incluir también los retrasados
        const retrasadosResp = await apiService.getRegistrosSalidasVehiculos({ estado: 'retrasado' })
        const todosActivos = [
          ...registrosResp.data,
          ...(retrasadosResp.success && retrasadosResp.data ? retrasadosResp.data : [])
        ]
        setRegistrosActivos(todosActivos)
      }
    } catch (error) {
      console.error('Error cargando datos de flota:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
    
    // Recargar cada 30 segundos para ver cambios en tiempo real
    const interval = setInterval(() => {
      void loadData()
    }, 30000)

    return () => clearInterval(interval)
  }, [loadData])

  const handleRegistrarSalida = (vehiculo: Vehiculo) => {
    setVehiculoSeleccionado(vehiculo)
    setShowRegistroModal(true)
  }

  const handleFinalizarSalida = async (idRegistro: number) => {
    if (!confirm('¿Confirmar que el vehículo ha regresado?')) return

    const response = await apiService.finalizarRegistroSalidaVehiculo(idRegistro)
    if (response.success) {
      await loadData()
    } else {
      alert('Error al finalizar el registro: ' + response.error)
    }
  }

  const getEstadoVehiculo = (vehiculo: Vehiculo) => {
    const registro = registrosActivos.find(r => r.id_vehiculo === vehiculo.id)
    if (!registro) return { estado: 'disponible', registro: null }
    
    const ahora = new Date()
    const horaEstimada = registro.hora_estimada_llegada ? new Date(registro.hora_estimada_llegada) : null
    const retrasado = horaEstimada && ahora > horaEstimada && !registro.hora_llegada_real
    
    return {
      estado: retrasado ? 'retrasado' : 'en_uso',
      registro
    }
  }

  if (loading) {
    return (
      <div className="flota-page">
        <div className="flota-container">
          <div style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flota-page">
      <div className="flota-container">
        <header className="flota-header">
          <div>
            <h1>Gestión de Flota</h1>
            <p>Estado de vehículos en tiempo real</p>
          </div>
          <div className="flota-header-actions">
            <button className="btn-secondary" onClick={() => navigate('/')}>
              ← Volver al Tablero
            </button>
            {(isAdmin || isCaja) && (
              <button 
                className="btn-primary" 
                onClick={() => navigate('/flota/admin')}
              >
                📊 Panel de Administración
              </button>
            )}
          </div>
        </header>

        {/* Mapa de Vehículos */}
        <section className="flota-mapa-section">
          <h2>Estado de Vehículos</h2>
          <div className="vehiculos-grid">
            {vehiculos.map((vehiculo) => {
              const { estado, registro } = getEstadoVehiculo(vehiculo)
              const estaRetrasado = estado === 'retrasado'
              
              return (
                <div 
                  key={vehiculo.id} 
                  className={`vehiculo-card ${estado} ${estaRetrasado ? 'retrasado' : ''}`}
                >
                  <div className="vehiculo-header">
                    <h3>{vehiculo.nombre}</h3>
                    <span className={`estado-badge ${estado}`}>
                      {estado === 'disponible' && '✓ Disponible'}
                      {estado === 'en_uso' && '🚗 En Uso'}
                      {estado === 'retrasado' && '⚠️ Retrasado'}
                    </span>
                  </div>

                  {registro && (
                    <div className="vehiculo-info">
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
                      {registro.hora_estimada_llegada && (
                        <div className="info-row">
                          <span className="info-label">Llegada estimada:</span>
                          <span className={`info-value ${estaRetrasado ? 'retrasado-text' : ''}`}>
                            {new Date(registro.hora_estimada_llegada).toLocaleTimeString('es-AR', {
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
                      {registro.latitud && registro.longitud && (
                        <div className="info-row">
                          <a
                            href={`https://www.google.com/maps?q=${registro.latitud},${registro.longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="map-link"
                          >
                            📍 Ver en Mapa
                          </a>
                        </div>
                      )}
                      {estaRetrasado && (
                        <div className="retrasado-alert">
                          ⚠️ El vehículo se ha retrasado
                        </div>
                      )}
                    </div>
                  )}

                  <div className="vehiculo-actions">
                    {estado === 'disponible' ? (
                      <button
                        className="btn-primary"
                        onClick={() => handleRegistrarSalida(vehiculo)}
                      >
                        Registrar Salida
                      </button>
                    ) : (
                      registro && (
                        <button
                          className="btn-secondary"
                          onClick={() => handleFinalizarSalida(registro.id)}
                        >
                          Finalizar Salida
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {showRegistroModal && vehiculoSeleccionado && (
        <RegistroSalidaModal
          vehiculo={vehiculoSeleccionado}
          onClose={() => {
            setShowRegistroModal(false)
            setVehiculoSeleccionado(null)
          }}
          onSuccess={async () => {
            await loadData()
            setShowRegistroModal(false)
            setVehiculoSeleccionado(null)
          }}
        />
      )}
    </div>
  )
}

export default FlotaPage

