import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  calcularBalanceEconomico,
  type EgresoCajaEco,
  type GastoEco,
  type LiquidacionEmpleadoEco,
  type PagoProveedorEco,
  type VentaEco
} from '../features/reportes/balanceEconomico'
import {
  egresosCajaDelPeriodo,
  gastosDelPeriodo,
  liquidacionesEmpleadosDelPeriodo,
  pagosProveedoresDelPeriodo,
  ventasDelPeriodo
} from '../services/balanceEconomicoApi'
import { descargarCsv } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpReportesPage.css'

type Preset = 'mes' | 'mesAnterior' | 'trimestre' | 'anio' | '12m' | 'custom'

const COLORES = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#fb7185', '#f472b6', '#2dd4bf', '#94a3b8']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const hoyAr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fechaAr = (s: string) => s.split('-').reverse().join('/')
const pesos = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const corto = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `$${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (a >= 1_000) return `$${Math.round(v / 1000).toLocaleString('es-AR')} k`
  return `$${Math.round(v)}`
}
const pct = (parte: number, total: number) => (total > 0.009 ? `${((parte / total) * 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%` : '—')
const etiquetaDia = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
const etiquetaMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`

const tooltipEstilo = {
  contentStyle: { background: '#0f172a', border: '1px solid rgba(148,163,184,.3)', borderRadius: 10, color: '#e2e8f0', fontSize: 12 },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8' }
}

function rangoPreset(p: Preset, hoy: string): { desde: string; hasta: string } {
  const [y, m] = hoy.split('-').map(Number)
  if (p === 'mes') return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }
  if (p === 'mesAnterior') return { desde: iso(new Date(y, m - 2, 1)), hasta: iso(new Date(y, m - 1, 0)) }
  if (p === 'trimestre') {
    const q = Math.floor((m - 1) / 3) * 3
    return { desde: iso(new Date(y, q, 1)), hasta: hoy }
  }
  if (p === 'anio') return { desde: `${y}-01-01`, hasta: hoy }
  return { desde: iso(new Date(y, m - 12, 1)), hasta: hoy }
}

export default function ErpBalanceEconomicoPage() {
  const navigate = useNavigate()
  const hoy = hoyAr()
  const [preset, setPreset] = useState<Preset>('mes')
  const [rango, setRango] = useState(() => rangoPreset('mes', hoy))
  const [loading, setLoading] = useState(true)
  const [errores, setErrores] = useState<string[]>([])

  const [ventas, setVentas] = useState<VentaEco[]>([])
  const [gastos, setGastos] = useState<GastoEco[]>([])
  const [pagos, setPagos] = useState<PagoProveedorEco[]>([])
  const [egresos, setEgresos] = useState<EgresoCajaEco[]>([])
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionEmpleadoEco[]>([])

  const cargar = useCallback(async () => {
    setLoading(true)
    const errs: string[] = []
    const [v, g, p, e, l] = await Promise.all([
      ventasDelPeriodo(rango.desde, rango.hasta),
      gastosDelPeriodo(rango.desde, rango.hasta),
      pagosProveedoresDelPeriodo(rango.desde, rango.hasta),
      egresosCajaDelPeriodo(rango.desde, rango.hasta),
      liquidacionesEmpleadosDelPeriodo(rango.desde, rango.hasta)
    ])
    if (v.success) setVentas(v.data)
    else errs.push(`Ventas: ${v.error}`)
    if (g.success) setGastos(g.data)
    else errs.push(`Gastos: ${g.error}`)
    if (p.success) setPagos(p.data)
    else errs.push(`Proveedores: ${p.error}`)
    if (e.success) setEgresos(e.data)
    else errs.push(`Egresos: ${e.error}`)
    if (l.success) setLiquidaciones(l.data)
    else errs.push(`Liquidaciones: ${l.error}`)
    setErrores(errs)
    setLoading(false)
  }, [rango])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const be = useMemo(
    () => calcularBalanceEconomico(ventas, gastos, pagos, egresos, liquidaciones, rango.desde, rango.hasta),
    [ventas, gastos, pagos, egresos, liquidaciones, rango]
  )

  const serieChart = useMemo(() => {
    const dias = be.serieDiaria.length
    if (dias <= 45) return be.serieDiaria.map((d) => ({ ...d, etiqueta: etiquetaDia(d.fecha) }))
    // Agrupar por mes si el rango es largo
    const m = new Map<string, { ventas: number; salidas: number }>()
    for (const d of be.serieDiaria) {
      const k = d.fecha.slice(0, 7)
      const prev = m.get(k) ?? { ventas: 0, salidas: 0 }
      prev.ventas += d.ventas
      prev.salidas += d.salidas
      m.set(k, prev)
    }
    return [...m.entries()].map(([mes, x]) => ({
      fecha: mes,
      etiqueta: etiquetaMes(mes),
      ventas: x.ventas,
      salidas: x.salidas,
      neto: x.ventas - x.salidas
    }))
  }, [be.serieDiaria])

  const lineas = [
    { label: 'Ventas (todas, incl. CC)', valor: be.ventasTotal, tono: 'ok' as const },
    { label: '  · Contado y otros medios', valor: be.ventasContado, tono: 'muted' as const },
    { label: '  · Cuenta corriente', valor: be.ventasCc, tono: 'muted' as const },
    { label: '(-) Gastos corrientes', valor: -be.gastosCorrientes, tono: 'out' as const },
    { label: '(-) Gastos fijos pagados', valor: -be.gastosFijos, tono: 'out' as const },
    { label: '(-) Pagos a proveedores', valor: -be.pagosProveedores, tono: 'out' as const },
    { label: '(-) Egresos de caja', valor: -be.egresosCaja, tono: 'out' as const },
    { label: '(-) Liquidaciones a empleados', valor: -be.liquidacionesEmpleados, tono: 'out' as const },
    { label: 'Resultado económico', valor: be.resultado, tono: 'total' as const }
  ]

  const exportarCsv = () => {
    descargarCsv(
      `balance_economico_${rango.desde}_a_${rango.hasta}.csv`,
      ['Concepto', 'Importe'],
      lineas.map((l) => [l.label.trim(), l.valor.toFixed(2)])
    )
  }

  const elegirPreset = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setRango(rangoPreset(p, hoy))
  }

  return (
    <div className="erp-section reportes-page">
      <header className="erp-section-header rp-noprint">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            ⚖️
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Finanzas</p>
            <h1>Balance económico</h1>
            <p className="erp-section-sub">
              Ventas (incluida cuenta corriente) menos gastos, gastos fijos, pagos a proveedores, egresos de caja y liquidaciones a
              empleados
            </p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={exportarCsv} disabled={loading}>
            Exportar CSV
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()} disabled={loading}>
            Imprimir / PDF
          </button>
        </div>
      </header>

      <div className="rp-periodo rp-noprint">
        <div className="rp-presets" role="tablist" aria-label="Período">
          {(
            [
              ['mes', 'Este mes'],
              ['mesAnterior', 'Mes anterior'],
              ['trimestre', 'Trimestre'],
              ['anio', 'Año en curso'],
              ['12m', 'Últimos 12 meses'],
              ['custom', 'Personalizado']
            ] as Array<[Preset, string]>
          ).map(([p, l]) => (
            <button key={p} type="button" role="tab" aria-selected={preset === p} className={preset === p ? 'is-on' : undefined} onClick={() => elegirPreset(p)}>
              {l}
            </button>
          ))}
        </div>
        <div className="rp-fechas">
          <input
            type="date"
            value={rango.desde}
            onChange={(e) => {
              setPreset('custom')
              if (e.target.value) setRango((r) => ({ ...r, desde: e.target.value }))
            }}
            aria-label="Desde"
          />
          <span>→</span>
          <input
            type="date"
            value={rango.hasta}
            onChange={(e) => {
              setPreset('custom')
              if (e.target.value) setRango((r) => ({ ...r, hasta: e.target.value }))
            }}
            aria-label="Hasta"
          />
        </div>
      </div>

      <h2 className="rp-solo-print">
        Balance económico · {fechaAr(rango.desde)} al {fechaAr(rango.hasta)}
      </h2>

      {errores.length ? <div className="rp-aviso rp-noprint">{errores.join(' · ')}</div> : null}

      {loading ? (
        <p className="rp-vacio">Calculando balance económico…</p>
      ) : (
        <>
          <div className="rp-kpis">
            <article className="rp-kpi rp-kpi--azul">
              <span>Ventas</span>
              <strong>{pesos(be.ventasTotal)}</strong>
              <small>
                {be.cantidadVentas} ops · CC {pesos(be.ventasCc)}
              </small>
            </article>
            <article className="rp-kpi rp-kpi--cian">
              <span>Cobrado</span>
              <strong>{pesos(be.cobrado)}</strong>
              <small>pendiente CC {pesos(be.pendienteCc)}</small>
            </article>
            <article className="rp-kpi rp-kpi--rosa">
              <span>Salidas</span>
              <strong>{pesos(be.salidasTotal)}</strong>
              <small>
                sueldos {pesos(be.liquidacionesEmpleados)} · prov. {pesos(be.pagosProveedores)}
              </small>
            </article>
            <article className={`rp-kpi ${be.resultado >= 0 ? 'rp-kpi--verde' : 'rp-kpi--rojo'}`}>
              <span>Resultado</span>
              <strong>{pesos(be.resultado)}</strong>
              <small>{pct(be.resultado, be.ventasTotal)} sobre ventas</small>
            </article>
          </div>

          <div className="rp-grid rp-grid--2">
            <section className="rp-card">
              <h3>
                Cuadro económico <small>{fechaAr(rango.desde)} – {fechaAr(rango.hasta)}</small>
              </h3>
              <table className="rp-tabla">
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.label} className={l.tono === 'total' ? 'is-total' : undefined}>
                      <td className={l.tono === 'muted' ? 'rp-muted' : undefined}>{l.label}</td>
                      <td className={`num ${l.valor < 0 ? 'is-neg' : l.tono === 'ok' ? 'is-ok' : ''}`}>{pesos(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="erp-muted" style={{ marginTop: 10, fontSize: '0.8rem' }}>
                Las ventas incluyen cuenta corriente aunque aún no estén cobradas. Las liquidaciones son los pagos de sueldo
                registrados en RRHH.
              </p>
            </section>

            <section className="rp-card">
              <h3>En qué se va la plata</h3>
              {be.composicionSalidas.length === 0 ? (
                <p className="rp-vacio">Sin salidas en el período.</p>
              ) : (
                <div className="rp-dona-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={be.composicionSalidas} dataKey="valor" nameKey="nombre" innerRadius={55} outerRadius={85} paddingAngle={2}>
                        {be.composicionSalidas.map((d, i) => (
                          <Cell key={d.nombre} fill={COLORES[i % COLORES.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipEstilo} formatter={(v: number) => [pesos(v), 'Importe']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="rp-top">
                    {be.composicionSalidas.map((x, i) => (
                      <li key={x.nombre}>
                        <span>
                          <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: COLORES[i % COLORES.length], marginRight: 6 }} />
                          {x.nombre}
                        </span>
                        <b>
                          {pesos(x.valor)} · {pct(x.valor, be.salidasTotal)}
                        </b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <section className="rp-card">
            <h3>
              Evolución <small>ventas vs salidas</small>
            </h3>
            {serieChart.length === 0 ? (
              <p className="rp-vacio">Sin movimientos en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={serieChart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                  <XAxis dataKey="etiqueta" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={60} />
                  <Tooltip {...tooltipEstilo} formatter={(v: number, nombre: string) => [pesos(v), nombre]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar dataKey="ventas" name="Ventas" fill="#38bdf8" radius={[5, 5, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="salidas" name="Salidas" fill="#fb7185" radius={[5, 5, 0, 0]} maxBarSize={22} />
                  <Line dataKey="neto" name="Neto" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </section>

          <div className="rp-grid rp-grid--3">
            <section className="rp-card">
              <h3>Ventas por medio</h3>
              <ListaTop
                items={be.porMetodo.map((m) => ({ nombre: `${m.nombre} (${m.cantidad})`, importe: m.valor }))}
                vacio="Sin ventas."
              />
            </section>
            <section className="rp-card">
              <h3>Top clientes</h3>
              <ListaTop items={be.topClientes.map((c) => ({ nombre: c.nombre, importe: c.valor }))} vacio="Sin clientes." />
            </section>
            <section className="rp-card">
              <h3>Liquidaciones / sueldos</h3>
              <ListaTop
                items={be.topEmpleados.map((e) => ({ nombre: e.nombre, importe: e.valor }))}
                vacio="Sin pagos de liquidación en el período."
              />
              <p className="erp-muted" style={{ marginTop: 8, fontSize: '0.78rem' }}>
                Total sueldos pagados: <strong>{pesos(be.liquidacionesEmpleados)}</strong>
              </p>
            </section>
          </div>

          <div className="rp-grid rp-grid--2">
            <section className="rp-card">
              <h3>Gastos del período</h3>
              <ListaTop items={be.topGastos.map((g) => ({ nombre: g.nombre, importe: g.valor }))} vacio="Sin gastos." />
            </section>
            <section className="rp-card">
              <h3>Pagos a proveedores</h3>
              <ListaTop
                items={be.topProveedores.map((p) => ({ nombre: p.nombre, importe: p.valor }))}
                vacio="Sin pagos a proveedores."
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function ListaTop({ items, vacio }: { items: Array<{ nombre: string; importe: number }>; vacio: string }) {
  if (!items.length) return <p className="rp-vacio rp-vacio--chico">{vacio}</p>
  return (
    <ul className="rp-top">
      {items.slice(0, 6).map((x) => (
        <li key={x.nombre}>
          <span>{x.nombre}</span>
          <b>{pesos(x.importe)}</b>
        </li>
      ))}
    </ul>
  )
}
