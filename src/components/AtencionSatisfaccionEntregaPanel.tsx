import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { marked } from 'marked'
import { sanitizeHtml } from '../utils/sanitizeHtml'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import apiService from '../services/api'
import { emojiRating, SATISFACCION_RATINGS } from '../data/satisfaccionRatings'
import {
  computeSatisfaccionEntregaKpis,
  formatPct,
  formatPromedio,
  type SatisfaccionEntregaRow
} from '../utils/satisfaccionEntregaKpis'
import {
  buildSatisfaccionEntregaAnalisisPayload,
  numeroOpsParaAnalisis,
  type PeriodoAnalisisIA
} from '../utils/satisfaccionEntregaAnalisisData'
import { fetchSatisfaccionEntregaInformeIA } from '../utils/satisfaccionEntregaPlotAI'
import './AtencionSatisfaccionEntregaPanel.css'

const COL_RATING = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']

type Props = {
  active: boolean
}

const AtencionSatisfaccionEntregaPanel = ({ active }: Props) => {
  const [rows, setRows] = useState<SatisfaccionEntregaRow[]>([])
  const [firmas7d, setFirmas7d] = useState(0)
  const [firmas30d, setFirmas30d] = useState(0)
  const [entregas7d, setEntregas7d] = useState(0)
  const [entregas30d, setEntregas30d] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [periodoIA, setPeriodoIA] = useState<PeriodoAnalisisIA>('30d')
  const [informeIA, setInformeIA] = useState<string | null>(null)
  const [informeLoading, setInformeLoading] = useState(false)
  const [informeError, setInformeError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [encRes, statsRes] = await Promise.all([
        apiService.listSatisfaccionEntregaAtencion(800),
        apiService.getSatisfaccionEntregaContextStats()
      ])
      if (encRes.success && encRes.data) setRows(encRes.data as SatisfaccionEntregaRow[])
      else {
        setRows([])
        setError(encRes.error || 'No se pudieron cargar las encuestas de entrega.')
      }
      if (statsRes.success && statsRes.data) {
        setFirmas7d(statsRes.data.firmas7d)
        setFirmas30d(statsRes.data.firmas30d)
        setEntregas7d(statsRes.data.entregas7d)
        setEntregas30d(statsRes.data.entregas30d)
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

  const kpis = useMemo(
    () =>
      computeSatisfaccionEntregaKpis(rows, {
        firmas7d,
        firmas30d,
        entregas7d,
        entregas30d
      }),
    [rows, firmas7d, firmas30d, entregas7d, entregas30d]
  )

  const chartRating = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((v) => ({
        name: `${emojiRating(v)} ${v}/5`,
        value: rows.filter((r) => r.rating === v).length
      })),
    [rows]
  )

  const tendenciaChart = useMemo(
    () =>
      kpis.tendencia7d.map((d) => ({
        name: d.label,
        promedio: d.promedio != null ? Number(d.promedio.toFixed(2)) : 0,
        cantidad: d.cantidad,
        tieneDatos: d.cantidad > 0
      })),
    [kpis.tendencia7d]
  )

  const filasConComentario = useMemo(
    () => rows.filter((r) => r.comentario && String(r.comentario).trim().length > 0),
    [rows]
  )

  const hasRows = rows.length > 0
  const detractoresAlto = (kpis.pctDetractores ?? 0) > 15

  const handleGenerarInformeIA = async () => {
    setInformeLoading(true)
    setInformeError(null)
    setInformeIA(null)
    try {
      const ops = numeroOpsParaAnalisis(rows, periodoIA)
      const ordRes = await apiService.getOrdenesContextoSatisfaccion(ops)
      const ordenes = ordRes.success && ordRes.data ? ordRes.data : []
      const analisis = buildSatisfaccionEntregaAnalisisPayload(rows, ordenes, periodoIA, kpis)
      if (analisis.resumen_encuestas.total_periodo === 0) {
        setInformeError('No hay encuestas en el período seleccionado.')
        return
      }
      const report = await fetchSatisfaccionEntregaInformeIA(analisis)
      setInformeIA(report)
    } catch (e: unknown) {
      setInformeError(e instanceof Error ? e.message : 'Error al generar el informe con IA.')
    } finally {
      setInformeLoading(false)
    }
  }

  return (
    <div className="atencion-sat-entrega">
      <p className="atencion-sat-entrega-lead">
        Respuestas de clientes al retirar el trabajo en <strong>/firma-cliente</strong>. La tasa de respuesta compara
        encuestas con firmas/entregas del mismo período.
      </p>

      <div className="atencion-sat-toolbar">
        <button type="button" className="atencion-sat-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="atencion-sat-error">
          {error}
          <p className="atencion-sat-error-sub">
            Aplicá los parches SQL <code>2026-05-27_satisfaccion_entrega_firma.sql</code> y{' '}
            <code>2026-05-27_firmas_entrega_cliente_anon_select.sql</code> en Supabase.
          </p>
        </div>
      )}

      <div className="atencion-sat-kpi-grid">
        <div className="atencion-sat-kpi atencion-sat-kpi--highlight">
          <span className="atencion-sat-kpi-label">Promedio global</span>
          <span className="atencion-sat-kpi-value">{formatPromedio(kpis.promedioGlobal)}</span>
          <span className="atencion-sat-kpi-sub">de 5 · {kpis.total} respuestas</span>
        </div>
        <div className="atencion-sat-kpi">
          <span className="atencion-sat-kpi-label">Promedio 7 días</span>
          <span className="atencion-sat-kpi-value">{formatPromedio(kpis.promedio7d)}</span>
          <span className="atencion-sat-kpi-sub">{kpis.semana7d} encuestas</span>
        </div>
        <div className="atencion-sat-kpi">
          <span className="atencion-sat-kpi-label">Promedio 30 días</span>
          <span className="atencion-sat-kpi-value">{formatPromedio(kpis.promedio30d)}</span>
          <span className="atencion-sat-kpi-sub">{kpis.mes30d} encuestas</span>
        </div>
        <div className="atencion-sat-kpi atencion-sat-kpi--ok">
          <span className="atencion-sat-kpi-label">Promotores (4–5)</span>
          <span className="atencion-sat-kpi-value">{formatPct(kpis.pctPromotores)}</span>
          <span className="atencion-sat-kpi-sub">del total histórico</span>
        </div>
        <div className={`atencion-sat-kpi ${detractoresAlto ? 'atencion-sat-kpi--warn' : ''}`}>
          <span className="atencion-sat-kpi-label">Detractores (1–2)</span>
          <span className="atencion-sat-kpi-value">{formatPct(kpis.pctDetractores)}</span>
          <span className="atencion-sat-kpi-sub">{detractoresAlto ? '⚠️ Por encima del 15%' : 'meta: menos del 15%'}</span>
        </div>
        <div className="atencion-sat-kpi">
          <span className="atencion-sat-kpi-label">Tasa respuesta 7d</span>
          <span className="atencion-sat-kpi-value">{formatPct(kpis.tasaRespuesta7d)}</span>
          <span className="atencion-sat-kpi-sub">
            {kpis.semana7d} enc. / {Math.max(kpis.firmas7d, kpis.entregas7d)} firmas o entregas
          </span>
        </div>
        <div className="atencion-sat-kpi">
          <span className="atencion-sat-kpi-label">Tasa respuesta 30d</span>
          <span className="atencion-sat-kpi-value">{formatPct(kpis.tasaRespuesta30d)}</span>
          <span className="atencion-sat-kpi-sub">
            {kpis.mes30d} enc. / {Math.max(kpis.firmas30d, kpis.entregas30d)} firmas o entregas
          </span>
        </div>
        <div className="atencion-sat-kpi">
          <span className="atencion-sat-kpi-label">Hoy</span>
          <span className="atencion-sat-kpi-value">{kpis.hoy}</span>
          <span className="atencion-sat-kpi-sub">encuestas · {formatPct(kpis.pctConComentario)} con comentario</span>
        </div>
      </div>

      <section className="atencion-sat-ia" aria-labelledby="atencion-sat-ia-title">
        <div className="atencion-sat-ia-head">
          <div>
            <h3 id="atencion-sat-ia-title">Analizador IA · fallas por OP</h3>
            <p className="atencion-sat-ia-desc">
              PlotAI revisa las encuestas bajas, cruza sector/estado de cada OP y genera un informe interpretando de dónde
              vienen las fallas.
            </p>
          </div>
          <div className="atencion-sat-ia-actions">
            <label className="atencion-sat-ia-periodo">
              Período
              <select
                value={periodoIA}
                onChange={(e) => setPeriodoIA(e.target.value as PeriodoAnalisisIA)}
                disabled={informeLoading}
              >
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="todo">Todo el histórico</option>
              </select>
            </label>
            <button
              type="button"
              className="atencion-sat-ia-btn"
              onClick={() => void handleGenerarInformeIA()}
              disabled={informeLoading || loading || rows.length === 0}
            >
              {informeLoading ? 'Analizando…' : '✨ Generar informe IA'}
            </button>
          </div>
        </div>

        {informeError && (
          <div className="atencion-sat-error atencion-sat-ia-error">
            {informeError}
            <p className="atencion-sat-error-sub">
              En producción necesitás <code>GEMINI_API_KEY</code> en Vercel. En local, usá <code>vercel dev</code>.
            </p>
          </div>
        )}

        {informeIA && (
          <div
            className="atencion-sat-ia-report"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(marked.parse(informeIA) as string) }}
          />
        )}
      </section>

      {loading && rows.length === 0 ? (
        <div className="atencion-sat-loading">Cargando encuestas de entrega…</div>
      ) : (
        <>
          {(kpis.criticasSemana.length > 0 || kpis.bajasSinComentario.length > 0) && (
            <div className="atencion-sat-alertas">
              {kpis.criticasSemana.length > 0 && (
                <section className="atencion-sat-alerta atencion-sat-alerta--critica">
                  <h3>OPs críticas esta semana (nota ≤ 2)</h3>
                  <ul className="atencion-sat-alerta-list">
                    {kpis.criticasSemana.map((r) => (
                      <li key={r.id}>
                        <span className="atencion-sat-alerta-nota">
                          {emojiRating(r.rating)} {r.rating}/5
                        </span>
                        <span className="atencion-sat-alerta-op">
                          OP {r.numero_op}
                          {r.cliente_nombre ? ` · ${r.cliente_nombre}` : ''}
                        </span>
                        {r.orden_id ? (
                          <Link to={`/mostrador/entrega/${r.orden_id}`} className="atencion-sat-alerta-link">
                            Ver entrega
                          </Link>
                        ) : null}
                        {r.comentario ? (
                          <p className="atencion-sat-alerta-coment">{r.comentario}</p>
                        ) : (
                          <p className="atencion-sat-alerta-coment atencion-sat-alerta-coment--muted">Sin comentario</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {kpis.bajasSinComentario.length > 0 && (
                <section className="atencion-sat-alerta atencion-sat-alerta--seguimiento">
                  <h3>Nota ≤ 3 sin comentario (seguimiento)</h3>
                  <ul className="atencion-sat-alerta-list atencion-sat-alerta-list--compact">
                    {kpis.bajasSinComentario.map((r) => (
                      <li key={`bsc-${r.id}`}>
                        <span>
                          {emojiRating(r.rating)} OP {r.numero_op}
                        </span>
                        {r.orden_id ? (
                          <Link to={`/mostrador/entrega/${r.orden_id}`} className="atencion-sat-alerta-link">
                            Ver
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          <div className="atencion-sat-grid atencion-sat-entrega-charts">
            <div className="atencion-sat-card">
              <h3>Tendencia 7 días (promedio)</h3>
              <div className="atencion-sat-chart">
                {tendenciaChart.some((d) => d.tieneDatos) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={tendenciaChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis domain={[0, 5]} tick={{ fill: '#94a3b8', fontSize: 11 }} width={28} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        formatter={(value: number, name: string) =>
                          name === 'promedio' ? [value.toFixed(2), 'Promedio'] : [value, 'Encuestas']
                        }
                      />
                      <Bar dataKey="promedio" fill="#f97316" radius={[6, 6, 0, 0]} name="promedio" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="atencion-sat-chart-empty">Sin datos en los últimos 7 días.</p>
                )}
              </div>
            </div>
            <div className="atencion-sat-card">
              <h3>Distribución de notas</h3>
              <div className="atencion-sat-chart">
                {hasRows ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={chartRating} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72}>
                        {chartRating.map((_, i) => (
                          <Cell key={`re-${i}`} fill={COL_RATING[i % COL_RATING.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="atencion-sat-chart-empty">Todavía no hay respuestas.</p>
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
                      <td>
                        {r.orden_id ? (
                          <Link to={`/mostrador/entrega/${r.orden_id}`} className="atencion-sat-op-link">
                            {r.numero_op}
                          </Link>
                        ) : (
                          r.numero_op
                        )}
                      </td>
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
