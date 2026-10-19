import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import apiService from '../../../services/api'
import { generateContent } from '../../../services/plotAIService'
import type { Venta } from '../../../types/api'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { fmtArs } from '../format'
import {
  addDaysIso,
  construirProyeccionVentas,
  fechaVentaIso,
  LOOKBACK_PROYECCION,
  montoVentaCobrada,
  type ProyeccionVentas
} from '../proyeccionVentas'

const PIE_COLORS = ['#0f766e', '#1d4ed8', '#c2410c', '#7c3aed', '#b45309', '#be185d', '#334155', '#64748b']

function money(n: number) {
  return `$ ${fmtArs(n)}`
}

export default function CajaProyeccionVentas() {
  const hoy = getArgentinaDateString()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proy, setProy] = useState<ProyeccionVentas | null>(null)
  const [horizonte, setHorizonte] = useState<7 | 14 | 30>(14)
  const [aiTxt, setAiTxt] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const desde = addDaysIso(hoy, -(LOOKBACK_PROYECCION - 1))
    void apiService.obtenerVentas(undefined, desde, hoy, 'todos').then((res) => {
      if (cancelled) return
      if (!res.success) {
        setError(res.error || 'No se pudieron leer las ventas.')
        setLoading(false)
        return
      }
      const ventas = (res.data || []) as Venta[]
      const input = ventas
        .map((v) => {
          const total = montoVentaCobrada(v)
          if (total == null) return null
          return {
            fecha: fechaVentaIso(v),
            total,
            metodo: v.metodo_pago || 'Otro',
            vendedor: v.nombre_vendedor || 'Sin vendedor',
            items: (v.items || []).map((it) => ({
              descripcion: it.descripcion,
              cantidad: it.cantidad,
              precio_total: it.precio_total
            }))
          }
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
      setProy(construirProyeccionVentas(input, hoy))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [hoy])

  const predMonto = useMemo(() => {
    if (!proy) return 0
    if (horizonte === 7) return proy.prox7
    if (horizonte === 30) return proy.prox30
    return proy.prox14
  }, [proy, horizonte])

  const pedirInsight = async () => {
    if (!proy) return
    setAiBusy(true)
    try {
      const txt = await generateContent({
        contents: `Sos analista comercial de Plot Center. Con estos números, en 4-6 frases en español argentino, decí qué se está vendiendo, qué día rinde más, la tendencia y qué conviene esperar los próximos ${horizonte} días. No inventes productos que no estén en la lista.\n\n${proy.narrativa}\nMix productos: ${proy.mixProductos.map((x) => `${x.name} $${x.value.toFixed(0)}`).join('; ')}\nPagos: ${proy.mixPagos.map((x) => `${x.name} $${x.value.toFixed(0)}`).join('; ')}`,
        useCompleteContext: false,
        useMemory: false,
        includeAppManual: false,
        learnFromResponse: false
      })
      setAiTxt(String(txt || '').trim() || proy.narrativa)
    } catch {
      setAiTxt(proy.narrativa)
    } finally {
      setAiBusy(false)
    }
  }

  if (loading) {
    return <p className="caja-cc-muted">Armando proyección con las ventas cobradas…</p>
  }
  if (error) {
    return <p className="caja-cc-err">{error}</p>
  }
  if (!proy) return null

  const confCls = proy.confianza === 'alta' ? 'ok' : proy.confianza === 'media' ? 'warn' : 'bad'

  return (
    <div className="caja-cc-proy">
      <div className="caja-cc-page-head">
        <div>
          <h2>Proyección de ventas</h2>
          <p className="caja-cc-sub">
            En base a un mes de lo cobrado (lunes a sábado; domingo el local no abre). Predice con el promedio
            de cada día hábil y la tendencia de las últimas dos semanas abiertas.
          </p>
        </div>
      </div>

      <div className="caja-cc-proy-horizonte">
        {([7, 14, 30] as const).map((h) => (
          <button
            key={h}
            type="button"
            className={horizonte === h ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
            onClick={() => setHorizonte(h)}
          >
            {h} días
          </button>
        ))}
      </div>

      <div className="caja-cc-proy-kpis">
        <article className="caja-cc-proy-kpi">
          <span>Predicción {horizonte} días</span>
          <strong>{money(predMonto)}</strong>
        </article>
        <article className="caja-cc-proy-kpi">
          <span>Promedio día abierto</span>
          <strong>{money(proy.promedioDiario)}</strong>
        </article>
        <article className="caja-cc-proy-kpi">
          <span>Tendencia 2 semanas</span>
          <strong>
            {proy.tendenciaPct > 0 ? '+' : ''}
            {proy.tendenciaPct.toFixed(0)}%
          </strong>
        </article>
        <article className={`caja-cc-proy-kpi ${confCls}`}>
          <span>Confianza</span>
          <strong>{proy.confianza}</strong>
          <small>{proy.diasConDatos} días abiertos con venta</small>
        </article>
      </div>

      <div className="caja-cc-proy-narrativa">
        <p>{aiTxt || proy.narrativa}</p>
        <p className="caja-cc-proy-meta">
          Mejor día: {proy.mejorDia} · Más flojo: {proy.peorDia} · Domingo cerrado
        </p>
        <button type="button" className="btn-secondary btn-small" disabled={aiBusy} onClick={() => void pedirInsight()}>
          {aiBusy ? 'Pensando…' : 'Insight PlotAI'}
        </button>
      </div>

      <section className="caja-cc-card caja-cc-proy-chart">
        <h3>Histórico 1 mes y predicción 14 días</h3>
        <div className="caja-cc-proy-chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={proy.serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => money(Number(v) || 0)} />
              <Line type="monotone" dataKey="real" name="Real" stroke="#0f766e" strokeWidth={2} dot={false} connectNulls={false} />
              <Line
                type="monotone"
                dataKey="proyectado"
                name="Proyectado"
                stroke="#c2410c"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="caja-cc-proy-pies">
        <section className="caja-cc-card">
          <h3>Qué se vende</h3>
          {proy.mixProductos.length === 0 ? (
            <p className="caja-cc-muted">Las ventas no traen ítems para armar la torta.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={proy.mixProductos} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={2}>
                  {proy.mixProductos.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(Number(v) || 0)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
        <section className="caja-cc-card">
          <h3>Cómo pagan</h3>
          {proy.mixPagos.length === 0 ? (
            <p className="caja-cc-muted">Sin medios de pago.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={proy.mixPagos} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={2}>
                  {proy.mixPagos.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(Number(v) || 0)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
        <section className="caja-cc-card">
          <h3>Quién vende</h3>
          {proy.mixVendedores.length === 0 ? (
            <p className="caja-cc-muted">Sin vendedores.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={proy.mixVendedores} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => money(Number(v) || 0)} />
                <Bar dataKey="value" fill="#1d4ed8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {proy.topProductosPrediccion.length > 0 && (
        <section className="caja-cc-card">
          <h3>Predicción de productos (próxima semana)</h3>
          <div className="caja-cc-table-scroll">
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant. estimada</th>
                  <th>Monto estimado</th>
                </tr>
              </thead>
              <tbody>
                {proy.topProductosPrediccion.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.qtySemana.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
                    <td>{money(r.montoSemana)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
