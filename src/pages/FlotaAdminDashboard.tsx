import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type {
  RegistroSalidaVehiculo,
  ReservaVehiculoFlota,
  Vehiculo,
  VehiculoEstadoParque
} from '../types/api'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import { etiquetaEstadoParque } from '../utils/flotaVehiculosCatalogo'
import './FlotaAdminDashboard.css'

const OPCIONES_ESTADO_PARQUE: { value: VehiculoEstadoParque; label: string }[] = [
  { value: 'disponible', label: 'Disponible (puede salir)' },
  { value: 'fuera_servicio', label: 'Fuera de servicio' },
  { value: 'en_taller', label: 'En taller / mantenimiento' },
  { value: 'otro', label: 'Otro (detallar abajo)' }
]

const FlotaAdminDashboard = () => {
  const navigate = useNavigate()
  const { isAdmin, isCaja, usuario } = useAuth()
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
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [edits, setEdits] = useState<
    Record<number, { estado: VehiculoEstadoParque; detalle: string }>
  >({})
  const [loadingVehiculos, setLoadingVehiculos] = useState(false)
  const [savingVehiculoId, setSavingVehiculoId] = useState<number | null>(null)
  const [deletingVehiculoId, setDeletingVehiculoId] = useState<number | null>(null)
  const [errorVehiculos, setErrorVehiculos] = useState<string | null>(null)
  const [reservasPendientes, setReservasPendientes] = useState<ReservaVehiculoFlota[]>([])
  const [loadingReservas, setLoadingReservas] = useState(false)
  const [reservaAccionId, setReservaAccionId] = useState<number | null>(null)

  const loadReservasPendientes = useCallback(async () => {
    setLoadingReservas(true)
    try {
      const r = await apiService.getReservasVehiculosFlota({
        fechaDesde: '2000-01-01',
        fechaHasta: '2100-12-31',
        estado: 'pendiente_aprobacion'
      })
      if (r.success && r.data) setReservasPendientes(r.data)
      else setReservasPendientes([])
    } catch {
      setReservasPendientes([])
    } finally {
      setLoadingReservas(false)
    }
  }, [])

  const loadVehiculos = useCallback(async () => {
    setLoadingVehiculos(true)
    setErrorVehiculos(null)
    try {
      const r = await apiService.getVehiculos()
      if (r.success && r.data) {
        setVehiculos(r.data)
        setEdits(
          Object.fromEntries(
            r.data.map((v) => [
              v.id,
              {
                estado: (v.estado_parque ?? 'disponible') as VehiculoEstadoParque,
                detalle: v.estado_parque_detalle ?? ''
              }
            ])
          )
        )
      } else {
        setErrorVehiculos(r.error ?? 'No se pudieron cargar los vehículos')
      }
    } catch (e) {
      setErrorVehiculos(e instanceof Error ? e.message : 'Error al cargar vehículos')
    } finally {
      setLoadingVehiculos(false)
    }
  }, [])

  const guardarEstadoVehiculo = async (id: number) => {
    const row = edits[id]
    if (!row) return
    if (row.estado === 'otro' && !row.detalle.trim()) {
      alert('Si el estado es "Otro", completá el detalle (ej. motivo o hasta cuándo).')
      return
    }
    setSavingVehiculoId(id)
    try {
      const res = await apiService.actualizarVehiculoEstadoParque(id, row.estado, row.detalle)
      if (res.success) await loadVehiculos()
      else alert(res.error || 'No se pudo guardar')
    } finally {
      setSavingVehiculoId(null)
    }
  }

  const eliminarVehiculo = async (v: Vehiculo) => {
    const msg = [
      `¿Eliminar el vehículo «${v.nombre}»?`,
      '',
      'Se borrará también todo el historial de salidas asociado en la base de datos (no se puede deshacer).',
      'Si tiene una salida activa o una solicitud pendiente, el sistema no lo permitirá.'
    ].join('\n')
    if (!confirm(msg)) return
    setDeletingVehiculoId(v.id)
    try {
      const res = await apiService.eliminarVehiculo(v.id)
      if (res.success) await loadVehiculos()
      else alert(res.error || 'No se pudo eliminar')
    } finally {
      setDeletingVehiculoId(null)
    }
  }

  const aprobarReservaFlota = async (id: number) => {
    if (!usuario) {
      alert('No hay usuario en sesión.')
      return
    }
    if (!confirm('¿Aprobar esta reserva? Ese vehículo quedará asignado a esa persona para ese día.')) return
    setReservaAccionId(id)
    try {
      const res = await apiService.aprobarReservaVehiculoFlota(id, usuario.id, usuario.nombre || 'Caja/Admin')
      if (res.success) await loadReservasPendientes()
      else alert(res.error || 'No se pudo aprobar')
    } finally {
      setReservaAccionId(null)
    }
  }

  const rechazarReservaFlota = async (id: number) => {
    if (!usuario) {
      alert('No hay usuario en sesión.')
      return
    }
    if (!confirm('¿Rechazar esta solicitud de reserva?')) return
    setReservaAccionId(id)
    try {
      const res = await apiService.rechazarReservaVehiculoFlota(id, usuario.id, usuario.nombre || 'Caja/Admin')
      if (res.success) await loadReservasPendientes()
      else alert(res.error || 'No se pudo rechazar')
    } finally {
      setReservaAccionId(null)
    }
  }

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
    void loadVehiculos()
    void loadReservasPendientes()

    // Recargar cada 60 segundos
    const interval = setInterval(() => {
      void loadEstadisticas()
      void loadReservasPendientes()
      // No recargar vehículos en intervalo: evita pisar el formulario de estado si hay edición sin guardar
    }, 60000)

    return () => clearInterval(interval)
  }, [loadEstadisticas, loadVehiculos, loadReservasPendientes, isAdmin, isCaja, navigate])

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

        <section className="parque-section">
          <h2>Estado del parque (vehículos)</h2>
          <p className="parque-section-desc">
            Solo los vehículos en <strong>Disponible</strong> pueden recibir solicitudes de salida en la app. Si está
            fuera de servicio o en taller, elegí el estado y guardá.
          </p>
          {errorVehiculos && (
            <div className="parque-error" role="alert">
              {errorVehiculos}
              <span className="parque-error-hint">
                {' '}
                Si acabás de actualizar el código, ejecutá en Supabase los patches de flota (estado + borrado):{' '}
                <code>2026-04-02_flota_vehiculo_estado_parque.sql</code>, <code>2026-04-03_flota_vehiculos_delete_anon.sql</code>.
              </span>
            </div>
          )}
          {loadingVehiculos && vehiculos.length === 0 ? (
            <p>Cargando vehículos…</p>
          ) : (
            <div className="parque-table-wrap">
              <table className="parque-table">
                <thead>
                  <tr>
                    <th>Vehículo</th>
                    <th>Patente</th>
                    <th>Estado en parque</th>
                    <th>Detalle (si es &quot;Otro&quot;)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiculos.map((v) => {
                    const row = edits[v.id] ?? {
                      estado: (v.estado_parque ?? 'disponible') as VehiculoEstadoParque,
                      detalle: v.estado_parque_detalle ?? ''
                    }
                    return (
                      <tr key={v.id}>
                        <td>
                          <strong>{v.nombre}</strong>
                          <div className="parque-current-label">
                            En sistema: {etiquetaEstadoParque(v.estado_parque, v.estado_parque_detalle)}
                          </div>
                        </td>
                        <td>{v.patente ?? '—'}</td>
                        <td>
                          <select
                            className="parque-select"
                            value={row.estado}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [v.id]: {
                                  ...row,
                                  estado: e.target.value as VehiculoEstadoParque,
                                  detalle: e.target.value === 'otro' ? row.detalle : ''
                                }
                              }))
                            }
                          >
                            {OPCIONES_ESTADO_PARQUE.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="parque-input-detalle"
                            placeholder="Ej. revisión frenos hasta el 15/04"
                            value={row.detalle}
                            disabled={row.estado !== 'otro'}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [v.id]: { ...row, detalle: e.target.value }
                              }))
                            }
                          />
                        </td>
                        <td>
                          <div className="parque-actions-cell">
                            <button
                              type="button"
                              className="btn-primary btn-parque-save"
                              disabled={savingVehiculoId === v.id || deletingVehiculoId === v.id}
                              onClick={() => void guardarEstadoVehiculo(v.id)}
                            >
                              {savingVehiculoId === v.id ? 'Guardando…' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              className="btn-parque-delete"
                              disabled={savingVehiculoId === v.id || deletingVehiculoId === v.id}
                              onClick={() => void eliminarVehiculo(v)}
                            >
                              {deletingVehiculoId === v.id ? 'Borrando…' : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="parque-section flota-reservas-admin-section">
          <h2>Reservas de vehículos (pendientes de aprobación)</h2>
          <p className="parque-section-desc">
            Los usuarios piden día y vehículo desde <strong>Flota</strong>. Al aprobar, solo esa persona puede solicitar
            la salida ese día; el rechazo libera el cupo para otra solicitud.
          </p>
          {loadingReservas && reservasPendientes.length === 0 ? (
            <p>Cargando solicitudes…</p>
          ) : reservasPendientes.length === 0 ? (
            <p className="flota-reservas-admin-vacio">No hay reservas pendientes.</p>
          ) : (
            <div className="parque-table-wrap">
              <table className="parque-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Vehículo</th>
                    <th>Solicitante</th>
                    <th>Motivo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reservasPendientes.map((res) => (
                    <tr key={res.id}>
                      <td>{res.fecha}</td>
                      <td>
                        <strong>{res.vehiculo?.nombre ?? '—'}</strong>
                      </td>
                      <td>{etiquetaUsuarioNombre(res.nombre_usuario)}</td>
                      <td>{res.motivo?.trim() ? res.motivo : '—'}</td>
                      <td>
                        <div className="parque-actions-cell">
                          <button
                            type="button"
                            className="btn-primary btn-parque-save"
                            disabled={reservaAccionId != null}
                            onClick={() => void aprobarReservaFlota(res.id)}
                          >
                            {reservaAccionId === res.id ? '…' : 'Aprobar'}
                          </button>
                          <button
                            type="button"
                            className="btn-parque-delete"
                            disabled={reservaAccionId != null}
                            onClick={() => void rechazarReservaFlota(res.id)}
                          >
                            {reservaAccionId === res.id ? '…' : 'Rechazar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
                        <span className="info-value">{etiquetaUsuarioNombre(registro.nombre_usuario)}</span>
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

