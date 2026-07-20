import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PlatformPageViewRow, PlatformSessionRow } from '../types/api'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import {
  argentinaRangeBounds,
  argentinaYmd,
  explainDevice,
  explainLocation,
  explainSessionNatural,
  extractGeo,
  fmtDateTimeAr,
  fmtDurationEs,
  type GeoInfo
} from '../utils/platformActivityExplain'
import './AdminActividadUsuariosPage.css'

type Preset = 'hoy' | 'ayer' | '7d' | '30d' | 'custom'

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function boundsForPreset(preset: Preset, desde: string, hasta: string) {
  const hoy = argentinaYmd()
  if (preset === 'hoy') return argentinaRangeBounds(hoy, hoy)
  if (preset === 'ayer') {
    const ayer = shiftYmd(hoy, -1)
    return argentinaRangeBounds(ayer, ayer)
  }
  if (preset === '7d') return argentinaRangeBounds(shiftYmd(hoy, -6), hoy)
  if (preset === '30d') return argentinaRangeBounds(shiftYmd(hoy, -29), hoy)
  return argentinaRangeBounds(desde, hasta)
}

export default function AdminActividadUsuariosPage() {
  const navigate = useNavigate()
  const { usuario, isAdmin, isGerencia, loading: authLoading } = useAuth()
  const allowed = isAdmin || isGerencia

  const hoy = argentinaYmd()
  const [preset, setPreset] = useState<Preset>('hoy')
  const [fechaDesde, setFechaDesde] = useState(hoy)
  const [fechaHasta, setFechaHasta] = useState(hoy)
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sesiones, setSesiones] = useState<PlatformSessionRow[]>([])
  const [selected, setSelected] = useState<PlatformSessionRow | null>(null)
  const [vistas, setVistas] = useState<PlatformPageViewRow[]>([])
  const [vistasLoading, setVistasLoading] = useState(false)
  const [geoExtra, setGeoExtra] = useState<GeoInfo | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const h = argentinaYmd()
    if (p === 'hoy') {
      setFechaDesde(h)
      setFechaHasta(h)
    } else if (p === 'ayer') {
      const a = shiftYmd(h, -1)
      setFechaDesde(a)
      setFechaHasta(a)
    } else if (p === '7d') {
      setFechaDesde(shiftYmd(h, -6))
      setFechaHasta(h)
    } else if (p === '30d') {
      setFechaDesde(shiftYmd(h, -29))
      setFechaHasta(h)
    }
  }

  const load = useCallback(async () => {
    if (!usuario?.id || !allowed) return
    setLoading(true)
    setError(null)
    try {
      const { desdeIso, hastaIso } = boundsForPreset(preset, fechaDesde, fechaHasta)
      const res = await apiService.listarSesionesPlataforma({
        solicitanteId: usuario.id,
        fechaDesde: desdeIso,
        fechaHasta: hastaIso,
        limit: 400
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
  }, [usuario?.id, allowed, preset, fechaDesde, fechaHasta])

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
        String(s.usuario_id).includes(q) ||
        (s.ip_address || '').includes(q)
    )
  }, [sesiones, filtroUsuario])

  const resolveGeoIfNeeded = async (s: PlatformSessionRow) => {
    const existing = extractGeo(s.device_info)
    if (existing?.city || existing?.country) {
      setGeoExtra(existing)
      return
    }
    if (!s.ip_address) {
      setGeoExtra(null)
      return
    }
    setGeoLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      const res = await plotLabFetch('/api/auth/platform-activity', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'resolve-geo',
          clientSessionId: s.client_session_id,
          ip: s.ip_address
        })
      })
      const j = (await res.json().catch(() => null)) as { geo?: GeoInfo } | null
      setGeoExtra(j?.geo || null)
    } catch {
      setGeoExtra(null)
    } finally {
      setGeoLoading(false)
    }
  }

  const openSession = async (s: PlatformSessionRow) => {
    setSelected(s)
    setGeoExtra(extractGeo(s.device_info))
    void resolveGeoIfNeeded(s)
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

  const geoForSelected =
    geoExtra || (selected ? extractGeo(selected.device_info) : null)

  return (
    <div className="admin-actividad-page">
      <header className="admin-actividad-header">
        <div>
          <button type="button" className="admin-actividad-back" onClick={() => navigate('/admin')}>
            ← Admin
          </button>
          <h1>Actividad de usuarios</h1>
          <p>
            Quién entró a Plot Lab, desde dónde (IP + ciudad), con qué dispositivo y a qué hora
            (Argentina).
          </p>
        </div>
        <button type="button" className="admin-actividad-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      <div className="admin-actividad-presets" role="group" aria-label="Rango rápido">
        {(
          [
            ['hoy', 'Hoy'],
            ['ayer', 'Ayer'],
            ['7d', 'Últimos 7 días'],
            ['30d', 'Últimos 30 días'],
            ['custom', 'Personalizado']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={preset === id ? 'is-active' : undefined}
            onClick={() => applyPreset(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="admin-actividad-filters">
        <label>
          Desde (día Argentina)
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => {
              setPreset('custom')
              setFechaDesde(e.target.value)
            }}
          />
        </label>
        <label>
          Hasta (día Argentina)
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => {
              setPreset('custom')
              setFechaHasta(e.target.value)
            }}
          />
        </label>
        <label className="admin-actividad-search">
          Buscar (nombre, rol, IP)
          <input
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            placeholder="Ej: admin, mostrador, 181.21…"
          />
        </label>
      </div>

      {error && <p className="admin-actividad-error">{error}</p>}

      <div className="admin-actividad-layout">
        <section className="admin-actividad-list">
          <h2>
            Ingresos <span>({filtered.length})</span>
          </h2>
          {loading && sesiones.length === 0 ? (
            <p className="admin-actividad-hint">Cargando sesiones…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-actividad-hint">
              No hay ingresos en este rango. Probá “Últimos 7 días” o “Hoy”.
            </p>
          ) : (
            <ul>
              {filtered.map((s) => {
                const geo = extractGeo(s.device_info)
                const lugar =
                  [geo?.city, geo?.region, geo?.country].filter(Boolean).join(', ') ||
                  s.ip_address ||
                  'Sin ubicación'
                return (
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
                        <span>{fmtDateTimeAr(s.started_at)}</span>
                        <span>{fmtDurationEs(s.duracion_segundos)}</span>
                        <span>{s.page_view_count} pantallas</span>
                      </div>
                      <div className="admin-actividad-row-device">📍 {lugar}</div>
                      <div className="admin-actividad-path">
                        {explainDevice(s.device_info, s.user_agent)}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="admin-actividad-detail">
          {!selected ? (
            <p className="admin-actividad-hint">Elegí un ingreso a la izquierda para ver el detalle.</p>
          ) : (
            <>
              <h2>
                {selected.nombre_usuario} · {fmtDateTimeAr(selected.started_at)}
              </h2>

              <div className="admin-actividad-natural">
                <h3>Resumen en claro</h3>
                <p>
                  {explainSessionNatural({
                    nombre: selected.nombre_usuario,
                    startedAt: selected.started_at,
                    endedAt: selected.ended_at,
                    lastSeenAt: selected.last_seen_at,
                    durationSec: selected.duracion_segundos,
                    ip: selected.ip_address,
                    userAgent: selected.user_agent,
                    deviceInfo: {
                      ...(selected.device_info || {}),
                      ...(geoForSelected ? { geo: geoForSelected } : {})
                    },
                    entryPath: selected.entry_path,
                    pageViews: selected.page_view_count
                  })}
                </p>
                {geoLoading ? <p className="admin-actividad-hint">Buscando ubicación por IP…</p> : null}
              </div>

              <dl className="admin-actividad-dl">
                <div>
                  <dt>Usuario</dt>
                  <dd>
                    #{selected.usuario_id} · {selected.nombre_usuario} ({selected.rol_usuario})
                  </dd>
                </div>
                <div>
                  <dt>Hora de ingreso</dt>
                  <dd>{fmtDateTimeAr(selected.started_at)} · Argentina</dd>
                </div>
                <div>
                  <dt>Última actividad</dt>
                  <dd>{fmtDateTimeAr(selected.last_seen_at)}</dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{fmtDurationEs(selected.duracion_segundos)}</dd>
                </div>
                <div>
                  <dt>IP pública real</dt>
                  <dd className="admin-actividad-ip">
                    {selected.ip_address || 'No capturada (sesión sin pasar por el servidor)'}
                  </dd>
                </div>
                <div>
                  <dt>De dónde entra</dt>
                  <dd>
                    {explainLocation(geoForSelected, selected.ip_address)}
                    {geoForSelected?.lat != null && geoForSelected?.lon != null ? (
                      <>
                        {' '}
                        <a
                          href={`https://www.google.com/maps?q=${geoForSelected.lat},${geoForSelected.lon}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver en mapa
                        </a>
                      </>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Dispositivo</dt>
                  <dd>{explainDevice(selected.device_info, selected.user_agent)}</dd>
                </div>
                <div>
                  <dt>User-Agent</dt>
                  <dd className="admin-actividad-ua">{selected.user_agent || '—'}</dd>
                </div>
              </dl>

              <h3>Pantallas que abrió</h3>
              {vistasLoading ? (
                <p className="admin-actividad-hint">Cargando…</p>
              ) : vistas.length === 0 ? (
                <p className="admin-actividad-hint">Sin navegación registrada.</p>
              ) : (
                <ol className="admin-actividad-views">
                  {vistas.map((v) => (
                    <li key={v.id}>
                      <time dateTime={v.viewed_at}>{fmtDateTimeAr(v.viewed_at)}</time>
                      <code>{v.path}</code>
                      {v.title ? <span className="admin-actividad-title">{v.title}</span> : null}
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
