import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  Bar,
  BarChart,
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
  ETIQUETA_LINEA,
  antiguedad,
  composicionEgresos,
  estadoResultados,
  evolucionMensual,
  flujoFondos,
  periodoAnterior,
  situacionPatrimonial,
  variacionPct,
  type CuentaPlan,

  type LineaER,
  type Movimiento,
  type Pendiente,
  type SaldoCuenta
} from '../features/reportes/estadosContables'
import {
  facturasDelPeriodo,
  movimientos as cargarMovimientos,
  pendientesDeCobro,
  pendientesDePago,
  planDeCuentas,
  saldosAl,
  type FacturaReporte
} from '../services/reportesApi'
import { comprobanteVigente, letraComprobante, signoComprobante } from '../services/facturacionResumen'
import { descargarCsv } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpReportesPage.css'

type Pestana = 'resumen' | 'resultados' | 'patrimonio' | 'flujo' | 'ventas'
type Preset = 'mes' | 'mesAnterior' | 'trimestre' | 'anio' | '12m' | 'custom'

const COLORES = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#fb7185', '#f472b6', '#2dd4bf', '#94a3b8']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const hoyAr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fechaAr = (s: string) => s.split('-').reverse().join('/')
const pesos = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const pesos2 = (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const corto = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `$${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (a >= 1_000) return `$${Math.round(v / 1000).toLocaleString('es-AR')} k`
  return `$${Math.round(v)}`
}
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`)
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

function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return iso(d)
}

export default function ErpReportesPage() {
  const navigate = useNavigate()
  const hoy = hoyAr()
  const [pestana, setPestana] = useState<Pestana>('resumen')
  const [preset, setPreset] = useState<Preset>('mes')
  const [rango, setRango] = useState(() => rangoPreset('mes', hoy))

  const [movs, setMovs] = useState<Movimiento[]>([])
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([])
  const [saldosInicio, setSaldosInicio] = useState<SaldoCuenta[]>([])
  const [plan, setPlan] = useState<CuentaPlan[]>([])
  const [cobrar, setCobrar] = useState<Pendiente[]>([])
  const [pagar, setPagar] = useState<Pendiente[]>([])
  const [facturas, setFacturas] = useState<FacturaReporte[]>([])
  const [loading, setLoading] = useState(true)
  const [errores, setErrores] = useState<string[]>([])
  const [abiertas, setAbiertas] = useState<Set<LineaER>>(new Set())

  const anterior = useMemo(() => periodoAnterior(rango.desde, rango.hasta), [rango])
  // Ventana de movimientos: 12 meses para la evolución, y el período anterior para comparar.
  const ventanaDesde = useMemo(() => {
    const [y, m] = rango.hasta.split('-').map(Number)
    const doce = iso(new Date(y, m - 12, 1))
    return [doce, anterior.desde, rango.desde].sort()[0]
  }, [rango, anterior])

  const cargar = useCallback(async () => {
    setLoading(true)
    const errs: string[] = []
    const [mv, sa, si, pl, pc, pp, fa] = await Promise.all([
      cargarMovimientos(ventanaDesde, rango.hasta),
      saldosAl(rango.hasta),
      saldosAl(diaAnterior(rango.desde)),
      planDeCuentas(),
      pendientesDeCobro(),
      pendientesDePago(),
      facturasDelPeriodo(anterior.desde < rango.desde ? anterior.desde : rango.desde, rango.hasta)
    ])
    if (mv.success) setMovs(mv.data)
    else errs.push(`Movimientos: ${mv.error}`)
    if (sa.success) setSaldos(sa.data)
    else errs.push(`Saldos: ${sa.error}`)
    if (si.success) setSaldosInicio(si.data)
    if (pl.success) setPlan(pl.data)
    if (pc.success) setCobrar(pc.data)
    else errs.push(`Cuentas por cobrar: ${pc.error}`)
    if (pp.success) setPagar(pp.data)
    if (fa.success) setFacturas(fa.data)
    else errs.push(`Facturas: ${fa.error}`)
    setErrores(errs)
    setLoading(false)
  }, [ventanaDesde, rango, anterior])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const elegirPreset = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setRango(rangoPreset(p, hoy))
  }

  // ── Cálculos ──────────────────────────────────────────────────────────
  const er = useMemo(() => estadoResultados(movs, rango.desde, rango.hasta), [movs, rango])
  const erAnt = useMemo(() => estadoResultados(movs, anterior.desde, anterior.hasta), [movs, anterior])
  const sp = useMemo(() => situacionPatrimonial(saldos, plan), [saldos, plan])
  const evolucion = useMemo(() => {
    const [y, m] = rango.hasta.split('-').map(Number)
    return evolucionMensual(movs, iso(new Date(y, m - 12, 1)), rango.hasta).map((p) => ({ ...p, etiqueta: etiquetaMes(p.mes) }))
  }, [movs, rango])
  const egresos = useMemo(() => {
    const lista = composicionEgresos(movs, rango.desde, rango.hasta, plan)
    if (lista.length <= 6) return lista
    return [...lista.slice(0, 5), { nombre: 'Otros', valor: lista.slice(5).reduce((s, x) => s + x.valor, 0) }]
  }, [movs, rango, plan])
  const saldoInicialDisp = useMemo(
    () => saldosInicio.filter((s) => s.codigo.startsWith('1.1.1')).reduce((t, s) => t + s.debe - s.haber, 0),
    [saldosInicio]
  )
  const flujo = useMemo(
    () => flujoFondos(movs, rango.desde, rango.hasta, saldoInicialDisp).map((p) => ({ ...p, etiqueta: etiquetaMes(p.mes) })),
    [movs, rango, saldoInicialDisp]
  )
  const agCobrar = useMemo(() => antiguedad(cobrar, hoy), [cobrar, hoy])
  const agPagar = useMemo(() => antiguedad(pagar, hoy), [pagar, hoy])

  const ventas = useMemo(() => {
    const resumir = (desde: string, hasta: string) => {
      const vig = facturas.filter((f) => f.fecha_emision >= desde && f.fecha_emision <= hasta && comprobanteVigente(f as never))
      let total = 0
      let iva = 0
      let facturasN = 0
      let notasCredito = 0
      const porLetra = new Map<string, number>()
      const porCliente = new Map<string, { total: number; cantidad: number }>()
      const porDia = new Map<string, number>()
      for (const f of vig) {
        const s = signoComprobante(f.tipo_comprobante)
        total += s * f.total
        iva += s * f.iva
        if (s > 0 && f.tipo_comprobante.startsWith('Factura')) facturasN++
        if (s < 0) notasCredito += f.total
        const l = letraComprobante(f.tipo_comprobante) ?? '?'
        porLetra.set(l, (porLetra.get(l) ?? 0) + s * f.total)
        const c = porCliente.get(f.cliente_nombre) ?? { total: 0, cantidad: 0 }
        c.total += s * f.total
        if (s > 0) c.cantidad++
        porCliente.set(f.cliente_nombre, c)
        porDia.set(f.fecha_emision, (porDia.get(f.fecha_emision) ?? 0) + s * f.total)
      }
      return {
        total,
        iva,
        neto: total - iva,
        facturas: facturasN,
        notasCredito,
        ticket: facturasN ? total / facturasN : 0,
        porLetra: [...porLetra.entries()].map(([nombre, valor]) => ({ nombre: `Factura ${nombre}`, valor })).filter((x) => x.valor > 0),
        clientes: [...porCliente.entries()].map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total).slice(0, 10),
        dias: [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, total]) => ({ fecha, etiqueta: fechaAr(fecha).slice(0, 5), total }))
      }
    }
    return { actual: resumir(rango.desde, rango.hasta), anterior: resumir(anterior.desde, anterior.hasta) }
  }, [facturas, rango, anterior])

  // ── Lecturas del período ──────────────────────────────────────────────
  const lecturas = useMemo(() => {
    const out: Array<{ tono: 'ok' | 'warn' | 'danger' | 'info'; texto: string }> = []
    if (!loading && movs.filter((m) => m.fecha >= rango.desde).length === 0) {
      out.push({ tono: 'warn', texto: 'No hay asientos contabilizados en el período: los estados contables salen en cero. Revisá el Libro Diario.' })
      return out
    }
    if (er.neto < 0) out.push({ tono: 'danger', texto: `El período da pérdida de ${pesos(Math.abs(er.neto))}.` })
    else if (er.neto > 0) out.push({ tono: 'ok', texto: `Resultado positivo de ${pesos(er.neto)} (${pct(er.margenNeto)} sobre ventas).` })
    const vVentas = variacionPct(er.ventas, erAnt.ventas)
    const egresosAct = -(er.costo + er.administracion + er.comercializacion + er.financieros)
    const egresosAnt = -(erAnt.costo + erAnt.administracion + erAnt.comercializacion + erAnt.financieros)
    const vEgresos = variacionPct(egresosAct, egresosAnt)
    if (vVentas !== null && vEgresos !== null && vEgresos - vVentas > 10) {
      out.push({ tono: 'warn', texto: `Los costos y gastos crecieron ${pct(vEgresos)} y las ventas ${pct(vVentas)}: se achica el margen.` })
    }
    if (er.margenBruto !== null && erAnt.margenBruto !== null && er.margenBruto < erAnt.margenBruto - 5) {
      out.push({ tono: 'warn', texto: `El margen bruto bajó de ${pct(erAnt.margenBruto)} a ${pct(er.margenBruto)}.` })
    }
    const lc = sp.indices.liquidezCorriente
    if (lc !== null && lc < 1) out.push({ tono: 'danger', texto: `Liquidez corriente ${lc.toFixed(2)}: las deudas de corto plazo superan al activo corriente.` })
    if (agCobrar.total > 0 && agCobrar.vencido / agCobrar.total > 0.3) {
      out.push({ tono: 'warn', texto: `El ${pct((agCobrar.vencido / agCobrar.total) * 100)} de lo que te deben está vencido (${pesos(agCobrar.vencido)}).` })
    }
    const pagarProximo = agPagar.tramos.find((t) => t.tramo === 'A vencer')?.importe ?? 0
    if (agPagar.vencido > 0) out.push({ tono: 'warn', texto: `Hay ${pesos(agPagar.vencido)} vencidos con proveedores.` })
    if (sp.disponibilidades > 0 && pagarProximo > sp.disponibilidades) {
      out.push({ tono: 'warn', texto: `Los pagos a vencer (${pesos(pagarProximo)}) superan la caja y bancos (${pesos(sp.disponibilidades)}).` })
    }
    if (Math.abs(sp.diferencia) >= 1) out.push({ tono: 'danger', texto: `El balance no cierra por ${pesos(sp.diferencia)}: hay asientos desbalanceados.` })
    return out
  }, [loading, movs, rango, er, erAnt, sp, agCobrar, agPagar])

  // ── Exportar ──────────────────────────────────────────────────────────
  const lineasER: Array<{ clave: LineaER | 'bruto' | 'antes' | 'neto'; label: string; act: number; ant: number; total?: boolean }> = [
    { clave: 'ventas', label: ETIQUETA_LINEA.ventas, act: er.ventas, ant: erAnt.ventas },
    { clave: 'costo', label: ETIQUETA_LINEA.costo, act: er.costo, ant: erAnt.costo },
    { clave: 'bruto', label: 'Resultado bruto', act: er.bruto, ant: erAnt.bruto, total: true },
    { clave: 'administracion', label: ETIQUETA_LINEA.administracion, act: er.administracion, ant: erAnt.administracion },
    { clave: 'comercializacion', label: ETIQUETA_LINEA.comercializacion, act: er.comercializacion, ant: erAnt.comercializacion },
    { clave: 'financieros', label: ETIQUETA_LINEA.financieros, act: er.financieros, ant: erAnt.financieros },
    { clave: 'otros', label: ETIQUETA_LINEA.otros, act: er.otros, ant: erAnt.otros },
    { clave: 'antes', label: 'Resultado antes del impuesto', act: er.antesImpuesto, ant: erAnt.antesImpuesto, total: true },
    { clave: 'ganancias', label: ETIQUETA_LINEA.ganancias, act: er.ganancias, ant: erAnt.ganancias },
    { clave: 'neto', label: 'Resultado neto del período', act: er.neto, ant: erAnt.neto, total: true }
  ]

  const exportarCsv = () => {
    const nombre = `${pestana}_${rango.desde}_a_${rango.hasta}.csv`
    if (pestana === 'resultados' || pestana === 'resumen') {
      const filas: Array<Array<string | number>> = []
      for (const l of lineasER) {
        filas.push([l.label, l.act.toFixed(2), l.ant.toFixed(2)])
        if (!l.total) for (const d of er.detalle[l.clave as LineaER] ?? []) filas.push([`   ${d.codigo} ${d.nombre}`, d.importe.toFixed(2), ''])
      }
      descargarCsv(nombre, ['Concepto', `${rango.desde} a ${rango.hasta}`, `${anterior.desde} a ${anterior.hasta}`], filas)
    } else if (pestana === 'patrimonio') {
      const filas: Array<Array<string | number>> = []
      const add = (titulo: string, b: { rubros: Array<{ codigo: string; nombre: string; importe: number }>; total: number }) => {
        filas.push([titulo, '', b.total.toFixed(2)])
        b.rubros.forEach((r) => filas.push(['', `${r.codigo} ${r.nombre}`, r.importe.toFixed(2)]))
      }
      add('Activo corriente', sp.activoCorriente)
      add('Activo no corriente', sp.activoNoCorriente)
      add('Pasivo corriente', sp.pasivoCorriente)
      add('Pasivo no corriente', sp.pasivoNoCorriente)
      add('Patrimonio neto', sp.patrimonio)
      filas.push(['Resultado del ejercicio (no cerrado)', '', sp.resultadoNoCerrado.toFixed(2)])
      descargarCsv(nombre, ['Rubro', 'Cuenta', `Al ${rango.hasta}`], filas)
    } else if (pestana === 'flujo') {
      descargarCsv(nombre, ['Mes', 'Entradas', 'Salidas', 'Neto', 'Saldo'], flujo.map((f) => [f.mes, f.entradas.toFixed(2), f.salidas.toFixed(2), f.neto.toFixed(2), f.saldo.toFixed(2)]))
    } else {
      descargarCsv(nombre, ['Cliente', 'Facturas', 'Total'], ventas.actual.clientes.map((c) => [c.nombre, c.cantidad, c.total.toFixed(2)]))
    }
  }

  const delta = (act: number, ant: number, invertir = false) => {
    const v = variacionPct(act, ant)
    if (v === null) return <span className="rp-delta rp-delta--neutro">sin comparación</span>
    const bueno = invertir ? v <= 0 : v >= 0
    return (
      <span className={`rp-delta ${bueno ? 'rp-delta--sube' : 'rp-delta--baja'}`}>
        {v >= 0 ? '▲' : '▼'} {Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%
      </span>
    )
  }

  const semaforo = (valor: number | null, bueno: number, regular: number, mayorEsMejor = true) => {
    if (valor === null) return 'neutro'
    if (mayorEsMejor) return valor >= bueno ? 'ok' : valor >= regular ? 'warn' : 'danger'
    return valor <= bueno ? 'ok' : valor <= regular ? 'warn' : 'danger'
  }

  return (
    <div className="erp-section reportes-page">
      <header className="erp-section-header rp-noprint">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            📊
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Contable</p>
            <h1>Reportes financieros</h1>
            <p className="erp-section-sub">Resultados, situación patrimonial, flujo de fondos y ventas, con comparación contra el período anterior</p>
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

      {/* Período */}
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
          <small>
            compara con {fechaAr(anterior.desde)} – {fechaAr(anterior.hasta)}
          </small>
        </div>
      </div>

      <h2 className="rp-solo-print">
        Reportes financieros · {fechaAr(rango.desde)} al {fechaAr(rango.hasta)}
      </h2>

      {errores.length ? <div className="rp-aviso rp-noprint">{errores.join(' · ')}</div> : null}

      {/* Pestañas */}
      <nav className="rp-tabs rp-noprint" role="tablist" aria-label="Reportes">
        {(
          [
            ['resumen', 'Resumen'],
            ['resultados', 'Estado de resultados'],
            ['patrimonio', 'Situación patrimonial'],
            ['flujo', 'Flujo de fondos'],
            ['ventas', 'Ventas']
          ] as Array<[Pestana, string]>
        ).map(([p, l]) => (
          <button key={p} type="button" role="tab" aria-selected={pestana === p} className={pestana === p ? 'is-on' : undefined} onClick={() => setPestana(p)}>
            {l}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="rp-vacio">Calculando reportes…</p>
      ) : pestana === 'resumen' ? (
        <>
          <div className="rp-kpis">
            <article className="rp-kpi rp-kpi--azul">
              <span>Ventas netas</span>
              <strong>{pesos(er.ventas)}</strong>
              {delta(er.ventas, erAnt.ventas)}
            </article>
            <article className={`rp-kpi ${er.neto >= 0 ? 'rp-kpi--verde' : 'rp-kpi--rojo'}`}>
              <span>Resultado neto</span>
              <strong>{pesos(er.neto)}</strong>
              <small>margen {pct(er.margenNeto)}</small>
            </article>
            <article className="rp-kpi rp-kpi--violeta">
              <span>Margen bruto</span>
              <strong>{pct(er.margenBruto)}</strong>
              <small>antes {pct(erAnt.margenBruto)}</small>
            </article>
            <article className="rp-kpi rp-kpi--cian">
              <span>Caja y bancos</span>
              <strong>{pesos(sp.disponibilidades)}</strong>
              <small>al {fechaAr(rango.hasta)}</small>
            </article>
            <article className="rp-kpi rp-kpi--ambar">
              <span>Te deben</span>
              <strong>{pesos(agCobrar.total)}</strong>
              <small>vencido {pesos(agCobrar.vencido)}</small>
            </article>
            <article className="rp-kpi rp-kpi--rosa">
              <span>Debés a proveedores</span>
              <strong>{pesos(agPagar.total)}</strong>
              <small>vencido {pesos(agPagar.vencido)}</small>
            </article>
          </div>

          {lecturas.length ? (
            <section className="rp-card rp-lecturas">
              <h3>Lectura del período</h3>
              <ul>
                {lecturas.map((l) => (
                  <li key={l.texto} className={`is-${l.tono}`}>
                    {l.texto}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="rp-grid rp-grid--2">
            <section className="rp-card">
              <h3>
                Últimos 12 meses <small>ingresos, costos y gastos, resultado</small>
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={evolucion} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                  <XAxis dataKey="etiqueta" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={60} />
                  <Tooltip {...tooltipEstilo} formatter={(v: number, nombre: string) => [pesos(v), nombre]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#38bdf8" radius={[5, 5, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="egresos" name="Costos y gastos" fill="#fb7185" radius={[5, 5, 0, 0]} maxBarSize={22} />
                  <Line dataKey="resultado" name="Resultado" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </section>
            <section className="rp-card">
              <h3>En qué se va la plata</h3>
              {egresos.length === 0 ? (
                <p className="rp-vacio">Sin costos ni gastos en el período.</p>
              ) : (
                <Dona datos={egresos} centro={corto(egresos.reduce((s, x) => s + x.valor, 0))} sub="egresos" />
              )}
            </section>
          </div>

          <div className="rp-grid rp-grid--3">
            <section className="rp-card">
              <h3>Indicadores</h3>
              <div className="rp-indices">
                <Indice
                  nombre="Liquidez corriente"
                  valor={sp.indices.liquidezCorriente}
                  estado={semaforo(sp.indices.liquidezCorriente, 1.5, 1)}
                  ayuda="Activo corriente / pasivo corriente. Más de 1,5 es holgado."
                />
                <Indice
                  nombre="Prueba ácida"
                  valor={sp.indices.pruebaAcida}
                  estado={semaforo(sp.indices.pruebaAcida, 1, 0.7)}
                  ayuda="Sin contar el stock. Cerca de 1 o más es sano."
                />
                <Indice
                  nombre="Endeudamiento"
                  valor={sp.indices.endeudamiento}
                  estado={semaforo(sp.indices.endeudamiento, 1, 2, false)}
                  ayuda="Pasivo / patrimonio neto. Menos de 1: se financia más con capital propio."
                />
                <div className="rp-indice">
                  <span>Capital de trabajo</span>
                  <strong className={sp.indices.capitalTrabajo >= 0 ? 'is-ok' : 'is-danger'}>{pesos(sp.indices.capitalTrabajo)}</strong>
                  <small>Activo corriente menos pasivo corriente.</small>
                </div>
              </div>
            </section>
            <section className="rp-card">
              <h3>
                Antigüedad de lo que te deben <small>{pesos(agCobrar.total)}</small>
              </h3>
              <Aging datos={agCobrar.tramos} color="#38bdf8" />
              <ListaTop items={agCobrar.principales} vacio="Nadie te debe." />
            </section>
            <section className="rp-card">
              <h3>
                Antigüedad de lo que debés <small>{pesos(agPagar.total)}</small>
              </h3>
              <Aging datos={agPagar.tramos} color="#fb7185" />
              <ListaTop items={agPagar.principales} vacio="Sin deudas con proveedores." />
            </section>
          </div>
        </>
      ) : pestana === 'resultados' ? (
        <section className="rp-card">
          <h3>
            Estado de resultados <small>formato RT 9 · tocá una línea para ver las cuentas</small>
          </h3>
          <table className="rp-tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="num">
                  {fechaAr(rango.desde)} – {fechaAr(rango.hasta)}
                </th>
                <th className="num">% ventas</th>
                <th className="num">Período anterior</th>
                <th className="num">Variación</th>
              </tr>
            </thead>
            <tbody>
              {lineasER.map((l) => {
                const detalle = l.total ? [] : er.detalle[l.clave as LineaER] ?? []
                const abierta = abiertas.has(l.clave as LineaER)
                return (
                  <Fragment key={l.clave}>
                    <tr
                      className={`${l.total ? 'rp-fila-total' : 'rp-fila'}${detalle.length ? ' is-click' : ''}${l.clave === 'neto' ? ' rp-fila-neto' : ''}`}
                      onClick={() =>
                        detalle.length &&
                        setAbiertas((p) => {
                          const n = new Set(p)
                          const k = l.clave as LineaER
                          if (n.has(k)) n.delete(k)
                          else n.add(k)
                          return n
                        })
                      }
                    >
                      <td>
                        {detalle.length ? <span className="rp-caret">{abierta ? '▾' : '▸'}</span> : null}
                        {l.label}
                      </td>
                      <td className={`num ${l.act < 0 ? 'is-neg' : ''}`}>{pesos2(l.act)}</td>
                      <td className="num rp-muted">{er.ventas ? pct((l.act / er.ventas) * 100) : '—'}</td>
                      <td className="num rp-muted">{pesos2(l.ant)}</td>
                      <td className="num">
                        {l.act === 0 && l.ant === 0
                          ? '—'
                          : ['costo', 'administracion', 'comercializacion', 'financieros', 'ganancias'].includes(l.clave) && l.act <= 0 && l.ant <= 0
                            ? delta(Math.abs(l.act), Math.abs(l.ant), true) // egresos: subir es malo
                            : delta(l.act, l.ant)}
                      </td>
                    </tr>
                    {abierta
                      ? detalle.map((d) => (
                          <tr key={d.codigo} className="rp-fila-detalle">
                            <td>
                              <code>{d.codigo}</code> {d.nombre}
                            </td>
                            <td className="num">{pesos2(d.importe)}</td>
                            <td className="num rp-muted">{er.ventas ? pct((d.importe / er.ventas) * 100) : '—'}</td>
                            <td />
                            <td />
                          </tr>
                        ))
                      : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <p className="rp-nota">Importes con signo de resultado: los costos y gastos restan. Solo asientos contabilizados.</p>
        </section>
      ) : pestana === 'patrimonio' ? (
        <>
          <div className="rp-grid rp-grid--2">
            <section className="rp-card">
              <h3>
                Activo <small>al {fechaAr(rango.hasta)}</small>
              </h3>
              <BloqueSP titulo="Activo corriente" bloque={sp.activoCorriente} />
              <BloqueSP titulo="Activo no corriente" bloque={sp.activoNoCorriente} />
              <div className="rp-sp-total">
                <span>Total del activo</span>
                <strong>{pesos2(sp.activo)}</strong>
              </div>
            </section>
            <section className="rp-card">
              <h3>
                Pasivo y patrimonio neto <small>al {fechaAr(rango.hasta)}</small>
              </h3>
              <BloqueSP titulo="Pasivo corriente" bloque={sp.pasivoCorriente} />
              <BloqueSP titulo="Pasivo no corriente" bloque={sp.pasivoNoCorriente} />
              <BloqueSP
                titulo="Patrimonio neto"
                bloque={{
                  rubros: [...sp.patrimonio.rubros, { codigo: '', nombre: 'Resultado del ejercicio (no cerrado)', importe: sp.resultadoNoCerrado }],
                  total: sp.patrimonioNeto
                }}
              />
              <div className="rp-sp-total">
                <span>Total pasivo + PN</span>
                <strong>{pesos2(sp.pasivo + sp.patrimonioNeto)}</strong>
              </div>
            </section>
          </div>
          <p className={`rp-check ${Math.abs(sp.diferencia) < 1 ? 'is-ok' : 'is-danger'}`}>
            {Math.abs(sp.diferencia) < 1
              ? '✓ Activo = Pasivo + Patrimonio neto'
              : `✗ Diferencia de ${pesos2(sp.diferencia)}: revisá asientos desbalanceados en el Libro Diario.`}
          </p>
          <div className="rp-kpis rp-kpis--4">
            <article className="rp-kpi">
              <span>Liquidez corriente</span>
              <strong>{sp.indices.liquidezCorriente?.toFixed(2) ?? '—'}</strong>
            </article>
            <article className="rp-kpi">
              <span>Prueba ácida</span>
              <strong>{sp.indices.pruebaAcida?.toFixed(2) ?? '—'}</strong>
            </article>
            <article className="rp-kpi">
              <span>Endeudamiento</span>
              <strong>{sp.indices.endeudamiento?.toFixed(2) ?? '—'}</strong>
            </article>
            <article className="rp-kpi">
              <span>Solvencia</span>
              <strong>{sp.indices.solvencia?.toFixed(2) ?? '—'}</strong>
            </article>
          </div>
        </>
      ) : pestana === 'flujo' ? (
        <>
          <div className="rp-kpis rp-kpis--4">
            <article className="rp-kpi rp-kpi--cian">
              <span>Saldo inicial</span>
              <strong>{pesos(saldoInicialDisp)}</strong>
              <small>al {fechaAr(diaAnterior(rango.desde))}</small>
            </article>
            <article className="rp-kpi rp-kpi--verde">
              <span>Entradas</span>
              <strong>{pesos(flujo.reduce((s, f) => s + f.entradas, 0))}</strong>
            </article>
            <article className="rp-kpi rp-kpi--rojo">
              <span>Salidas</span>
              <strong>{pesos(flujo.reduce((s, f) => s + f.salidas, 0))}</strong>
            </article>
            <article className="rp-kpi rp-kpi--azul">
              <span>Saldo final</span>
              <strong>{pesos(flujo.at(-1)?.saldo ?? saldoInicialDisp)}</strong>
              <small>caja y bancos</small>
            </article>
          </div>
          <section className="rp-card">
            <h3>
              Flujo de fondos <small>cuentas de caja y bancos (1.1.1)</small>
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={flujo} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                <XAxis dataKey="etiqueta" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={60} />
                <Tooltip {...tooltipEstilo} formatter={(v: number, nombre: string) => [pesos(v), nombre]} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Area dataKey="saldo" name="Saldo" fill="rgba(56,189,248,.15)" stroke="#38bdf8" strokeWidth={2} />
                <Bar dataKey="entradas" name="Entradas" fill="#34d399" radius={[5, 5, 0, 0]} maxBarSize={22} />
                <Bar dataKey="salidas" name="Salidas" fill="#fb7185" radius={[5, 5, 0, 0]} maxBarSize={22} />
              </ComposedChart>
            </ResponsiveContainer>
            <table className="rp-tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Entradas</th>
                  <th className="num">Salidas</th>
                  <th className="num">Neto</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {flujo.map((f) => (
                  <tr key={f.mes} className="rp-fila">
                    <td>{etiquetaMes(f.mes)}</td>
                    <td className="num">{pesos2(f.entradas)}</td>
                    <td className="num">{pesos2(f.salidas)}</td>
                    <td className={`num ${f.neto < 0 ? 'is-neg' : ''}`}>{pesos2(f.neto)}</td>
                    <td className="num">{pesos2(f.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <>
          <div className="rp-kpis">
            <article className="rp-kpi rp-kpi--azul">
              <span>Facturado</span>
              <strong>{pesos(ventas.actual.total)}</strong>
              {delta(ventas.actual.total, ventas.anterior.total)}
            </article>
            <article className="rp-kpi rp-kpi--violeta">
              <span>Neto de IVA</span>
              <strong>{pesos(ventas.actual.neto)}</strong>
              <small>IVA {pesos(ventas.actual.iva)}</small>
            </article>
            <article className="rp-kpi rp-kpi--verde">
              <span>Facturas</span>
              <strong>{ventas.actual.facturas}</strong>
              {delta(ventas.actual.facturas, ventas.anterior.facturas)}
            </article>
            <article className="rp-kpi rp-kpi--cian">
              <span>Ticket promedio</span>
              <strong>{pesos(ventas.actual.ticket)}</strong>
              {delta(ventas.actual.ticket, ventas.anterior.ticket)}
            </article>
            <article className="rp-kpi rp-kpi--rosa">
              <span>Notas de crédito</span>
              <strong>{pesos(ventas.actual.notasCredito)}</strong>
            </article>
            <article className="rp-kpi rp-kpi--ambar">
              <span>Clientes distintos</span>
              <strong>{new Set(facturas.filter((f) => f.fecha_emision >= rango.desde).map((f) => f.cliente_nombre)).size}</strong>
            </article>
          </div>
          <div className="rp-grid rp-grid--2">
            <section className="rp-card">
              <h3>Facturación por día</h3>
              {ventas.actual.dias.length === 0 ? (
                <p className="rp-vacio">Sin facturas en el período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ventas.actual.dias} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                    <XAxis dataKey="etiqueta" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={60} />
                    <Tooltip {...tooltipEstilo} formatter={(v: number) => [pesos(v), 'Facturado']} />
                    <Bar dataKey="total" fill="#38bdf8" radius={[5, 5, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
            <section className="rp-card">
              <h3>Por tipo de comprobante</h3>
              {ventas.actual.porLetra.length === 0 ? (
                <p className="rp-vacio">Sin facturas en el período.</p>
              ) : (
                <Dona datos={ventas.actual.porLetra} centro={corto(ventas.actual.total)} sub="facturado" />
              )}
            </section>
          </div>
          <section className="rp-card">
            <h3>Principales clientes</h3>
            <table className="rp-tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th className="num">Facturas</th>
                  <th className="num">Total</th>
                  <th className="num">Participación</th>
                </tr>
              </thead>
              <tbody>
                {ventas.actual.clientes.map((c, i) => (
                  <tr key={c.nombre} className="rp-fila">
                    <td className="rp-muted">{i + 1}</td>
                    <td>{c.nombre}</td>
                    <td className="num">{c.cantidad}</td>
                    <td className="num">{pesos2(c.total)}</td>
                    <td className="num">
                      <span className="rp-barra">
                        <span style={{ width: `${ventas.actual.total ? Math.max((c.total / ventas.actual.total) * 100, 2) : 0}%` }} />
                      </span>
                      {ventas.actual.total ? pct((c.total / ventas.actual.total) * 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}

function Dona({ datos, centro, sub }: { datos: Array<{ nombre: string; valor: number }>; centro: string; sub: string }) {
  const total = datos.reduce((s, d) => s + d.valor, 0)
  return (
    <div className="rp-dona">
      <div className="rp-dona__grafico">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={datos} dataKey="valor" nameKey="nombre" innerRadius={60} outerRadius={88} paddingAngle={2} stroke="none">
              {datos.map((d, i) => (
                <Cell key={d.nombre} fill={COLORES[i % COLORES.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipEstilo} formatter={(v: number, nombre: string) => [`${pesos(v)} · ${pct((v / total) * 100)}`, nombre]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="rp-dona__centro" aria-hidden>
          <strong>{centro}</strong>
          <span>{sub}</span>
        </div>
      </div>
      <ul className="rp-leyenda">
        {datos.map((d, i) => (
          <li key={d.nombre}>
            <i style={{ background: COLORES[i % COLORES.length] }} />
            <span>{d.nombre}</span>
            <b>{pct((d.valor / total) * 100)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Aging({ datos, color }: { datos: Array<{ tramo: string; importe: number; cantidad: number }>; color: string }) {
  const total = datos.reduce((s, d) => s + d.importe, 0)
  const max = Math.max(...datos.map((d) => d.importe), 1)
  return (
    <ul className="rp-aging" aria-label="Antigüedad por tramo">
      {datos.map((d, i) => {
        const pctTramo = total > 0 ? (d.importe / total) * 100 : 0
        const fill = i === 0 ? '#475569' : color
        const opacity = i === 0 ? 1 : 0.45 + i * 0.13
        return (
          <li key={d.tramo} className="rp-aging__row">
            <div className="rp-aging__meta">
              <span className="rp-aging__tramo">{d.tramo}</span>
              <span className="rp-aging__cant">{d.cantidad ? `${d.cantidad}` : '—'}</span>
              <strong className="rp-aging__importe">{pesos(d.importe)}</strong>
            </div>
            <div className="rp-aging__track" title={`${pct(pctTramo)} del total`}>
              <span
                className="rp-aging__bar"
                style={{ width: `${(d.importe / max) * 100}%`, background: fill, opacity }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ListaTop({ items, vacio }: { items: Array<{ nombre: string; importe: number }>; vacio: string }) {
  if (!items.length) return <p className="rp-vacio rp-vacio--chico">{vacio}</p>
  return (
    <ul className="rp-top">
      {items.slice(0, 5).map((x) => (
        <li key={x.nombre}>
          <span>{x.nombre}</span>
          <b>{pesos(x.importe)}</b>
        </li>
      ))}
    </ul>
  )
}

function Indice({ nombre, valor, estado, ayuda }: { nombre: string; valor: number | null; estado: string; ayuda: string }) {
  return (
    <div className="rp-indice">
      <span>{nombre}</span>
      <strong className={`is-${estado}`}>{valor === null ? '—' : valor.toFixed(2)}</strong>
      <small>{ayuda}</small>
    </div>
  )
}

function BloqueSP({ titulo, bloque }: { titulo: string; bloque: { rubros: Array<{ codigo: string; nombre: string; importe: number }>; total: number } }) {
  return (
    <div className="rp-sp">
      <div className="rp-sp__titulo">
        <span>{titulo}</span>
        <strong>{pesos2(bloque.total)}</strong>
      </div>
      {bloque.rubros.length === 0 ? (
        <p className="rp-muted rp-sp__vacio">Sin saldos</p>
      ) : (
        bloque.rubros.map((r) => (
          <div key={`${r.codigo}-${r.nombre}`} className="rp-sp__rubro">
            <span>
              {r.codigo ? <code>{r.codigo}</code> : null} {r.nombre}
            </span>
            <b className={r.importe < 0 ? 'is-neg' : undefined}>{pesos2(r.importe)}</b>
          </div>
        ))
      )}
    </div>
  )
}
