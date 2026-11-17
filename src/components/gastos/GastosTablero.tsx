import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  SIN_CATEGORIA,
  acumuladoDiario,
  agrupar,
  alertasGastos,
  cuadroCategorias,
  evolucionPorCategoria,
  resumenMes,
  sumarMeses,
  type GastoStat
} from '../../features/gastos/estadisticasGastos'
import './GastosTablero.css'

const COLORES = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f472b6', '#2dd4bf', '#f97316', '#94a3b8']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const pesos = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const corto = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `$${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (a >= 1_000) return `$${Math.round(v / 1000).toLocaleString('es-AR')} k`
  return `$${Math.round(v)}`
}
const pct = (v: number) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
const mesLargo = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const mesCorto = (ym: string) => `${MESES_C[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`

const tooltipEstilo = {
  contentStyle: { background: '#0f172a', border: '1px solid rgba(148,163,184,.3)', borderRadius: 10, color: '#e2e8f0', fontSize: 12 },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8' }
}

type Props = {
  rows: GastoStat[]
  mes: string
  hoy: string
  onCambiarMes: (ym: string) => void
  /** Ir al listado filtrado por categoría ('' = todas). */
  onVerCategoria: (categoria: string) => void
  onVerSinLibro: () => void
  onCargar: () => void
}

function Delta({ valor, invertir = true }: { valor: number | null; invertir?: boolean }) {
  if (valor === null) return <span className="gt-delta gt-delta--neutro">—</span>
  // En gastos, subir es "malo": rojo.
  const malo = invertir ? valor > 0 : valor < 0
  return (
    <span className={`gt-delta ${Math.abs(valor) < 1 ? 'gt-delta--neutro' : malo ? 'gt-delta--malo' : 'gt-delta--bueno'}`}>
      {valor >= 0 ? '▲' : '▼'} {Math.abs(valor).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%
    </span>
  )
}

function Mini({ serie, color }: { serie: number[]; color: string }) {
  const max = Math.max(...serie, 1)
  return (
    <span className="gt-mini" aria-hidden>
      {serie.map((v, i) => (
        <i key={i} style={{ height: `${Math.max((v / max) * 100, v > 0 ? 8 : 2)}%`, background: i === serie.length - 1 ? color : undefined }} />
      ))}
    </span>
  )
}

export default function GastosTablero({ rows, mes, hoy, onCambiarMes, onVerCategoria, onVerSinLibro, onCargar }: Props) {
  const navigate = useNavigate()
  const resumen = useMemo(() => resumenMes(rows, mes, hoy), [rows, mes, hoy])
  const cuadro = useMemo(() => cuadroCategorias(rows, mes), [rows, mes])
  const alertas = useMemo(() => alertasGastos(rows, mes, hoy), [rows, mes, hoy])
  const evolucion = useMemo(() => evolucionPorCategoria(rows, mes, 5), [rows, mes])
  const acumulado = useMemo(() => acumuladoDiario(rows, mes, hoy), [rows, mes, hoy])
  const medios = useMemo(() => agrupar(rows, mes, (g) => g.metodo_pago || 'Sin dato', 6), [rows, mes])
  const proveedores = useMemo(() => agrupar(rows, mes, (g) => (g.proveedor || '').trim() || 'Sin proveedor', 6), [rows, mes])

  const colorDe = useMemo(() => {
    const m = new Map<string, string>()
    cuadro.forEach((f, i) => m.set(f.categoria, f.categoria === SIN_CATEGORIA ? '#64748b' : COLORES[i % COLORES.length]))
    return (c: string) => m.get(c) ?? (c === 'Otras' ? '#64748b' : '#94a3b8')
  }, [cuadro])

  const torta = useMemo(() => {
    const conGasto = cuadro.filter((f) => f.total > 0)
    if (conGasto.length <= 7) return conGasto.map((f) => ({ nombre: f.categoria, valor: f.total }))
    const resto = conGasto.slice(6).reduce((s, f) => s + f.total, 0)
    return [...conGasto.slice(0, 6).map((f) => ({ nombre: f.categoria, valor: f.total })), { nombre: 'Otras', valor: resto }]
  }, [cuadro])

  const prevLabel = mesLargo(sumarMeses(mes, -1))
  const enCurso = hoy.slice(0, 7) === mes
  const maxParticipacion = Math.max(...cuadro.map((f) => f.participacion), 1)

  return (
    <div className="gt">
      {/* Mes */}
      <div className="gt-mes">
        <button type="button" className="gt-icono" onClick={() => onCambiarMes(sumarMeses(mes, -1))} aria-label="Mes anterior">
          ‹
        </button>
        <strong>{mesLargo(mes)}</strong>
        <button
          type="button"
          className="gt-icono"
          onClick={() => onCambiarMes(sumarMeses(mes, 1))}
          disabled={mes >= hoy.slice(0, 7)}
          aria-label="Mes siguiente"
        >
          ›
        </button>
        {!enCurso ? (
          <button type="button" className="gt-link" onClick={() => onCambiarMes(hoy.slice(0, 7))}>
            Ir al mes actual
          </button>
        ) : null}
        <span className="gt-mes__espacio" />
        <button type="button" className="btn-primary" onClick={onCargar}>
          + Cargar gasto
        </button>
      </div>

      {/* KPIs */}
      <div className="gt-kpis">
        <article className="gt-kpi gt-kpi--principal">
          <span>Gastado en {MESES[Number(mes.slice(5, 7)) - 1]}</span>
          <strong>{pesos(resumen.total)}</strong>
          <small>
            <Delta valor={resumen.variacion} /> vs {enCurso ? 'mismo día de ' : ''}
            {prevLabel.split(' ')[0]} ({pesos(resumen.totalMesAnteriorMismoDia)})
          </small>
        </article>
        <article className="gt-kpi">
          <span>{enCurso ? 'Proyección del mes' : 'Promedio diario'}</span>
          <strong>{enCurso && resumen.proyeccion !== null ? pesos(resumen.proyeccion) : pesos(resumen.promedioDiario)}</strong>
          <small>{enCurso ? `${pesos(resumen.promedioDiario)} por día` : `${resumen.cantidad} gastos en el mes`}</small>
        </article>
        <article className="gt-kpi">
          <span>IVA crédito fiscal</span>
          <strong>{pesos(resumen.iva)}</strong>
          {resumen.gastosConIvaSinLibro ? (
            <button type="button" className="gt-link gt-link--warn" onClick={onVerSinLibro}>
              {pesos(resumen.ivaPendienteLibro)} sin pasar al libro
            </button>
          ) : (
            <small>todo en el libro de compras</small>
          )}
        </article>
        <article className="gt-kpi">
          <span>Gastos fijos pagados</span>
          <strong>{pesos(resumen.fijos)}</strong>
          <button type="button" className="gt-link" onClick={() => navigate('/erp/gastos-fijos')}>
            Ver vencimientos →
          </button>
        </article>
        <article className="gt-kpi">
          <span>Movimientos</span>
          <strong>{resumen.cantidad}</strong>
          <small>{resumen.proveedores} proveedores distintos</small>
        </article>
      </div>

      {alertas.length ? (
        <ul className="gt-alertas">
          {alertas.map((a) => (
            <li key={a.texto} className={`is-${a.tono}`}>
              <span>{a.texto}</span>
              {a.categoria ? (
                <button type="button" className="gt-link" onClick={() => onVerCategoria(a.categoria!)}>
                  Ver
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Cuadro de categorías */}
      <section className="gt-card">
        <header className="gt-card__head">
          <h3>Gastos por categoría</h3>
          <span>Contra {prevLabel} y el promedio de los 6 meses anteriores · tocá una fila para ver los gastos</span>
        </header>
        {cuadro.length === 0 ? (
          <div className="gt-vacio">
            <p>No hay gastos en {mesLargo(mes)} ni en los meses anteriores.</p>
            <button type="button" className="btn-primary" onClick={onCargar}>
              Cargar el primero
            </button>
          </div>
        ) : (
          <div className="gt-tabla-wrap">
            <table className="gt-tabla">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="num">Gastos</th>
                  <th className="num">Total</th>
                  <th>Participación</th>
                  <th className="num">Mes anterior</th>
                  <th className="num">Var.</th>
                  <th className="num">Promedio 6 m</th>
                  <th className="num">vs prom.</th>
                  <th>Últimos 6 meses</th>
                  <th>Proveedor principal</th>
                </tr>
              </thead>
              <tbody>
                {cuadro.map((f) => (
                  <tr key={f.categoria} className={f.total === 0 ? 'is-cero' : undefined} onClick={() => onVerCategoria(f.categoria)}>
                    <td>
                      <span className="gt-punto" style={{ background: colorDe(f.categoria) }} />
                      <strong>{f.categoria}</strong>
                    </td>
                    <td className="num">{f.cantidad || '—'}</td>
                    <td className="num gt-total">{f.total ? pesos(f.total) : '—'}</td>
                    <td>
                      <span className="gt-barra">
                        <span style={{ width: `${(f.participacion / maxParticipacion) * 100}%`, background: colorDe(f.categoria) }} />
                      </span>
                      <small>{f.total ? pct(f.participacion) : ''}</small>
                    </td>
                    <td className="num gt-muted">{f.mesAnterior ? pesos(f.mesAnterior) : '—'}</td>
                    <td className="num">{f.total ? <Delta valor={f.variacion} /> : '—'}</td>
                    <td className="num gt-muted">{f.promedio6 ? pesos(f.promedio6) : '—'}</td>
                    <td className="num">{f.promedio6 && f.total ? <Delta valor={f.vsPromedio} /> : '—'}</td>
                    <td>
                      <Mini serie={f.serie} color={colorDe(f.categoria)} />
                    </td>
                    <td className="gt-muted gt-recortar">{f.proveedorPrincipal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{resumen.cantidad}</td>
                  <td className="num">{pesos(resumen.total)}</td>
                  <td />
                  <td className="num">{pesos(resumen.totalMesAnterior)}</td>
                  <td className="num">
                    <Delta valor={resumen.totalMesAnterior ? ((resumen.total - resumen.totalMesAnterior) / resumen.totalMesAnterior) * 100 : null} />
                  </td>
                  <td className="num">{pesos(cuadro.reduce((s, f) => s + f.promedio6, 0))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Gráficos */}
      <div className="gt-grid">
        <section className="gt-card">
          <header className="gt-card__head">
            <h3>Distribución del mes</h3>
          </header>
          {torta.length === 0 ? (
            <p className="gt-vacio">Sin gastos este mes.</p>
          ) : (
            <div className="gt-dona">
              <div className="gt-dona__grafico">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={torta} dataKey="valor" nameKey="nombre" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                      {torta.map((d) => (
                        <Cell key={d.nombre} fill={colorDe(d.nombre)} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipEstilo} formatter={(v: number, nombre: string) => [`${pesos(v)} · ${pct((v / resumen.total) * 100)}`, nombre]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="gt-dona__centro" aria-hidden>
                  <strong>{corto(resumen.total)}</strong>
                  <span>{torta.length} categorías</span>
                </div>
              </div>
              <ul className="gt-leyenda">
                {torta.map((d) => (
                  <li key={d.nombre}>
                    <i style={{ background: colorDe(d.nombre) }} />
                    <span>{d.nombre}</span>
                    <b>{pct((d.valor / resumen.total) * 100)}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="gt-card">
          <header className="gt-card__head">
            <h3>Ritmo de gasto</h3>
            <span>acumulado día a día contra {prevLabel.split(' ')[0]}</span>
          </header>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={acumulado} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
              <XAxis dataKey="dia" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} interval={4} />
              <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={58} />
              <Tooltip {...tooltipEstilo} labelFormatter={(d) => `Día ${d}`} formatter={(v: number, nombre: string) => [pesos(v), nombre]} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Line dataKey="anterior" name={prevLabel.split(' ')[0]} stroke="#64748b" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} />
              <Line dataKey="actual" name={mesLargo(mes).split(' ')[0]} stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="gt-grid gt-grid--ancho">
        <section className="gt-card">
          <header className="gt-card__head">
            <h3>Últimos 12 meses</h3>
            <span>por categoría · tocá un mes para verlo</span>
          </header>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={evolucion.datos.map((d) => ({ ...d, etiqueta: mesCorto(String(d.mes)) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
              <XAxis dataKey="etiqueta" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={58} />
              <Tooltip {...tooltipEstilo} cursor={{ fill: 'rgba(148,163,184,.08)' }} formatter={(v: number, nombre: string) => [pesos(v), nombre]} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              {evolucion.claves.map((c, i) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="g"
                  fill={colorDe(c)}
                  maxBarSize={30}
                  radius={i === evolucion.claves.length - 1 ? [5, 5, 0, 0] : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={(_d: unknown, idx: number) => {
                    const m = evolucion.datos[idx]?.mes
                    if (m) onCambiarMes(String(m))
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="gt-card">
          <header className="gt-card__head">
            <h3>Cómo se paga</h3>
          </header>
          {medios.length === 0 ? (
            <p className="gt-vacio">Sin datos.</p>
          ) : (
            <ul className="gt-ranking">
              {medios.map((m, i) => (
                <li key={m.nombre}>
                  <div>
                    <span>{m.nombre}</span>
                    <b>{pesos(m.total)}</b>
                  </div>
                  <span className="gt-barra gt-barra--ancha">
                    <span style={{ width: `${(m.total / medios[0].total) * 100}%`, background: COLORES[i % COLORES.length] }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <header className="gt-card__head gt-card__head--sub">
            <h3>Principales proveedores</h3>
          </header>
          {proveedores.length === 0 ? (
            <p className="gt-vacio">Sin datos.</p>
          ) : (
            <ul className="gt-ranking">
              {proveedores.map((p) => (
                <li key={p.nombre}>
                  <div>
                    <span className="gt-recortar">{p.nombre}</span>
                    <b>{pesos(p.total)}</b>
                  </div>
                  <small>
                    {p.cantidad} gasto{p.cantidad === 1 ? '' : 's'} · {resumen.total ? pct((p.total / resumen.total) * 100) : '—'}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
