import { useCallback, useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import apiService from '../services/api'
import { emojiRating, SATISFACCION_RATINGS } from '../data/satisfaccionRatings'
import './AtencionSatisfaccionEntregaPanel.css'

type Row = {
  id: number
  numero_op: string
  orden_id: number | null
  cliente_nombre: string | null
  rating: number
  comentario: string | null
  created_at: string
  updated_at: string
}

const COL_RATING = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']

type Props = {
  active: boolean
}

const AtencionSatisfaccionEntregaPanel = ({ active }: Props) => {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.listSatisfaccionEntregaAtencion(800)
      if (res.success && res.data) setRows(res.data as Row[])
      else {
        setRows([])
        setError(res.error || 'No se pudieron cargar las encuestas de entrega.')
      }
    } catch (e: unknown) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Error al cargar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (active) void load()
  }, [active, load])

  const chartRating = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((v) => ({
        name: `${emojiRating(v)} ${v}/5`,
        value: rows.filter((r) => r.rating === v).length
      })),
    [rows]
  )

  const promedio = useMemo(() => {
    if (rows.length === 0) return null
    const s = rows.reduce((acc, r) => acc + r.rating, 0)
    return (s / rows.length).toFixed(1)
  }, [rows])

  const filasConComentario = useMemo(
    () => rows.filter((r) => r.comentario && String(r.comentario).trim().length > 0),
    [rows]
  )

  const hasRows = rows.length > 0

  return (
    <div className="atencion-sat-entrega">
      <p className="atencion-sat-entrega-lead">
        Respuestas de clientes al retirar el trabajo en <strong>/firma-cliente</strong> (emoji + comentario opcional).
      </p>
      <div className="atencion-sat-toolbar">
        <button type="button" className="atencion-sat-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
        {promedio != null && (
          <span className="atencion-sat-entrega-promedio">
            Promedio: <strong>{promedio}</strong> / 5 · {rows.length} respuestas
          </span>
        )}
      </div>

      {error && (
        <div className="atencion-sat-error">
          {error}
          <p className="atencion-sat-error-sub">
            Aplicá el parche SQL <code>2026-05-27_satisfaccion_entrega_firma.sql</code> en Supabase.
          </p>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="atencion-sat-loading">Cargando encuestas de entrega…</div>
      ) : (
        <>
          <div className="atencion-sat-grid atencion-sat-entrega-grid">
            <div className="atencion-sat-card">
              <h3>Calificación del trabajo entregado</h3>
              <div className="atencion-sat-chart">
                {hasRows ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chartRating} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78}>
                        {chartRating.map((_, i) => (
                          <Cell key={`re-${i}`} fill={COL_RATING[i % COL_RATING.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="atencion-sat-chart-empty">Todavía no hay respuestas post-entrega.</p>
                )}
              </div>
            </div>
            <div className="atencion-sat-card atencion-sat-entrega-leyenda">
              <h3>Escala</h3>
              <ul>
                {SATISFACCION_RATINGS.map((r) => (
                  <li key={r.value}>
                    <span>{r.emoji}</span> {r.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {filasConComentario.length > 0 && (
            <div className="atencion-sat-comentarios">
              <h3>Comentarios sobre el trabajo ({filasConComentario.length})</h3>
              <ul className="atencion-sat-comentarios-list">
                {filasConComentario.slice(0, 40).map((r) => (
                  <li key={r.id} className="atencion-sat-comentario-card">
                    <div className="atencion-sat-comentario-meta">
                      <span className="atencion-sat-comentario-nota">
                        {emojiRating(r.rating)} {r.rating}/5
                      </span>
                      <span className="atencion-sat-comentario-ubic">
                        OP {r.numero_op}
                        {r.cliente_nombre ? ` · ${r.cliente_nombre}` : ''}
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

          <div className="atencion-sat-table-wrap">
            <h3>Últimas respuestas ({rows.length})</h3>
            <div className="atencion-sat-table-scroll">
              <table className="atencion-sat-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>OP</th>
                    <th>Cliente</th>
                    <th>Nota</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.id}>
                      <td>
                        {new Date(r.created_at).toLocaleString('es-AR', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td>{r.numero_op}</td>
                      <td>{r.cliente_nombre || '—'}</td>
                      <td>
                        {emojiRating(r.rating)} {r.rating}
                      </td>
                      <td className="atencion-sat-td-comentario" title={r.comentario || undefined}>
                        {r.comentario || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AtencionSatisfaccionEntregaPanel
