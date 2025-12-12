import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './ImpresorasPage.css'

type ImpresoraOcupacion = {
  id: number
  nombre: string
  modelo: string | null
  estado_impresora: string
  capacidad_maxima_horas_dia: number
  horas_usadas_hoy: number
  horas_usadas_semana: number
  porcentaje_ocupacion_hoy: number
  porcentaje_ocupacion_semana: number
  trabajos_activos: number
  metros_cuadrados_hoy?: number
  metros_cuadrados_semana?: number
  metros_cuadrados_totales?: number
}

type HistorialEstado = {
  id: number
  id_impresora: number
  estado_anterior: string | null
  estado_nuevo: string
  motivo: string | null
  usuario_id: number | null
  usuario_nombre: string | null
  created_at: string
}

type TrabajoActivo = {
  uso_id: number
  id_impresora: number
  id_orden: number
  fecha_inicio: string
  operario: string | null
  nombre_impresora: string
  numero_op: string
  cliente: string
  descripcion: string
  metros_cuadrados?: number | null
}

const ImpresorasPage = () => {
  const navigate = useNavigate()
  const { loading: authLoading, usuario, canManageImpresoras } = useAuth()
  const [impresoras, setImpresoras] = useState<ImpresoraOcupacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Estados para modales
  const [selectedImpresora, setSelectedImpresora] = useState<ImpresoraOcupacion | null>(null)
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [showHistorialModal, setShowHistorialModal] = useState(false)
  const [showTrabajosModal, setShowTrabajosModal] = useState(false)
  const [showGestionModal, setShowGestionModal] = useState(false)
  const [historial, setHistorial] = useState<HistorialEstado[]>([])
  const [trabajosActivos, setTrabajosActivos] = useState<TrabajoActivo[]>([])
  const [nuevoEstado, setNuevoEstado] = useState<string>('Disponible')
  const [motivoCambio, setMotivoCambio] = useState('')
  const [loadingAction, setLoadingAction] = useState(false)
  
  // Estados para gestión CRUD
  const [todasImpresoras, setTodasImpresoras] = useState<any[]>([])
  const [showCrearModal, setShowCrearModal] = useState(false)
  const [showEditarModal, setShowEditarModal] = useState(false)
  const [impresoraEditando, setImpresoraEditando] = useState<any>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formModelo, setFormModelo] = useState('')
  const [formCapacidad, setFormCapacidad] = useState('24')

  const loadData = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const response = await apiService.getImpresorasOcupacion()
      if (response.success && response.data) {
        setImpresoras(response.data as ImpresoraOcupacion[])
      } else {
        setError(response.error || 'No se pudieron cargar los datos de impresoras')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadTodasImpresoras = async () => {
    try {
      const response = await apiService.getImpresoras(true) // Incluir inactivas
      if (response.success && response.data) {
        setTodasImpresoras(response.data as any[])
      }
    } catch (err) {
      console.error('Error al cargar impresoras:', err)
    }
  }

  const handleCrearImpresora = async () => {
    if (!formNombre.trim()) {
      setError('El nombre de la impresora es requerido')
      return
    }

    setLoadingAction(true)
    try {
      const response = await apiService.crearImpresora(
        formNombre.trim(),
        formModelo.trim() || undefined,
        parseFloat(formCapacidad) || 24.0
      )

      if (response.success) {
        setShowCrearModal(false)
        setFormNombre('')
        setFormModelo('')
        setFormCapacidad('24')
        void loadData()
        void loadTodasImpresoras()
      } else {
        setError(response.error || 'Error al crear la impresora')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleEditarImpresora = async () => {
    if (!impresoraEditando || !formNombre.trim()) {
      setError('El nombre de la impresora es requerido')
      return
    }

    setLoadingAction(true)
    try {
      const response = await apiService.actualizarImpresora(impresoraEditando.id, {
        nombre: formNombre.trim(),
        modelo: formModelo.trim() || undefined,
        capacidad_maxima_horas_dia: parseFloat(formCapacidad) || 24.0,
        activa: true
      })

      if (response.success) {
        setShowEditarModal(false)
        setImpresoraEditando(null)
        setFormNombre('')
        setFormModelo('')
        setFormCapacidad('24')
        void loadData()
        void loadTodasImpresoras()
      } else {
        setError(response.error || 'Error al actualizar la impresora')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleEliminarImpresora = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta impresora? Esta acción no se puede deshacer.')) {
      return
    }

    setLoadingAction(true)
    try {
      const response = await apiService.eliminarImpresora(id)

      if (response.success) {
        void loadData()
        void loadTodasImpresoras()
      } else {
        setError(response.error || 'Error al eliminar la impresora')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingAction(false)
    }
  }

  const abrirEditarModal = (impresora: any) => {
    setImpresoraEditando(impresora)
    setFormNombre(impresora.nombre)
    setFormModelo(impresora.modelo || '')
    setFormCapacidad(impresora.capacidad_maxima_horas_dia?.toString() || '24')
    setShowEditarModal(true)
  }

  useEffect(() => {
    if (!authLoading) {
      void loadData()
      if (canManageImpresoras) {
        void loadTodasImpresoras()
      }
    }
  }, [authLoading, canManageImpresoras])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      void loadData()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const getColorByPorcentaje = (porcentaje: number): string => {
    if (porcentaje >= 90) return '#ef4444' // Rojo - Muy ocupada
    if (porcentaje >= 70) return '#f97316' // Naranja - Ocupada
    if (porcentaje >= 50) return '#eab308' // Amarillo - Moderada
    if (porcentaje >= 30) return '#3b82f6' // Azul - Poco ocupada
    return '#22c55e' // Verde - Disponible
  }

  const getColorByEstado = (estado: string): string => {
    switch (estado) {
      case 'Disponible':
        return '#22c55e'
      case 'En Uso':
        return '#3b82f6'
      case 'Mantenimiento':
        return '#f97316'
      case 'Fuera de Servicio':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const handleCambiarEstado = async () => {
    if (!selectedImpresora || !canManageImpresoras) {
      setError('Solo los usuarios de Taller Gráfico o Administración pueden cambiar el estado de las impresoras')
      return
    }

    setLoadingAction(true)
    try {
      const response = await apiService.cambiarEstadoImpresora(
        selectedImpresora.id,
        nuevoEstado as 'Disponible' | 'En Uso' | 'Mantenimiento' | 'Fuera de Servicio',
        motivoCambio || undefined,
        usuario?.id,
        usuario?.nombre
      )

      if (response.success) {
        setShowEstadoModal(false)
        setMotivoCambio('')
        void loadData()
      } else {
        setError(response.error || 'Error al cambiar el estado')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleVerHistorial = async (impresora: ImpresoraOcupacion) => {
    setSelectedImpresora(impresora)
    setLoadingAction(true)
    try {
      const response = await apiService.getHistorialImpresora(impresora.id)
      if (response.success && response.data) {
        setHistorial(response.data as HistorialEstado[])
        setShowHistorialModal(true)
      } else {
        setError(response.error || 'Error al cargar el historial')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleVerTrabajos = async (impresora: ImpresoraOcupacion) => {
    setSelectedImpresora(impresora)
    setLoadingAction(true)
    try {
      const response = await apiService.getTrabajosActivosImpresora(impresora.id)
      if (response.success && response.data) {
        setTrabajosActivos(response.data as TrabajoActivo[])
        setShowTrabajosModal(true)
      } else {
        setError(response.error || 'Error al cargar los trabajos activos')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingAction(false)
    }
  }

  const chartData = impresoras.map((imp) => ({
    nombre: imp.nombre,
    'Hoy': parseFloat(imp.porcentaje_ocupacion_hoy.toFixed(2)),
    'Esta Semana': parseFloat(imp.porcentaje_ocupacion_semana.toFixed(2)),
    color: getColorByPorcentaje(imp.porcentaje_ocupacion_hoy)
  }))

  if (authLoading || loading) {
    return (
      <div className="impresoras-page">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  // Todos los usuarios pueden ver, solo taller-grafico puede administrar

  return (
    <div className="impresoras-page">
      <header className="impresoras-header">
        <div className="impresoras-header-content">
          <div className="impresoras-header-brand">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
              className="impresoras-logo"
            />
            <button className="back-button" onClick={() => navigate('/')}>
              ← Volver al Tablero
            </button>
          </div>
          <div className="impresoras-header-title">
            <h1>Estado de Impresoras</h1>
            <div style={{ display: 'flex', gap: '10px' }}>
              {canManageImpresoras && (
                <>
                  <button
                    className="refresh-button"
                    onClick={() => setShowGestionModal(true)}
                    style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.5)', color: '#10b981' }}
                  >
                    ⚙️ Gestionar
                  </button>
                  <div style={{ 
                    padding: '8px 16px', 
                    background: 'rgba(59, 130, 246, 0.2)', 
                    border: '1px solid rgba(59, 130, 246, 0.5)', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#60a5fa'
                  }}>
                    🔧 Modo Administración
                  </div>
                </>
              )}
              <button
                className="refresh-button"
                onClick={() => void loadData()}
                disabled={refreshing}
              >
                {refreshing ? '🔄 Actualizando...' : '🔄 Actualizar'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
          <button onClick={() => setError(null)} style={{ marginTop: '10px', padding: '5px 10px' }}>
            Cerrar
          </button>
        </div>
      )}

      <div className="impresoras-container">
        {/* Gráfico de barras comparativo */}
        <div className="impresoras-card full-width">
          <h3>Porcentaje de Ocupación</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} label={{ value: 'Porcentaje (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  labelFormatter={(label) => `Impresora: ${label}`}
                />
                <Legend />
                <Bar dataKey="Hoy" fill="#3b82f6" name="Hoy" />
                <Bar dataKey="Esta Semana" fill="#8b5cf6" name="Esta Semana" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              No hay datos de impresoras disponibles
            </div>
          )}
        </div>

        {/* Tarjetas individuales de impresoras */}
        <div className="impresoras-grid">
          {impresoras.map((impresora) => (
            <div key={impresora.id} className="impresora-card">
              <div className="impresora-card-header">
                <h4>{impresora.nombre}</h4>
                <span
                  className="estado-badge"
                  style={{
                    backgroundColor: getColorByEstado(impresora.estado_impresora)
                  }}
                >
                  {impresora.estado_impresora}
                </span>
              </div>

              {impresora.modelo && (
                <p className="impresora-modelo">Modelo: {impresora.modelo}</p>
              )}

              <div className="impresora-stats">
                <div className="stat-item">
                  <div className="stat-label">Ocupación Hoy</div>
                  <div className="stat-value">
                    <div
                      className="progress-bar"
                      style={{
                        width: '100%',
                        height: '24px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, impresora.porcentaje_ocupacion_hoy)}%`,
                          height: '100%',
                          backgroundColor: getColorByPorcentaje(impresora.porcentaje_ocupacion_hoy),
                          transition: 'width 0.3s ease'
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: impresora.porcentaje_ocupacion_hoy > 50 ? '#fff' : '#000',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                      >
                        {impresora.porcentaje_ocupacion_hoy.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="stat-detail">
                    {impresora.horas_usadas_hoy.toFixed(2)}h / {impresora.capacidad_maxima_horas_dia}h
                  </div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">Ocupación Esta Semana</div>
                  <div className="stat-value">
                    <div
                      className="progress-bar"
                      style={{
                        width: '100%',
                        height: '24px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, impresora.porcentaje_ocupacion_semana)}%`,
                          height: '100%',
                          backgroundColor: getColorByPorcentaje(impresora.porcentaje_ocupacion_semana),
                          transition: 'width 0.3s ease'
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: impresora.porcentaje_ocupacion_semana > 50 ? '#fff' : '#000',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                      >
                        {impresora.porcentaje_ocupacion_semana.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="stat-detail">
                    {impresora.horas_usadas_semana.toFixed(2)}h / {(impresora.capacidad_maxima_horas_dia * 7).toFixed(2)}h
                  </div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">Trabajos Activos</div>
                  <div className="stat-value-large">{impresora.trabajos_activos}</div>
                </div>

                {/* Metros cuadrados impresos */}
                {(impresora.metros_cuadrados_hoy !== undefined || impresora.metros_cuadrados_semana !== undefined) && (
                  <>
                    <div className="stat-item">
                      <div className="stat-label">Metros² Impresos Hoy</div>
                      <div className="stat-value-large" style={{ color: '#10b981' }}>
                        {impresora.metros_cuadrados_hoy?.toFixed(2) || '0.00'} m²
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Metros² Esta Semana</div>
                      <div className="stat-value" style={{ color: '#60a5fa', fontSize: '18px' }}>
                        {impresora.metros_cuadrados_semana?.toFixed(2) || '0.00'} m²
                      </div>
                    </div>
                    {impresora.metros_cuadrados_totales !== undefined && impresora.metros_cuadrados_totales > 0 && (
                      <div className="stat-item">
                        <div className="stat-label">Metros² Totales</div>
                        <div className="stat-value" style={{ color: '#8b5cf6', fontSize: '16px' }}>
                          {impresora.metros_cuadrados_totales.toFixed(2)} m²
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Botones de acción */}
              <div className="impresora-actions">
                {canManageImpresoras ? (
                  <>
                    <button
                      className="action-button"
                      onClick={() => {
                        setSelectedImpresora(impresora)
                        setNuevoEstado(impresora.estado_impresora)
                        setShowEstadoModal(true)
                      }}
                    >
                      🔄 Cambiar Estado
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleVerHistorial(impresora)}
                    >
                      📋 Historial
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleVerTrabajos(impresora)}
                    >
                      📊 Trabajos Activos
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="action-button"
                      onClick={() => handleVerHistorial(impresora)}
                      style={{ opacity: 0.8 }}
                    >
                      📋 Ver Historial
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleVerTrabajos(impresora)}
                      style={{ opacity: 0.8 }}
                    >
                      📊 Ver Trabajos Activos
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {impresoras.length === 0 && !error && (
          <div className="no-data-message">
            <p>No hay impresoras registradas en el sistema.</p>
            <p>Contacta al administrador para agregar impresoras.</p>
          </div>
        )}
      </div>

      {/* Modal para cambiar estado - Solo para taller-grafico y administracion */}
      {showEstadoModal && selectedImpresora && canManageImpresoras && (
        <div className="modal-overlay" onClick={() => setShowEstadoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Cambiar Estado: {selectedImpresora.nombre}</h2>
            <div className="modal-form">
              <label>
                Estado Actual:
                <span style={{ marginLeft: '10px', color: getColorByEstado(selectedImpresora.estado_impresora) }}>
                  {selectedImpresora.estado_impresora}
                </span>
              </label>
              <label>
                Nuevo Estado:
                <select
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px' }}
                >
                  <option value="Disponible">Disponible</option>
                  <option value="En Uso">En Uso</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Fuera de Servicio">Fuera de Servicio</option>
                </select>
              </label>
              <label>
                Motivo (opcional):
                <textarea
                  value={motivoCambio}
                  onChange={(e) => setMotivoCambio(e.target.value)}
                  placeholder="Describe el motivo del cambio de estado..."
                  style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px', minHeight: '80px' }}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowEstadoModal(false)} className="cancel-button">
                Cancelar
              </button>
              <button onClick={handleCambiarEstado} className="confirm-button" disabled={loadingAction}>
                {loadingAction ? 'Guardando...' : 'Confirmar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para historial */}
      {showHistorialModal && selectedImpresora && (
        <div className="modal-overlay" onClick={() => setShowHistorialModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <h2>Historial de Cambios: {selectedImpresora.nombre}</h2>
            <div className="historial-list">
              {historial.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Estado Anterior</th>
                      <th>Estado Nuevo</th>
                      <th>Usuario</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.created_at).toLocaleString('es-AR')}</td>
                        <td>{item.estado_anterior || '-'}</td>
                        <td>
                          <span style={{ color: getColorByEstado(item.estado_nuevo) }}>
                            {item.estado_nuevo}
                          </span>
                        </td>
                        <td>{item.usuario_nombre || '-'}</td>
                        <td>{item.motivo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No hay historial de cambios registrado.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowHistorialModal(false)} className="confirm-button">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para trabajos activos */}
      {showTrabajosModal && selectedImpresora && (
        <div className="modal-overlay" onClick={() => setShowTrabajosModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <h2>Trabajos Activos: {selectedImpresora.nombre}</h2>
            <div className="trabajos-list">
              {trabajosActivos.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>OP</th>
                      <th>Cliente</th>
                      <th>Descripción</th>
                      <th>Metros²</th>
                      <th>Operario</th>
                      <th>Inicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trabajosActivos.map((trabajo) => (
                      <tr key={trabajo.uso_id}>
                        <td>{trabajo.numero_op}</td>
                        <td>{trabajo.cliente}</td>
                        <td>{trabajo.descripcion}</td>
                        <td>
                          {trabajo.metros_cuadrados ? (
                            <span style={{ color: '#10b981', fontWeight: '600' }}>
                              {trabajo.metros_cuadrados.toFixed(2)} m²
                            </span>
                          ) : (
                            <span style={{ color: '#6b7280', fontStyle: 'italic' }}>-</span>
                          )}
                        </td>
                        <td>{trabajo.operario || '-'}</td>
                        <td>{new Date(trabajo.fecha_inicio).toLocaleString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No hay trabajos activos en esta impresora.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowTrabajosModal(false)} className="confirm-button">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para gestión (CRUD) - Solo para taller-grafico y administracion */}
      {showGestionModal && canManageImpresoras && (
        <div className="modal-overlay" onClick={() => setShowGestionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh' }}>
            <h2>Gestión de Impresoras</h2>
            
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setFormNombre('')
                  setFormModelo('')
                  setFormCapacidad('24')
                  setFormEstado('Disponible')
                  setShowCrearModal(true)
                }}
                className="confirm-button"
                style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.5)', color: '#10b981' }}
              >
                ➕ Crear Nueva Impresora
              </button>
              <button onClick={() => void loadTodasImpresoras()} className="refresh-button" style={{ fontSize: '12px', padding: '6px 12px' }}>
                🔄 Actualizar
              </button>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Modelo</th>
                    <th>Estado</th>
                    <th>Capacidad (h/día)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {todasImpresoras.map((imp) => (
                    <tr key={imp.id}>
                      <td>{imp.nombre}</td>
                      <td>{imp.modelo || '-'}</td>
                      <td>
                        <span style={{ color: getColorByEstado(imp.estado) }}>
                          {imp.estado}
                        </span>
                      </td>
                      <td>{imp.capacidad_maxima_horas_dia}h</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => abrirEditarModal(imp)}
                            className="action-button"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleEliminarImpresora(imp.id)}
                            className="action-button"
                            style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fca5a5' }}
                            disabled={loadingAction}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {todasImpresoras.length === 0 && (
                <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No hay impresoras registradas.
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowGestionModal(false)} className="confirm-button">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear impresora */}
      {showCrearModal && (
        <div className="modal-overlay" onClick={() => setShowCrearModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Crear Nueva Impresora</h2>
            <div className="modal-form">
              <label>
                Nombre *:
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Mimaki 130"
                  style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px' }}
                />
              </label>
              <label>
                Modelo:
                <input
                  type="text"
                  value={formModelo}
                  onChange={(e) => setFormModelo(e.target.value)}
                  placeholder="Ej: Plotter de Corte"
                  style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px' }}
                />
              </label>
              <label>
                Capacidad Máxima (horas/día):
                <input
                  type="number"
                  value={formCapacidad}
                  onChange={(e) => setFormCapacidad(e.target.value)}
                  min="1"
                  max="24"
                  step="0.5"
                  style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px' }}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowCrearModal(false)} className="cancel-button">
                Cancelar
              </button>
              <button onClick={handleCrearImpresora} className="confirm-button" disabled={loadingAction}>
                {loadingAction ? 'Creando...' : 'Crear Impresora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar impresora */}
      {showEditarModal && impresoraEditando && (
        <div className="modal-overlay" onClick={() => setShowEditarModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Editar Impresora: {impresoraEditando.nombre}</h2>
            <div className="modal-form">
              <label>
                Nombre *:
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px' }}
                />
              </label>
              <label>
                Modelo:
                <input
                  type="text"
                  value={formModelo}
                  onChange={(e) => setFormModelo(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px' }}
                />
              </label>
              <label>
                Capacidad Máxima (horas/día):
                <input
                  type="number"
                  value={formCapacidad}
                  onChange={(e) => setFormCapacidad(e.target.value)}
                  min="1"
                  max="24"
                  step="0.5"
                  style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px' }}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowEditarModal(false)} className="cancel-button">
                Cancelar
              </button>
              <button onClick={handleEditarImpresora} className="confirm-button" disabled={loadingAction}>
                {loadingAction ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImpresorasPage
