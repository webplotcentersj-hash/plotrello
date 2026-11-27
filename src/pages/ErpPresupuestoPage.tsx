import { useEffect, useMemo, useState } from 'react'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import { gastosDelPeriodo, ventasDelPeriodo } from '../services/balanceEconomicoApi'
import { listCategoriasGastos } from '../services/erpGastosFijosApi'
import { guardarPresupuesto, listPresupuesto, type LineaPresupuesto, type TipoPresupuesto } from '../services/erpGestionApi'
import { parseMonto } from '../features/gestion/flujoCaja'
import { getArgentinaDateString } from '../utils/dateUtils'
import { descargarCsv, fmtMoney } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpGestion.css'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const VENTAS = 'Ventas'
const SIN_CAT = 'Sin categoría'

/** Real por mes (1..12) y categoría. */
type Real = Record<TipoPresupuesto, Map<string, number[]>>

const clave = (tipo: TipoPresupuesto, cat: string, mes: number) => `${tipo}|${cat}|${mes}`

export default function ErpPresupuestoPage() {
  const hoy = getArgentinaDateString()
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)))
  const [lineas, setLineas] = useState<Map<string, number>>(new Map())
  const [real, setReal] = useState<Real>({ ingreso: new Map(), gasto: new Map() })
  const [categorias, setCategorias] = useState<string[]>([])
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [nuevaCat, setNuevaCat] = useState('')
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    void (async () => {
      setCargando(true)
      setMsg(null)
      // Año elegido + los 3 meses previos (para sugerir con el promedio).
      const desde = `${anio - 1}-10-01`
      const hasta = `${anio}-12-31`
      const [p, v, g, cats] = await Promise.all([listPresupuesto(anio), ventasDelPeriodo(desde, hasta), gastosDelPeriodo(desde, hasta), listCategoriasGastos()])
      if (p.success) setLineas(new Map(p.data.map((l) => [clave(l.tipo, l.categoria, l.mes), l.monto])))
      else setMsg({ tipo: 'error', texto: p.error })
      // índice de mes relativo: 1..12 del año; -2..0 = oct..dic del año anterior
      const idx = (fecha: string) => (Number(fecha.slice(0, 4)) === anio ? Number(fecha.slice(5, 7)) : Number(fecha.slice(5, 7)) - 12)
      const r: Real = { ingreso: new Map(), gasto: new Map() }
      const sumar = (tipo: TipoPresupuesto, cat: string, i: number, monto: number) => {
        const arr = r[tipo].get(cat) ?? Array(16).fill(0)
        arr[i + 3] += monto
        r[tipo].set(cat, arr)
      }
      if (v.success) for (const x of v.data) sumar('ingreso', VENTAS, idx(x.fecha), x.valor_total)
      if (g.success) for (const x of g.data) sumar('gasto', x.categoria?.trim() || SIN_CAT, idx(x.fecha), x.total)
      setReal(r)
      setCategorias(cats.success ? cats.data : [])
      setCargando(false)
    })()
  }, [anio])

  /** Real del mes m (1..12; 0, -1, -2 = meses del año anterior). */
  const realDe = (tipo: TipoPresupuesto, cat: string, m: number) => real[tipo].get(cat)?.[m + 3] ?? 0
  const presDe = (tipo: TipoPresupuesto, cat: string, m: number) => lineas.get(clave(tipo, cat, m)) ?? 0

  const filas = useMemo(() => {
    const out: Record<TipoPresupuesto, string[]> = { ingreso: [VENTAS], gasto: [] }
    const gastos = new Set<string>(categorias)
    for (const k of lineas.keys()) {
      const [t, c] = k.split('|')
      if (t === 'gasto') gastos.add(c)
      else if (t === 'ingreso' && !out.ingreso.includes(c)) out.ingreso.push(c)
    }
    for (const c of real.gasto.keys()) gastos.add(c)
    out.gasto = [...gastos].sort((a, b) => (a === SIN_CAT ? 1 : b === SIN_CAT ? -1 : a.localeCompare(b)))
    return out
  }, [categorias, lineas, real])

  const guardar = async (items: LineaPresupuesto[]) => {
    const r = await guardarPresupuesto(items)
    if (!r.success) return setMsg({ tipo: 'error', texto: r.error })
    setLineas((prev) => {
      const n = new Map(prev)
      for (const l of items) n.set(clave(l.tipo, l.categoria, l.mes), l.monto)
      return n
    })
  }

  const confirmarCelda = (tipo: TipoPresupuesto, cat: string) => {
    const k = clave(tipo, cat, mes)
    const txt = editando[k]
    if (txt === undefined) return
    setEditando((e) => {
      const { [k]: _, ...resto } = e
      return resto
    })
    const monto = parseMonto(txt)
    if (monto === presDe(tipo, cat, mes)) return
    void guardar([{ anio, mes, tipo, categoria: cat, monto }])
  }

  const sugerir = async () => {
    const items: LineaPresupuesto[] = []
    for (const tipo of ['ingreso', 'gasto'] as const)
      for (const cat of filas[tipo]) {
        if (presDe(tipo, cat, mes) > 0) continue
        const prom = (realDe(tipo, cat, mes - 1) + realDe(tipo, cat, mes - 2) + realDe(tipo, cat, mes - 3)) / 3
        if (prom > 0) items.push({ anio, mes, tipo, categoria: cat, monto: Math.round(prom / 1000) * 1000 })
      }
    if (!items.length) return setMsg({ tipo: 'ok', texto: 'No hay categorías vacías con historia para sugerir.' })
    await guardar(items)
    setMsg({ tipo: 'ok', texto: `Sugeridas ${items.length} categorías con el promedio de los 3 meses anteriores (redondeado). Ajustalas si hace falta.` })
  }

  const copiarAlResto = async () => {
    if (!window.confirm(`¿Copiar el presupuesto de ${MESES[mes - 1]} a los meses siguientes de ${anio} (sobrescribe)?`)) return
    const items: LineaPresupuesto[] = []
    for (const tipo of ['ingreso', 'gasto'] as const)
      for (const cat of filas[tipo]) {
        const monto = presDe(tipo, cat, mes)
        if (monto <= 0) continue
        for (let m = mes + 1; m <= 12; m++) items.push({ anio, mes: m, tipo, categoria: cat, monto })
      }
    if (!items.length) return
    await guardar(items)
    setMsg({ tipo: 'ok', texto: `Copiado a ${12 - mes} meses.` })
  }

  const agregarCategoria = () => {
    const c = nuevaCat.trim()
    if (!c) return
    void guardar([{ anio, mes, tipo: 'gasto', categoria: c, monto: 0 }])
    setNuevaCat('')
  }

  const mesTranscurrido = (() => {
    const actual = `${anio}-${String(mes).padStart(2, '0')}`
    const ym = hoy.slice(0, 7)
    if (actual < ym) return 1
    if (actual > ym) return 0
    const [y, m] = ym.split('-').map(Number)
    return Number(hoy.slice(8, 10)) / new Date(y, m, 0).getDate()
  })()

  const resumen = (tipo: TipoPresupuesto, hastaMes: number, desdeMes = 1) => {
    let p = 0
    let r = 0
    for (const cat of filas[tipo])
      for (let m = desdeMes; m <= hastaMes; m++) {
        p += presDe(tipo, cat, m)
        r += realDe(tipo, cat, m)
      }
    return { p, r }
  }
  const ingMes = resumen('ingreso', mes, mes)
  const gasMes = resumen('gasto', mes, mes)
  const ingAnio = resumen('ingreso', mes)
  const gasAnio = resumen('gasto', mes)

  const alertas = useMemo(() => {
    const out: { cat: string; texto: string; tono: 'danger' | 'warn' }[] = []
    for (const cat of filas.gasto) {
      const p = presDe('gasto', cat, mes)
      const r = realDe('gasto', cat, mes)
      if (p <= 0) continue
      if (r > p) out.push({ cat, tono: 'danger', texto: `${cat}: ya gastaste ${fmtMoney(r)}, ${Math.round((r / p - 1) * 100)}% más de lo previsto` })
      else if (mesTranscurrido > 0 && mesTranscurrido < 1 && r / mesTranscurrido > p * 1.1)
        out.push({ cat, tono: 'warn', texto: `${cat}: a este ritmo cerrás el mes en ${fmtMoney(r / mesTranscurrido)} (previsto ${fmtMoney(p)})` })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, lineas, real, mes, mesTranscurrido])

  const seccion = (tipo: TipoPresupuesto, titulo: string) => {
    const total = filas[tipo].reduce(
      (acc, cat) => ({ p: acc.p + presDe(tipo, cat, mes), r: acc.r + realDe(tipo, cat, mes) }),
      { p: 0, r: 0 }
    )
    return (
      <section className="erp-panel">
        <div className="gx-cab">
          <h2>{titulo}</h2>
          <span className="gx-mini">Tocá el presupuesto para editarlo</span>
        </div>
        <div className="gx-tabla-wrap">
          <table className="gx-tabla">
            <thead>
              <tr>
                <th>Categoría</th>
                <th className="num">Presupuesto</th>
                <th className="num">Real</th>
                <th style={{ minWidth: 180 }}>Avance</th>
                <th className="num">Desvío</th>
                <th className="num">Acumulado del año</th>
              </tr>
            </thead>
            <tbody>
              {filas[tipo].map((cat) => {
                const p = presDe(tipo, cat, mes)
                const r = realDe(tipo, cat, mes)
                const k = clave(tipo, cat, mes)
                const pct = p > 0 ? (r / p) * 100 : null
                // En ingresos, pasarse es bueno; en gastos, malo.
                const malo = pct !== null && (tipo === 'gasto' ? pct > 100 : mesTranscurrido >= 1 && pct < 90)
                const color = pct === null ? '#64748b' : malo ? '#f87171' : tipo === 'gasto' && pct > 85 ? '#fbbf24' : '#34d399'
                let pa = 0
                let ra = 0
                for (let m = 1; m <= mes; m++) {
                  pa += presDe(tipo, cat, m)
                  ra += realDe(tipo, cat, m)
                }
                if (p === 0 && r === 0 && pa === 0 && ra === 0) return null
                return (
                  <tr key={cat}>
                    <td>
                      <strong>{cat}</strong>
                    </td>
                    <td className="num" style={{ width: 150 }}>
                      <input
                        className="gx-celda-input"
                        inputMode="decimal"
                        value={editando[k] ?? (p ? p.toLocaleString('es-AR') : '')}
                        placeholder="—"
                        onChange={(e) => setEditando((x) => ({ ...x, [k]: e.target.value }))}
                        onBlur={() => confirmarCelda(tipo, cat)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        aria-label={`Presupuesto ${cat}`}
                      />
                    </td>
                    <td className="num">{fmtMoney(r)}</td>
                    <td>
                      {pct !== null ? (
                        <div style={{ position: 'relative' }}>
                          <div className="gx-progreso" style={{ height: 8 }}>
                            <span style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                          </div>
                          {mesTranscurrido > 0 && mesTranscurrido < 1 && (
                            <span
                              title="Hoy"
                              style={{ position: 'absolute', top: -3, left: `${mesTranscurrido * 100}%`, width: 2, height: 14, background: '#e2e8f0', borderRadius: 1 }}
                            />
                          )}
                          <span className="gx-mini">{pct.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="gx-mini">sin presupuesto</span>
                      )}
                    </td>
                    <td className={`num ${malo ? 'gx-neg' : ''}`}>{p > 0 ? `${r - p >= 0 ? '+' : ''}${fmtMoney(r - p)}` : '—'}</td>
                    <td className="num">
                      {fmtMoney(ra)}
                      {pa > 0 && <div className="gx-mini">de {fmtMoney(pa)}</div>}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="num">
                  <strong>{fmtMoney(total.p)}</strong>
                </td>
                <td className="num">
                  <strong>{fmtMoney(total.r)}</strong>
                </td>
                <td />
                <td className="num">{total.p > 0 ? fmtMoney(total.r - total.p) : '—'}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {tipo === 'gasto' && (
          <div className="gx-controles" style={{ marginTop: 10, marginBottom: 0 }}>
            <input value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} placeholder="Nueva categoría de gasto" onKeyDown={(e) => e.key === 'Enter' && agregarCategoria()} />
            <button type="button" className="erpx-btn-sm" onClick={agregarCategoria}>
              + Agregar
            </button>
            <span className="gx-mini">Las categorías sin presupuesto ni gastos en el año no se muestran.</span>
          </div>
        )}
      </section>
    )
  }

  const exportar = () => {
    const filasCsv: Array<Array<string | number>> = []
    for (const tipo of ['ingreso', 'gasto'] as const)
      for (const cat of filas[tipo])
        for (let m = 1; m <= 12; m++) {
          const p = presDe(tipo, cat, m)
          const r = realDe(tipo, cat, m)
          if (p || r) filasCsv.push([anio, MESES[m - 1], tipo === 'ingreso' ? 'Ingreso' : 'Gasto', cat, p, r, r - p])
        }
    descargarCsv(`presupuesto_${anio}.csv`, ['Año', 'Mes', 'Tipo', 'Categoría', 'Presupuesto', 'Real', 'Desvío'], filasCsv)
  }

  const resultadoP = ingMes.p - gasMes.p
  const resultadoR = ingMes.r - gasMes.r

  return (
    <div className="erp-section gx">
      <ErpPageHeader icon="🎯" titulo="Presupuesto vs. real" subtitulo="Cuánto pensabas vender y gastar, contra lo que pasó. Con alertas cuando una categoría se dispara." volverA="/erp" volverTexto="ERP">
        <button type="button" className="btn-secondary" onClick={exportar}>
          Exportar CSV
        </button>
      </ErpPageHeader>

      {msg && <p className={`erpx-msg erpx-msg--${msg.tipo}`}>{msg.texto}</p>}

      <div className="gx-controles">
        <label className="erp-field">
          <span className="erp-field__label">Año</span>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {[anio - 1, anio, anio + 1].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <div className="gx-chips">
          {MESES.map((m, i) => (
            <button key={m} type="button" className={`gx-chip ${mes === i + 1 ? 'is-on' : ''}`} onClick={() => setMes(i + 1)}>
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
        <button type="button" className="erpx-btn-sm" onClick={() => void sugerir()} disabled={cargando}>
          ✨ Sugerir con los últimos 3 meses
        </button>
        <button type="button" className="erpx-btn-sm" onClick={() => void copiarAlResto()} disabled={cargando || mes === 12}>
          Copiar a los meses siguientes
        </button>
      </div>

      {cargando ? (
        <div className="erp-panel">
          <p className="erp-muted">Cargando…</p>
        </div>
      ) : (
        <>
          <div className="gx-tiles">
            <div className="gx-tile gx-tile--ok">
              <span className="gx-tile__label">Ventas {MESES[mes - 1].toLowerCase()}</span>
              <span className="gx-tile__valor">{fmtMoney(ingMes.r)}</span>
              <span className="gx-tile__sub">{ingMes.p ? `${Math.round((ingMes.r / ingMes.p) * 100)}% de ${fmtMoney(ingMes.p)}` : 'sin presupuesto'}</span>
            </div>
            <div className="gx-tile gx-tile--warn">
              <span className="gx-tile__label">Gastos {MESES[mes - 1].toLowerCase()}</span>
              <span className="gx-tile__valor">{fmtMoney(gasMes.r)}</span>
              <span className="gx-tile__sub">{gasMes.p ? `${Math.round((gasMes.r / gasMes.p) * 100)}% de ${fmtMoney(gasMes.p)}` : 'sin presupuesto'}</span>
            </div>
            <div className={`gx-tile ${resultadoR < resultadoP ? 'gx-tile--danger' : 'gx-tile--ok'}`}>
              <span className="gx-tile__label">Resultado del mes</span>
              <span className={`gx-tile__valor ${resultadoR < 0 ? 'gx-neg' : ''}`}>{fmtMoney(resultadoR)}</span>
              <span className="gx-tile__sub">previsto {fmtMoney(resultadoP)}</span>
            </div>
            <div className="gx-tile gx-tile--info">
              <span className="gx-tile__label">Acumulado {anio}</span>
              <span className={`gx-tile__valor ${ingAnio.r - gasAnio.r < 0 ? 'gx-neg' : ''}`}>{fmtMoney(ingAnio.r - gasAnio.r)}</span>
              <span className="gx-tile__sub">previsto {fmtMoney(ingAnio.p - gasAnio.p)}</span>
            </div>
          </div>

          {alertas.map((a) => (
            <div key={a.cat} className={`gx-banner gx-banner--${a.tono}`}>
              <span className="gx-banner__icono">{a.tono === 'danger' ? '🔥' : '📈'}</span>
              <div>{a.texto}</div>
            </div>
          ))}

          {seccion('ingreso', 'Ingresos')}
          {seccion('gasto', 'Gastos')}
          <p className="gx-mini">Ventas reales = ventas registradas en el mes. Gastos reales = gastos cargados en Gastos (incluye pagos de gastos fijos), por categoría.</p>
        </>
      )}
    </div>
  )
}
