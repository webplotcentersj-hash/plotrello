import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { RrhhSolicitudHe, RrhhSolicitudHeTipo } from '../types/api'
import { fechaCortaEs } from '../utils/rrhhLiquidacion'
import { nombreSinDominioCorreo } from '../utils/userDisplayName'
import './RecursosHumanosPermisosPage.css'
import './RecursosHumanosHorasExtraPage.css'

function tipoLabel(tipo: RrhhSolicitudHeTipo) {
  return tipo === 'horas_extra_100' ? 'HE 100%' : 'HE 50%'
}

const RecursosHumanosHorasExtraPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<RrhhSolicitudHe[]>([])
  const [nombres, setNombres] = useState<Map<number, string>>(new Map())
  const [estado, setEstado] = useState<string>('pendiente')
  const [seleccionada, setSeleccionada] = useState<RrhhSolicitudHe | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deepLinkDone = useRef(false)

  const canAccess = !!usuario && canManageRecursosHumanos

  const load = useCallback(async () => {
    const [res, legRes] = await Promise.all([
      apiService.rrhhSolicitudesHeListar({
        estado: estado || null
      }),
      apiService.obtenerLegajosBasico()
    ])
    if (res.success && res.data) setSolicitudes(res.data)
    if (legRes.success && legRes.data) {
      const map = new Map<number, string>()
      for (const [id, row] of Object.entries(legRes.data)) {
        const n = `${row.nombre || ''} ${row.apellido || ''}`.trim()
        map.set(Number(id), nombreSinDominioCorreo(n) || n || `Usuario ${id}`)
      }
      setNombres(map)
    }
  }, [estado])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/horas-extra')
      return
    }
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [authLoading, canAccess, navigate, load])

  useEffect(() => {
    if (deepLinkDone.current || loading) return
    const id = Number(searchParams.get('solicitud') || 0)
    if (!Number.isFinite(id) || id <= 0) return
    const found = solicitudes.find((s) => s.id === id)
    if (found) {
      deepLinkDone.current = true
      setSeleccionada(found)
      return
    }
    void (async () => {
      const res = await apiService.rrhhSolicitudesHeListar({})
      const match = res.data?.find((s) => s.id === id)
      if (match) {
        setEstado('')
        setSeleccionada(match)
      }
      deepLinkDone.current = true
    })()
  }, [searchParams, solicitudes, loading])

  const nombreDe = (s: RrhhSolicitudHe) =>
    nombres.get(s.id_usuario) || nombreSinDominioCorreo(s.nombre_usuario || '') || `Usuario ${s.id_usuario}`

  const pendientes = useMemo(
    () => solicitudes.filter((s) => s.estado === 'pendiente').length,
    [solicitudes]
  )

  const aprobar = async (s: RrhhSolicitudHe) => {
    if (!usuario?.id) return
    if (s.id_usuario === usuario.id) {
      setError('No podés aprobar tu propia declaración. Que lo haga otro RRHH/admin.')
      return
    }
    if (!confirm(`¿Aprobar ${s.horas} h de ${nombreDe(s)} el ${fechaCortaEs(s.fecha)}? Entran en liquidación.`)) {
      return
    }
    setBusy(true)
    setError(null)
    const r = await apiService.rrhhSolicitudHeAprobarRechazar({
      id: s.id,
      estado: 'aprobado',
      idAprobador: usuario.id
    })
    setBusy(false)
    if (!r.success) {
      setError(r.error || 'No se pudo aprobar')
      return
    }
    setSeleccionada(null)
    void load()
  }

  const rechazar = async (s: RrhhSolicitudHe) => {
    if (!usuario?.id) return
    if (s.id_usuario === usuario.id) {
      setError('No podés rechazar tu propia declaración.')
      return
    }
    if (!motivoRechazo.trim()) {
      setError('Escribí el motivo del rechazo.')
      return
    }
    setBusy(true)
    setError(null)
    const r = await apiService.rrhhSolicitudHeAprobarRechazar({
      id: s.id,
      estado: 'rechazado',
      idAprobador: usuario.id,
      motivoRechazo: motivoRechazo.trim()
    })
    setBusy(false)
    if (!r.success) {
      setError(r.error || 'No se pudo rechazar')
      return
    }
    setMotivoRechazo('')
    setSeleccionada(null)
    void load()
  }

  if (authLoading || loading) {
    return (
      <div className="rrhh-permisos-loading">
        <div className="spinner" />
        <p>Cargando horas extra…</p>
      </div>
    )
  }

  return (
    <div className="rrhh-permisos-page rrhh-he-page">
      <header className="rrhh-permisos-header">
        <div className="rrhh-header-content">
          <div>
            <h1>Horas extra declaradas</h1>
            <p className="rrhh-permisos-subtitle">
              Aprobá o rechazá una por una. Si se aprueba, se suma a la liquidación (además de lo marcado en el
              reloj). {pendientes} pendiente{pendientes === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="rrhh-permisos-header-actions">
            <button type="button" className="btn-pedir-permiso" onClick={() => navigate('/horas-extra')}>
              Cargar las mías
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/rrhh')}>
              Volver
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-permisos-content">
        <div className="rrhh-filters-section">
          <label>
            Estado
            <select
              className="rrhh-filter-select"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="pendiente">Pendientes</option>
              <option value="">Todas</option>
              <option value="aprobado">Aprobadas</option>
              <option value="rechazado">Rechazadas</option>
              <option value="cancelado">Canceladas</option>
            </select>
          </label>
        </div>

        {error ? <p className="rrhh-he-error">{error}</p> : null}

        <div className="rrhh-solicitudes-list">
          {solicitudes.map((s) => {
            const sel = seleccionada?.id === s.id
            return (
              <article
                key={s.id}
                className={`rrhh-solicitud-card ${sel ? 'is-selected' : ''} estado-${s.estado}`}
                onClick={() => {
                  setSeleccionada(s)
                  setMotivoRechazo('')
                  setError(null)
                }}
              >
                <div className="rrhh-solicitud-header">
                  <h3>{nombreDe(s)}</h3>
                  <span className={`rrhh-estado-badge ${s.estado}`}>{s.estado}</span>
                </div>
                <p>
                  <strong>
                    {fechaCortaEs(s.fecha)} · {s.horas} h · {tipoLabel(s.tipo)}
                  </strong>
                </p>
                <p className="rrhh-solicitud-descripcion">{s.observaciones}</p>
                {s.adjuntos.length > 0 ? (
                  <p className="rrhh-he-adj-count">{s.adjuntos.length} adjunto(s)</p>
                ) : (
                  <p className="rrhh-solicitud-sin-adjunto">Sin fotos</p>
                )}
              </article>
            )
          })}
          {solicitudes.length === 0 ? <p>No hay declaraciones con este filtro.</p> : null}
        </div>

        {seleccionada ? (
          <aside className="rrhh-he-detalle" aria-label="Detalle de horas extra">
            <h2>{nombreDe(seleccionada)}</h2>
            <p>
              {fechaCortaEs(seleccionada.fecha)} · {seleccionada.horas} h · {tipoLabel(seleccionada.tipo)}
            </p>
            <p>{seleccionada.observaciones}</p>
            {seleccionada.adjuntos.length > 0 ? (
              <div className="rrhh-he-fotos">
                {seleccionada.adjuntos.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                    {/image\//i.test(a.mime) || /\.(png|jpe?g|webp|gif|heic)(\?|$)/i.test(a.url) ? (
                      <img src={a.url} alt={a.nombre} />
                    ) : (
                      a.nombre
                    )}
                  </a>
                ))}
              </div>
            ) : null}
            {seleccionada.motivo_rechazo ? (
              <p className="rrhh-solicitud-rechazo">
                <strong>Rechazo:</strong> {seleccionada.motivo_rechazo}
              </p>
            ) : null}
            {seleccionada.estado === 'pendiente' && seleccionada.id_usuario === usuario?.id ? (
              <p className="rrhh-solicitud-propia-hint">Tu declaración · la aprueba otro RRHH/admin.</p>
            ) : null}
            {seleccionada.estado === 'pendiente' && seleccionada.id_usuario !== usuario?.id ? (
              <div className="rrhh-he-acciones">
                <button type="button" className="btn-success" disabled={busy} onClick={() => void aprobar(seleccionada)}>
                  Aprobar (entra en liquidación)
                </button>
                <label>
                  Motivo si rechazás
                  <textarea
                    rows={2}
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    placeholder="Ej. ya está en el reloj / falta comprobante…"
                  />
                </label>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={() => void rechazar(seleccionada)}
                >
                  Rechazar
                </button>
              </div>
            ) : null}
            {seleccionada.estado === 'aprobado' ? (
              <p className="rrhh-he-ok">Aprobada · ya suma en el cierre del mes.</p>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

export default RecursosHumanosHorasExtraPage
