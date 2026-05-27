import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import apiService from '../services/api'
import { emojiRating } from '../data/satisfaccionRatings'
import { FLOTA_MAP_CENTER, FLOTA_MAP_ZOOM_CIUDAD } from '../utils/flotaMapSanJuan'
import AtencionSatisfaccionEntregaPanel from './AtencionSatisfaccionEntregaPanel'
import './AtencionSatisfaccionPanel.css'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
})

type Row = {
  id: number
  rating: number
  departamento: string
  distrito: string
  edad: number
  sexo: string
  lat: number
  lng: number
  comentario: string | null
  created_at: string
}

const COL_RATING = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']
const COL_SEXO = ['#ec4899', '#3b82f6', '#a855f7', '#64748b']
const COL_DEPT = ['#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#84cc16', '#06b6d4', '#d946ef', '#94a3b8']

function sexoLabel(s: string): string {
  const m: Record<string, string> = {
    f: 'Mujer',
    m: 'Hombre',
    x: 'Otro',
    prefiero_no_decir: 'Prefiero no decir'
  }
  return m[s] || s
}

function edadBucket(edad: number): string {
  if (edad < 18) return '12–17'
  if (edad < 30) return '18–29'
  if (edad < 45) return '30–44'
  if (edad < 60) return '45–59'
  return '60+'
}

function jitterForId(lat: number, lng: number, id: number): [number, number] {
  const a = ((id * 9301 + 49297) % 233280) / 233280
  const ang = a * Math.PI * 2
  const r = 0.0009
  return [lat + Math.cos(ang) * r, lng + Math.sin(ang) * r]
}

type Props = {
  active: boolean
}

const AtencionSatisfaccionPanel = ({ active }: Props) => {
  const [subTab, setSubTab] = useState<'general' | 'entrega'>('entrega')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.listEncuestasSatisfaccionAtencion(800)
      if (res.success && res.data) setRows(res.data as Row[])
      else {
        setRows([])
        setError(res.error || 'No se pudieron cargar las encuestas.')
      }
    } catch (e: unknown) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Error al cargar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (active && subTab === 'general') void load()
  }, [active, subTab, load])

  const chartRating = useMemo(() => {
    return [1, 2, 3, 4, 5].map((v) => ({
      name: `${emojiRating(v)} ${v}/5`,
      value: rows.filter((r) => r.rating === v).length
    }))
  }, [rows])

  const chartSexo = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.sexo || '—'
      map.set(k, (map.get(k) || 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name: sexoLabel(name),
      value
    }))
  }, [rows])

  const chartEdad = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const b = edadBucket(r.edad)
      map.set(b, (map.get(b) || 0) + 1)
    }
    const order = ['12–17', '18–29', '30–44', '45–59', '60+']
    return order.map((name) => ({ name, value: map.get(name) || 0 })).filter((x) => x.value > 0)
  }, [rows])

  const chartDept = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.departamento || '—'
      map.set(k, (map.get(k) || 0) + 1)
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    const top = 10
    const head = sorted.slice(0, top).map(([name, value]) => ({ name, value }))
    const rest = sorted.slice(top).reduce((s, [, v]) => s + v, 0)
    if (rest > 0) head.push({ name: 'Otros', value: rest })
    return head
  }, [rows])

  const hasRows = rows.length > 0

  const mapCenter = useMemo((): [number, number] => {
    if (rows.length === 0) return FLOTA_MAP_CENTER
    const la = rows.reduce((s, r) => s + r.lat, 0) / rows.length
    const lo = rows.reduce((s, r) => s + r.lng, 0) / rows.length
    return [la, lo]
  }, [rows])

  const mapZoom = rows.length === 0 ? 8 : rows.length < 4 ? FLOTA_MAP_ZOOM_CIUDAD : 9

  const filasConComentario = useMemo(
    () => rows.filter((r) => r.comentario && String(r.comentario).trim().length > 0),
    [rows]
  )

  return (
    <div className="atencion-sat-panel">
      <div className="atencion-sat-subtabs">
        <button
          type="button"
          className={`atencion-sat-subtab ${subTab === 'entrega' ? 'active' : ''}`}
          onClick={() => setSubTab('entrega')}
        >
          📦 Post-entrega (firma)
        </button>
        <button
          type="button"
          className={`atencion-sat-subtab ${subTab === 'general' ? 'active' : ''}`}
          onClick={() => setSubTab('general')}
        >
          🌐 Encuesta general
        </button>
      </div>

      {subTab === 'entrega' ? (
        <AtencionSatisfaccionEntregaPanel active={active} />
      ) : (
        <>
      <div className="atencion-sat-toolbar">
        <button type="button" className="atencion-sat-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="atencion-sat-error">
          {error}
          <p className="atencion-sat-error-sub">
            Si acabás de desplegar, aplicá el parche SQL <code>2026-04-15_atencion_satisfaccion_encuestas.sql</code> en Supabase.
          </p>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="atencion-sat-loading">Cargando encuestas…</div>
      ) : (
        <>
          <div className="atencion-sat-grid">
            <div className="atencion-sat-card">
              <h3>Calificación</h3>
              <div className="atencion-sat-chart">
                {hasRows ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chartRating} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78}>
                        {chartRating.map((_, i) => (
                          <Cell key={`r-${i}`} fill={COL_RATING[i % COL_RATING.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="atencion-sat-chart-empty">Todavía no hay respuestas.</p>
                )}
              </div>
            </div>
            <div className="atencion-sat-card">
              <h3>Sexo</h3>
              <div className="atencion-sat-chart">
                {hasRows && chartSexo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chartSexo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78}>
                        {chartSexo.map((_, i) => (
                          <Cell key={`s-${i}`} fill={COL_SEXO[i % COL_SEXO.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="atencion-sat-chart-empty">Sin datos para graficar.</p>
                )}
              </div>
            </div>
            <div className="atencion-sat-card">
              <h3>Edad</h3>
              <div className="atencion-sat-chart">
                {hasRows && chartEdad.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chartEdad} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78}>
                        {chartEdad.map((_, i) => (
                          <Cell key={`e-${i}`} fill={COL_DEPT[i % COL_DEPT.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="atencion-sat-chart-empty">Sin datos para graficar.</p>
                )}
              </div>
            </div>
            <div className="atencion-sat-card atencion-sat-card--wide">
              <h3>Departamento (top)</h3>
              <div className="atencion-sat-chart">
                {hasRows && chartDept.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={chartDept} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88}>
                        {chartDept.map((_, i) => (
                          <Cell key={`d-${i}`} fill={COL_DEPT[i % COL_DEPT.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="atencion-sat-chart-empty">Sin datos para graficar.</p>
                )}
              </div>
            </div>
          </div>

          {filasConComentario.length > 0 && (
            <div className="atencion-sat-comentarios">
              <h3>Comentarios de clientes ({filasConComentario.length})</h3>
              <ul className="atencion-sat-comentarios-list">
                {filasConComentario.slice(0, 40).map((r) => (
                  <li key={r.id} className="atencion-sat-comentario-card">
                    <div className="atencion-sat-comentario-meta">
                      <span className="atencion-sat-comentario-nota">
                        {emojiRating(r.rating)} {r.rating}/5
                      </span>
                      <span className="atencion-sat-comentario-ubic">
                        {r.departamento} · {r.distrito}
                      </span>
                      <time className="atencion-sat-comentario-fecha" dateTime={r.created_at}>
                        {new Date(r.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                      </time>
                    </div>
                    <p className="atencion-sat-comentario-texto">{r.comentario}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="atencion-sat-map-wrap">
            <h3>Mapa · San Juan (aprox.)</h3>
            <div className="atencion-sat-map-inner">
              <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {rows.map((r) => {
                  const [la, lo] = jitterForId(r.lat, r.lng, r.id)
                  const fill = COL_RATING[Math.max(0, Math.min(4, r.rating - 1))]
                  return (
                    <CircleMarker key={r.id} center={[la, lo]} radius={8 + r.rating} pathOptions={{ color: fill, fillColor: fill, fillOpacity: 0.55 }}>
                      <Popup className="atencion-sat-popup">
                        <div>
                          <strong>
                            {emojiRating(r.rating)} {r.rating}/5
                          </strong>
                          <br />
                          {r.departamento} · {r.distrito}
                          <br />
                          {sexoLabel(r.sexo)} · {r.edad} años
                          <br />
                          <small>{new Date(r.created_at).toLocaleString('es-AR')}</small>
                          {r.comentario ? (
                            <>
                              <br />
                              <em>{r.comentario}</em>
                            </>
                          ) : null}
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            </div>
          </div>

          <div className="atencion-sat-table-wrap">
            <h3>Últimas respuestas ({rows.length})</h3>
            <div className="atencion-sat-table-scroll">
              <table className="atencion-sat-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nota</th>
                    <th>Depto</th>
                    <th>Distrito</th>
                    <th>Edad</th>
                    <th>Sexo</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 80).map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>
                        {emojiRating(r.rating)} {r.rating}
                      </td>
                      <td>{r.departamento}</td>
                      <td>{r.distrito}</td>
                      <td>{r.edad}</td>
                      <td>{sexoLabel(r.sexo)}</td>
                      <td className="atencion-sat-td-comentario" title={r.comentario || undefined}>
                        {r.comentario ? r.comentario : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  )
}

export default AtencionSatisfaccionPanel
