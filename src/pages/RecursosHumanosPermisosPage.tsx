import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { SolicitudPermiso } from '../types/api'
import './RecursosHumanosPermisosPage.css'

const RecursosHumanosPermisosPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<SolicitudPermiso[]>([])
  const [filtros, setFiltros] = useState({
    estado: 'pendiente' as string | null,
    tipo: null as string | null,
    fechaDesde: null as string | null,
    fechaHasta: null as string | null
  })
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudPermiso | null>(null)
  const [mostrarModalAprobar, setMostrarModalAprobar] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const deepLinkDone = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadSolicitudes()
    setLoading(false)
  }, [canManageRecursosHumanos, navigate, authLoading, filtros])

  useEffect(() => {
    if (deepLinkDone.current || loading) return
    const raw = searchParams.get('solicitud')
    const id = raw ? Number(raw) : NaN
    if (!Number.isFinite(id) || id <= 0) return

    const openMatch = (match: SolicitudPermiso) => {
      deepLinkDone.current = true
      setSolicitudSeleccionada(match)
      setMostrarModalAprobar(true)
    }

    const found = solicitudes.find((s) => s.id === id)
    if (found) {
      openMatch(found)
      return
    }

    void (async () => {
      const res = await apiService.obtenerSolicitudesPermisos(null, null, null, null, null)
      const match = res.data?.find((s) => s.id === id)
      if (match) {
        setFiltros((f) => (f.estado === null ? f : { ...f, estado: null }))
        openMatch(match)
      } else {
        deepLinkDone.current = true
      }
    })()
  }, [searchParams, solicitudes, loading])

  const loadSolicitudes = async () => {
    const response = await apiService.obtenerSolicitudesPermisos(
      null, // Todas las solicitudes
      filtros.estado,
      filtros.tipo,
      filtros.fechaDesde,
      filtros.fechaHasta
    )

    if (response.success && response.data) {
      setSolicitudes(response.data)
    }
  }

  const handleAprobar = async (solicitud: SolicitudPermiso) => {
    if (!usuario?.id) return

    const response = await apiService.aprobarRechazarSolicitud(
      solicitud.id,
      'aprobado',
      usuario.id,
      null,
      null
    )

    if (response.success) {
      if (solicitud.tipo_solicitud === 'vacaciones') {
        try {
          const { calcularSaldoVacaciones, diasEnAnio } = await import('../utils/rrhhVacacionesSaldo')
          const anio = new Date().getFullYear()
          const yearStart = `${anio}-01-01`
          const yearEnd = `${anio}-12-31`
          const [legRes, solRes, novRes, ajRes] = await Promise.all([
            apiService.obtenerLegajosBasico(),
            apiService.obtenerSolicitudesPermisos(solicitud.id_usuario, 'aprobado', 'vacaciones'),
            apiService.rrhhNovedadesListar({
              idUsuario: solicitud.id_usuario,
              codigo: 'licencia_vacaciones',
              fechaDesde: yearStart,
              fechaHasta: yearEnd
            }),
            apiService.rrhhVacacionesAjustesListar({ idUsuario: solicitud.id_usuario, anio })
          ])
          const ingreso = legRes.data?.[solicitud.id_usuario]?.fecha_ingreso ?? null
          const saldo = calcularSaldoVacaciones({
            idUsuario: solicitud.id_usuario,
            nombre: '',
            fechaIngreso: ingreso,
            anio,
            solicitudes: solRes.success && solRes.data ? solRes.data : [],
            novedades: novRes.success && novRes.data ? novRes.data : [],
            ajustes: ajRes.success && ajRes.data ? ajRes.data : []
          })
          const diasPedido =
            solicitud.dias_solicitados != null && solicitud.dias_solicitados > 0
              ? Number(solicitud.dias_solicitados)
              : solicitud.fecha_inicio && solicitud.fecha_fin
                ? diasEnAnio(solicitud.fecha_inicio, solicitud.fecha_fin, anio)
                : 0
          alert(
            `Vacaciones aprobadas (${diasPedido} días). Saldo estimado ${anio}: ${saldo.saldo} días restantes.`
          )
        } catch {
          /* aviso opcional */
        }
      }
      loadSolicitudes()
      setMostrarModalAprobar(false)
      setSolicitudSeleccionada(null)
    } else {
      alert('Error al aprobar solicitud: ' + response.error)
    }
  }

  const handleRechazar = async () => {
    if (!usuario?.id || !solicitudSeleccionada) return

    if (!motivoRechazo.trim()) {
      alert('Por favor, ingresa un motivo de rechazo')
      return
    }

    const response = await apiService.aprobarRechazarSolicitud(
      solicitudSeleccionada.id,
      'rechazado',
      usuario.id,
      motivoRechazo,
      null
    )

    if (response.success) {
      loadSolicitudes()
      setMostrarModalAprobar(false)
      setSolicitudSeleccionada(null)
      setMotivoRechazo('')
    } else {
      alert('Error al rechazar solicitud: ' + response.error)
    }
  }

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta solicitud?')) return

    const response = await apiService.eliminarSolicitud(id)
    if (response.success) {
      loadSolicitudes()
    } else {
      alert('Error al eliminar solicitud: ' + response.error)
    }
  }

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      turno: '🕐',
      ausencia: '❌',
      vacaciones: '🏖️',
      ropa: '👕',
      permiso: '✅',
      otro: '📝'
    }
    return icons[tipo] || '📋'
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      pendiente: { class: 'badge-pendiente', text: 'Pendiente' },
      aprobado: { class: 'badge-aprobado', text: 'Aprobado' },
      rechazado: { class: 'badge-rechazado', text: 'Rechazado' },
      cancelado: { class: 'badge-cancelado', text: 'Cancelado' }
    }
    return badges[estado] || { class: '', text: estado }
  }

  if (loading) {
    return (
      <div className="rrhh-permisos-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-permisos-page">
      <header className="rrhh-permisos-header">
        <div className="rrhh-header-content">
          <h1>📋 Gestión de Solicitudes y Permisos</h1>
          <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <div className="rrhh-permisos-content">
        {/* Filtros */}
        <div className="rrhh-filters-section">
          <select
            className="rrhh-filter-select"
            value={filtros.estado || ''}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value || null })}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            className="rrhh-filter-select"
            value={filtros.tipo || ''}
            onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value || null })}
          >
            <option value="">Todos los tipos</option>
            <option value="turno">Turno</option>
            <option value="ausencia">Ausencia</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="ropa">Ropa</option>
            <option value="permiso">Permiso</option>
            <option value="otro">Otro</option>
          </select>

          <input
            type="date"
            className="rrhh-date-input"
            value={filtros.fechaDesde || ''}
            onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value || null })}
            placeholder="Fecha desde"
          />

          <input
            type="date"
            className="rrhh-date-input"
            value={filtros.fechaHasta || ''}
            onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value || null })}
            placeholder="Fecha hasta"
          />
        </div>

        {/* Lista de solicitudes */}
        <div className="rrhh-solicitudes-list">
          {solicitudes.length === 0 ? (
            <div className="rrhh-info-box">
              <p>No hay solicitudes que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            solicitudes.map(solicitud => {
              const estadoBadge = getEstadoBadge(solicitud.estado)
              return (
                <div key={solicitud.id} className="rrhh-solicitud-card">
                  <div className="rrhh-solicitud-info">
                    <div className="rrhh-solicitud-header">
                      <span className="rrhh-solicitud-icon">{getTipoIcon(solicitud.tipo_solicitud)}</span>
                      <h3>{solicitud.titulo}</h3>
                      <span className={`rrhh-badge ${estadoBadge.class}`}>
                        {estadoBadge.text}
                      </span>
                    </div>
                    <p className="rrhh-solicitud-usuario">
                      <strong>Usuario:</strong> {solicitud.nombre_usuario || 'N/A'}
                    </p>
                    <p className="rrhh-solicitud-tipo">
                      <strong>Tipo:</strong> {solicitud.tipo_solicitud}
                    </p>
                    {solicitud.descripcion && (
                      <p className="rrhh-solicitud-descripcion">{solicitud.descripcion}</p>
                    )}
                    {solicitud.fecha_inicio && solicitud.fecha_fin && (
                      <p className="rrhh-solicitud-fechas">
                        <strong>Período:</strong> {new Date(solicitud.fecha_inicio).toLocaleDateString()} - {new Date(solicitud.fecha_fin).toLocaleDateString()}
                        {solicitud.dias_solicitados && ` (${solicitud.dias_solicitados} días)`}
                      </p>
                    )}
                    {solicitud.aprobado_por_nombre && (
                      <p className="rrhh-solicitud-aprobador">
                        <strong>Aprobado por:</strong> {solicitud.aprobado_por_nombre}
                        {solicitud.fecha_aprobacion && ` el ${new Date(solicitud.fecha_aprobacion).toLocaleDateString()}`}
                      </p>
                    )}
                    {solicitud.motivo_rechazo && (
                      <p className="rrhh-solicitud-rechazo">
                        <strong>Motivo de rechazo:</strong> {solicitud.motivo_rechazo}
                      </p>
                    )}
                    {solicitud.observaciones && (
                      <p className="rrhh-solicitud-observaciones">
                        <strong>Ubicación / observaciones:</strong> {solicitud.observaciones}
                      </p>
                    )}
                    {solicitud.archivo_adjunto_url ? (
                      <div className="rrhh-solicitud-adjunto">
                        <strong>📎 Certificado / adjunto</strong>
                        <div className="rrhh-solicitud-adjunto-actions">
                          <a
                            className="btn-adjunto"
                            href={solicitud.archivo_adjunto_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir PDF / foto
                          </a>
                          {/\.(png|jpe?g|webp|gif|heic)(\?|$)/i.test(solicitud.archivo_adjunto_url) ||
                          /image/i.test(solicitud.archivo_adjunto_url) ? (
                            <a
                              href={solicitud.archivo_adjunto_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rrhh-solicitud-adjunto-preview-link"
                            >
                              <img
                                src={solicitud.archivo_adjunto_url}
                                alt="Certificado adjunto"
                                className="rrhh-solicitud-adjunto-preview"
                              />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="rrhh-solicitud-sin-adjunto">Sin certificado adjunto</p>
                    )}
                    <p className="rrhh-solicitud-fecha">
                      <strong>Fecha de solicitud:</strong> {new Date(solicitud.fecha_solicitud).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="rrhh-solicitud-actions">
                    {solicitud.estado === 'pendiente' && (
                      <>
                        <button
                          className="btn-success"
                          onClick={() => handleAprobar(solicitud)}
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => {
                            setSolicitudSeleccionada(solicitud)
                            setMostrarModalAprobar(true)
                          }}
                        >
                          ❌ Rechazar
                        </button>
                      </>
                    )}
                    <button
                      className="btn-danger"
                      onClick={() => handleEliminar(solicitud.id)}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal para rechazar */}
      {mostrarModalAprobar && solicitudSeleccionada && (
        <div className="rrhh-modal-overlay" onClick={() => {
          setMostrarModalAprobar(false)
          setSolicitudSeleccionada(null)
          setMotivoRechazo('')
        }}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Rechazar Solicitud</h2>
            <div className="form-group">
              <label>Motivo de rechazo *</label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Ingresa el motivo del rechazo..."
                rows={4}
                required
              />
            </div>
            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setMostrarModalAprobar(false)
                  setSolicitudSeleccionada(null)
                  setMotivoRechazo('')
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={handleRechazar}
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosPermisosPage
