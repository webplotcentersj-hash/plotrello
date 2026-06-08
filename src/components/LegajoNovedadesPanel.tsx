import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { RrhhNovedad } from '../types/api'
import { etiquetaCodigoRrhhNovedad } from '../utils/rrhhNovedadCatalog'
import {
  CLASIFICACION_NOVEDAD_LEGajo,
  clasificarNovedadLegajo,
  etiquetaClasificacionNovedad,
  iconoClasificacionNovedad,
  type NovedadClasificacionLegajo
} from '../utils/rrhhNovedadClasificacionLegajo'
import {
  calcularEvolucionHistoricaNovedades,
  calcularIndicadoresNovedadesLegajo
} from '../utils/rrhhNovedadesLegajoStats'
import type { BenchmarkSectorColaborador } from '../utils/rrhhNovedadesSectorStats'
import './LegajoNovedadesPanel.css'

type LegajoNovedadesPanelProps = {
  novedades: RrhhNovedad[]
  onSelectNovedad: (n: RrhhNovedad) => void
  benchmarkSector?: BenchmarkSectorColaborador | null
}

const LegajoNovedadesPanel = ({
  novedades,
  onSelectNovedad,
  benchmarkSector
}: LegajoNovedadesPanelProps) => {
  const [filtro, setFiltro] = useState<NovedadClasificacionLegajo | 'todos'>('todos')

  const stats = useMemo(() => calcularIndicadoresNovedadesLegajo(novedades), [novedades])

  const evolucion = useMemo(() => calcularEvolucionHistoricaNovedades(novedades, 12), [novedades])

  const chartEvolucion = useMemo(
    () =>
      evolucion.map((e) => ({
        mes: e.mesLabel,
        ausentismo: e.ausentismoDias,
        tardanzas: e.tardanzas,
        disciplinarias: e.disciplinarias,
        total: e.totalEventos
      })),
    [evolucion]
  )

  const filtradas = useMemo(() => {
    const sorted = [...novedades].sort((a, b) => b.fecha_desde.localeCompare(a.fecha_desde))
    if (filtro === 'todos') return sorted
    return sorted.filter((n) => clasificarNovedadLegajo(n) === filtro)
  }, [novedades, filtro])

  const categoriasPresentes = useMemo(() => {
    const set = new Set(novedades.map((n) => clasificarNovedadLegajo(n)))
    return CLASIFICACION_NOVEDAD_LEGajo.filter((c) => set.has(c.value))
  }, [novedades])

  if (novedades.length === 0) {
    return (
      <div className="ver-legajo-empty-small">No hay novedades registradas para este empleado.</div>
    )
  }

  return (
    <div className="legajo-nov-panel">
      <section className="legajo-nov-kpis" aria-label="Indicadores de novedades">
        <article className="legajo-nov-kpi legajo-nov-kpi--ausencia">
          <span className="legajo-nov-kpi-value">{stats.ausentismoMesDias}</span>
          <span className="legajo-nov-kpi-label">Ausentismo mensual</span>
          <span className="legajo-nov-kpi-hint">
            {stats.ausentismoMesEventos} evento{stats.ausentismoMesEventos === 1 ? '' : 's'} · días del mes
          </span>
        </article>
        <article className="legajo-nov-kpi legajo-nov-kpi--tarde">
          <span className="legajo-nov-kpi-value">{stats.llegadasTardeMes}</span>
          <span className="legajo-nov-kpi-label">Llegadas tarde (mes)</span>
          <span className="legajo-nov-kpi-hint">{stats.llegadasTardeTotal} total histórico</span>
        </article>
        <article className="legajo-nov-kpi legajo-nov-kpi--medica">
          <span className="legajo-nov-kpi-value">{stats.licenciasMedicasDias}</span>
          <span className="legajo-nov-kpi-label">Licencias médicas</span>
          <span className="legajo-nov-kpi-hint">
            {stats.licenciasMedicasEventos} registro{stats.licenciasMedicasEventos === 1 ? '' : 's'} · días acum.
          </span>
        </article>
        <article className="legajo-nov-kpi legajo-nov-kpi--disc">
          <span className="legajo-nov-kpi-value">{stats.disciplinariasAnio}</span>
          <span className="legajo-nov-kpi-label">Novedades disciplinarias</span>
          <span className="legajo-nov-kpi-hint">{stats.disciplinariasMes} este mes · últimos 12 meses</span>
        </article>
      </section>

      {stats.alertas.length > 0 ? (
        <section className="legajo-nov-alertas" aria-label="Alertas de gestión">
          {stats.alertas.map((a, i) => (
            <div key={i} className={`legajo-nov-alerta legajo-nov-alerta--${a.nivel}`}>
              {a.nivel === 'critical' ? '🚨' : a.nivel === 'warning' ? '⚠️' : 'ℹ️'} {a.mensaje}
            </div>
          ))}
        </section>
      ) : null}

      {benchmarkSector ? (
        <section className="legajo-nov-sector" aria-label="Comparación con el sector">
          <h4>Índice de ausentismo — {benchmarkSector.sector}</h4>
          <div className="legajo-nov-sector-grid">
            <article className="legajo-nov-sector-card">
              <span className="legajo-nov-sector-value">{benchmarkSector.indiceSectorMes}%</span>
              <span className="legajo-nov-sector-label">Índice del sector (mes)</span>
            </article>
            <article className="legajo-nov-sector-card">
              <span className="legajo-nov-sector-value">{benchmarkSector.indiceEmpresaMes}%</span>
              <span className="legajo-nov-sector-label">Promedio empresa</span>
            </article>
            <article className="legajo-nov-sector-card">
              <span className="legajo-nov-sector-value">{benchmarkSector.diasAusenciaColaboradorMes}</span>
              <span className="legajo-nov-sector-label">Días ausencia colaborador</span>
              <span className="legajo-nov-sector-hint">
                Promedio sector: {benchmarkSector.promedioDiasSectorMes} días/empleado
              </span>
            </article>
          </div>
          {benchmarkSector.diasAusenciaColaboradorMes > benchmarkSector.promedioDiasSectorMes &&
          benchmarkSector.promedioDiasSectorMes > 0 ? (
            <p className="legajo-nov-sector-alerta">
              ⚠️ Este mes el colaborador supera el promedio de ausencias de su sector.
            </p>
          ) : null}
        </section>
      ) : null}

      {chartEvolucion.some((e) => e.total > 0) ? (
        <section className="legajo-nov-chart-section">
          <h4>Evolución histórica de novedades</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartEvolucion}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="ausentismo"
                name="Días ausencia"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="tardanzas"
                name="Tardanzas"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="disciplinarias"
                name="Disciplinarias"
                stroke="#fb923c"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      ) : null}

      <div className="legajo-nov-resumen">
        {CLASIFICACION_NOVEDAD_LEGajo.map((c) => {
          const n = stats.porClasificacion[c.value] ?? 0
          if (n === 0) return null
          return (
            <span key={c.value} className={`legajo-nov-chip legajo-nov-chip--${c.value}`}>
              {c.icon} {n} {c.label}
            </span>
          )
        })}
      </div>

      <div className="legajo-nov-toolbar">
        <div className="legajo-nov-filters" role="group" aria-label="Filtrar por clasificación">
          <button
            type="button"
            className={`legajo-nov-filter${filtro === 'todos' ? ' active' : ''}`}
            onClick={() => setFiltro('todos')}
          >
            Todas ({novedades.length})
          </button>
          {categoriasPresentes.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`legajo-nov-filter legajo-nov-filter--${c.value}${filtro === c.value ? ' active' : ''}`}
              onClick={() => setFiltro(c.value)}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ver-legajo-table-wrap">
        <table className="ver-legajo-table ver-legajo-table--clickable">
          <thead>
            <tr>
              <th>Fechas</th>
              <th>Clasificación</th>
              <th>Detalle</th>
              <th>Adj.</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={4} className="ver-legajo-empty-small">
                  Ninguna novedad coincide con el filtro.
                </td>
              </tr>
            ) : (
              filtradas.map((n) => {
                const clas = clasificarNovedadLegajo(n)
                return (
                  <tr key={n.id} onClick={() => onSelectNovedad(n)}>
                    <td>
                      {n.fecha_desde}
                      {n.fecha_hasta !== n.fecha_desde ? ` → ${n.fecha_hasta}` : ''}
                    </td>
                    <td>
                      <span className={`legajo-nov-clasif legajo-nov-clasif--${clas}`}>
                        {iconoClasificacionNovedad(clas)} {etiquetaClasificacionNovedad(clas)}
                      </span>
                      <span className="legajo-nov-codigo">{etiquetaCodigoRrhhNovedad(n.codigo)}</span>
                    </td>
                    <td className="ver-legajo-cell-ellipsis">
                      {n.grupo === 'tardanza_retiro' && n.duracion_minutos != null
                        ? `${n.duracion_minutos} min · `
                        : ''}
                      {n.grupo === 'horas_extra' && n.horas_extra_cantidad != null
                        ? `${n.horas_extra_cantidad} h · `
                        : ''}
                      {n.observaciones ?? '—'}
                    </td>
                    <td>{(n.adjuntos?.length ?? 0) || '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LegajoNovedadesPanel
