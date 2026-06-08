import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { Capacitacion, PruebaAsignacionColaborador } from '../types/api'
import { tematicaDePrueba, etiquetaTematicaPrueba } from '../utils/rrhhPruebaTematica'
import {
  calcularIndicadoresPruebas,
  esPruebaRealizada,
  fmtPctPrueba,
  pctPrueba
} from '../utils/rrhhPruebasStats'
import './LegajoPruebasPanel.css'

type LegajoPruebasPanelProps = {
  pruebas: PruebaAsignacionColaborador[]
  capacitaciones: Capacitacion[]
  formatDate: (d: string | null | undefined) => string
}

const LegajoPruebasPanel = ({ pruebas, capacitaciones, formatDate }: LegajoPruebasPanelProps) => {
  const stats = useMemo(
    () => calcularIndicadoresPruebas(pruebas, capacitaciones),
    [pruebas, capacitaciones]
  )

  const chartTematica = useMemo(
    () =>
      stats.porTematica.map((t) => ({
        name: t.tematicaLabel.length > 18 ? `${t.tematicaLabel.slice(0, 16)}…` : t.tematicaLabel,
        promedio: t.promedioPct,
        cantidad: t.cantidad
      })),
    [stats.porTematica]
  )

  const chartEvolucion = useMemo(
    () =>
      stats.evolucionHistorica.map((e, i) => ({
        idx: i + 1,
        label: e.fechaLabel,
        pct: e.pct,
        titulo: e.titulo
      })),
    [stats.evolucionHistorica]
  )

  if (pruebas.length === 0) {
    return (
      <div className="ver-legajo-empty-small">
        No hay evaluaciones de conocimiento asignadas a este colaborador.
      </div>
    )
  }

  return (
    <div className="legajo-pru-panel">
      <section className="legajo-pru-kpis" aria-label="Indicadores de evaluaciones">
        <article className="legajo-pru-kpi">
          <span className="legajo-pru-kpi-value">{stats.realizadas}</span>
          <span className="legajo-pru-kpi-label">Evaluaciones realizadas</span>
          <span className="legajo-pru-kpi-hint">{stats.asignadas} asignada{stats.asignadas === 1 ? '' : 's'}</span>
        </article>
        <article className="legajo-pru-kpi legajo-pru-kpi--ok">
          <span className="legajo-pru-kpi-value">{stats.aprobadas}</span>
          <span className="legajo-pru-kpi-label">Aprobadas</span>
          <span className="legajo-pru-kpi-hint">{fmtPctPrueba(stats.tasaAprobacionPct)} tasa</span>
        </article>
        <article className="legajo-pru-kpi legajo-pru-kpi--pct">
          <span className="legajo-pru-kpi-value">
            {stats.promedioPct != null ? fmtPctPrueba(stats.promedioPct) : '—'}
          </span>
          <span className="legajo-pru-kpi-label">Promedio de resultados</span>
        </article>
        <article className="legajo-pru-kpi">
          <span className="legajo-pru-kpi-value legajo-pru-kpi-value--fecha">
            {stats.ultimaEvaluacionLabel ?? '—'}
          </span>
          <span className="legajo-pru-kpi-label">Última evaluación</span>
        </article>
      </section>

      {stats.porTematica.length > 0 ? (
        <section className="legajo-pru-chart-section">
          <h4>Resultados por temática evaluada</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartTematica} margin={{ left: 4, right: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8
                }}
                formatter={(v: number, name: string) =>
                  name === 'promedio' ? [`${v}%`, 'Promedio'] : [v, 'Cantidad']
                }
              />
              <Bar dataKey="promedio" name="promedio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      ) : null}

      {chartEvolucion.length > 1 ? (
        <section className="legajo-pru-chart-section">
          <h4>Evolución histórica de resultados</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartEvolucion}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8
                }}
                formatter={(v: number) => [`${v}%`, 'Resultado']}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { titulo?: string } | undefined
                  return p?.titulo ?? ''
                }}
              />
              <Line type="monotone" dataKey="pct" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      ) : null}

      {stats.vinculosFormacion.length > 0 ? (
        <section className="legajo-pru-vinculos">
          <h4>Vinculación con capacitaciones cursadas</h4>
          <p className="legajo-pru-vinculos-hint">
            Cruce por temática y competencias entre formación completada y evaluaciones realizadas.
          </p>
          <div className="ver-legajo-table-wrap">
            <table className="ver-legajo-table">
              <thead>
                <tr>
                  <th>Capacitación</th>
                  <th>Evaluación</th>
                  <th>Competencia / temática</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {stats.vinculosFormacion.map((v) => (
                  <tr key={`${v.capacitacionTitulo}-${v.pruebaTitulo}`}>
                    <td>{v.capacitacionTitulo}</td>
                    <td>{v.pruebaTitulo}</td>
                    <td>{v.competencia}</td>
                    <td>
                      {v.pctPrueba != null ? fmtPctPrueba(v.pctPrueba) : '—'}{' '}
                      {v.aprobado ? (
                        <span className="ver-legajo-badge ver-legajo-badge--ok">Aprobado</span>
                      ) : (
                        <span className="ver-legajo-badge ver-legajo-badge--no">No aprobado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="ver-legajo-table-wrap">
        <table className="ver-legajo-table">
          <thead>
            <tr>
              <th>Evaluación</th>
              <th>Temática</th>
              <th>Estado</th>
              <th>Resultado</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {pruebas.map((p) => {
              const tem = tematicaDePrueba(p.titulo, p.descripcion)
              const pct = pctPrueba(p)
              const realizada = esPruebaRealizada(p)
              return (
                <tr key={p.id_asignacion} className={p.aprobado === true ? 'legajo-pru-row--ok' : undefined}>
                  <td>
                    <span className="legajo-pru-titulo">{p.titulo}</span>
                    {p.porcentaje_aprobacion != null ? (
                      <span className="legajo-pru-meta">Mín. aprobación: {p.porcentaje_aprobacion}%</span>
                    ) : null}
                  </td>
                  <td>{etiquetaTematicaPrueba(tem)}</td>
                  <td>
                    {realizada ? (
                      p.aprobado === true ? (
                        <span className="ver-legajo-badge ver-legajo-badge--ok">Aprobada</span>
                      ) : p.aprobado === false ? (
                        <span className="ver-legajo-badge ver-legajo-badge--no">No aprobada</span>
                      ) : p.calificacion_pendiente ? (
                        <span className="ver-legajo-muted">Calificación pendiente</span>
                      ) : (
                        <span className="ver-legajo-muted">Finalizada</span>
                      )
                    ) : (
                      <span className="ver-legajo-muted">{p.estado || 'Pendiente'}</span>
                    )}
                  </td>
                  <td>
                    {pct != null ? (
                      <>
                        {fmtPctPrueba(pct)}
                        <span className="legajo-pru-meta">
                          {' '}
                          ({p.puntaje_obtenido ?? '—'}/{p.puntaje_maximo ?? '—'} pts)
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{formatDate(p.finalizado_at ?? p.iniciado_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LegajoPruebasPanel
