import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PlatformPageViewRow, PlatformSessionRow } from '../types/api'
import './AdminActividadUsuariosPage.css'

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoYmd(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function deviceSummary(info: Record<string, unknown> | null | undefined): string {
  if (!info) return '—'
  const parts: string[] = []
  if (info.platform) parts.push(String(info.platform))
  if (info.touch) parts.push('touch')
  if (info.screenWidth && info.screenHeight) {
    parts.push(`${info.screenWidth}×${info.screenHeight}`)
  }
  if (info.timezone) parts.push(String(info.timezone))
  if (info.language) parts.push(String(info.language))
  const conn = info.connection as { effectiveType?: string } | null
  if (conn?.effectiveType) parts.push(conn.effectiveType)
  return parts.length ? parts.join(' · ') : '—'
}

export default function AdminActividadUsuariosPage() {
  const navigate = useNavigate()
  const { usuario, isAdmin, isGerencia, loading: authLoading } = useAuth()
  const allowed = isAdmin || isGerencia

  const [fechaDesde, setFechaDesde] = useState(() => daysAgoYmd(7))
  const [fechaHasta, setFechaHasta] = useState(() => todayYmd())
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sesiones, setSesiones] = useState<PlatformSessionRow[]>([])
  const [selected, setSelected] = useState<PlatformSessionRow | null>(null)
  const [vistas, setVistas] = useState<PlatformPageViewRow[]>([])
  const [vistasLoading, setVistasLoading] = useState(false)

  const load = useCallback(async () => {
    if (!usuario?.id || !allowed) return
    setLoading(true)
    setError(null)
    try {
      const desde = fechaDesde ? `${fechaDesde}T00:00:00.000Z` : null
      const hasta = fechaHasta ? `${fechaHasta}T23:59:59.999Z` : null
      const res = await apiService.listarSesionesPlataforma({
        solicitanteId: usuario.id,
        fechaDesde: desde,
        fechaHasta: hasta,
        limit: 300
      })
      if (!res.success) {
        setError(res.error || 'No se pudieron cargar las sesiones')
        setSesiones([])
        return
      }
      setSesiones(res.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
      setSesiones([])
    } finally {
      setLoading(false)
    }
  }, [usuario?.id, allowed, fechaDesde, fechaHasta])

  useEffect(() => {
    if (authLoading) return
    if (!allowed) {
      navigate('/admin', { replace: true })
      return
    }
    void load()
  }, [authLoading, allowed, navigate, load])

  const filtered = useMemo(() => {
    const q = filtroUsuario.trim().toLowerCase()
    if (!q) return sesiones
    return sesiones.filter(
      (s) =>
        s.nombre_usuario?.toLowerCase().includes(q) ||
        s.rol_usuario?.toLowerCase().includes(q) ||
        String(s.usuario_id).includes(q)
    )
  }, [sesiones, filtroUsuario])

  const openSession = async (s: PlatformSessionRow) => {
    setSelected(s)
    if (!usuario?.id) return
    setVistasLoading(true)
    try {
      const res = await apiService.listarVistasSesionPlataforma(usuario.id, s.id)
      setVistas(res.success && res.data ? res.data : [])
    } finally {
      setVistasLoading(false)
    }
  }

  if (authLoading || !allowed) {
    return (
      <div className="admin-actividad-page">
        <p className="admin-actividad-hint">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="admin-actividad-page">
      <header className="admin-actividad-header">
        <div>
          <button type="button" className="admin-actividad-back" onClick={() => navigate('/admin')}>
            ← Admin
          </button>
          <h1>Actividad de usuarios</h1>
          <p>Quién abrió Plot Lab, desde qué dispositivo y qué pantallas visitó.</p>
        </div>
        <button type="button" className="admin-actividad-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      <div className="admin-actividad-filters">
        <label>
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
        <label className="admin-actividad-search">
          Buscar usuario
          <input
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            placeholder="Nombre, rol o ID"
          />
        </label>
      </div>

      {error && <p className="admin-actividad-error">{error}</p>}

      <div className="admin-actividad-layout">
        <section className="admin-actividad-list">
          <h2>
            Sesiones <span>({filtered.length})</span>
          </h2>
          {loading && sesiones.length === 0 ? (
            <p className="admin-actividad-hint">Cargando sesiones…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-actividad-hint">No hay sesiones en el rango elegido.</p>
          ) : (
            <ul>
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={selected?.id === s.id ? 'is-active' : undefined}
                    onClick={() => void openSession(s)}
                  >
                    <div className="admin-actividad-row-top">
                      <strong>{s.nombre_usuario}</strong>
                      <span className="admin-actividad-rol">{s.rol_usuario}</span>
                      {!s.ended_at ? <span className="admin-actividad-live">Activa</span> : null}
                    </div>
                    <div className="admin-actividad-row-meta">
                      <span>{fmtDateTime(s.started_at)}</span>
                      <span>{fmtDuration(s.duracion_segundos)}</span>
                      <span>{s.page_view_count} pantallas</span>
                    </div>
                    <div className="admin-actividad-row-device">{deviceSummary(s.device_info)}</div>
                    {s.entry_path ? (
                      <div className="admin-actividad-path">Entró en {s.entry_path}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-actividad-detail">
          {!selected ? (
            <p className="admin-actividad-hint">Elegí una sesión para ver el detalle.</p>
          ) : (
            <>
              <h2>
                {selected.nombre_usuario} · {fmtDateTime(selected.started_at)}
              </h2>
              <dl className="admin-actividad-dl">
                <div>
                  <dt>Usuario</dt>
                  <dd>
                    #{selected.usuario_id} · {selected.rol_usuario}
                  </dd>
                </div>
                <div>
                  <dt>Inicio</dt>
                  <dd>{fmtDateTime(selected.started_at)}</dd>
                </div>
                <div>
                  <dt>Última actividad</dt>
                  <dd>{fmtDateTime(selected.last_seen_at)}</dd>
                </div>
                <div>
                  <dt>Cierre</dt>
                  <dd>{selected.ended_at ? fmtDateTime(selected.ended_at) : 'Sesión abierta'}</dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{fmtDuration(selected.duracion_segundos)}</dd>
                </div>
                <div>
                  <dt>IP</dt>
                  <dd>{selected.ip_address || '—'}</dd>
                </div>
                <div>
                  <dt>User-Agent</dt>
                  <dd className="admin-actividad-ua">{selected.user_agent || '—'}</dd>
                </div>
                <div>
                  <dt>Dispositivo</dt>
                  <dd>{deviceSummary(selected.device_info)}</dd>
                </div>
                <div>
                  <dt>Detalle técnico</dt>
                  <dd>
                    <pre className="admin-actividad-json">
                      {JSON.stringify(selected.device_info || {}, null, 2)}
                    </pre>
                  </dd>
                </div>
              </dl>

              <h3>Pantallas abiertas</h3>
              {vistasLoading ? (
                <p className="admin-actividad-hint">Cargando…</p>
              ) : vistas.length === 0 ? (
                <p className="admin-actividad-hint">Sin navegación registrada.</p>
              ) : (
                <ol className="admin-actividad-views">
                  {vistas.map((v) => (
                    <li key={v.id}>
                      <time dateTime={v.viewed_at}>{fmtDateTime(v.viewed_at)}</time>
                      <code>{v.path}</code>
                      {v.title ? <span className="admin-actividad-title">{v.title}</span> : null}
                      {v.viewport_w && v.viewport_h ? (
                        <span className="admin-actividad-vp">
                          {v.viewport_w}×{v.viewport_h}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
