import { useMemo } from 'react'
import {
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
import type { MomentoComision } from '../../features/comisiones/calculoComisiones'
import {
  cobranzaMes,
  insightsComisiones,
  proyeccionMes,
  rankingVendedores,
  tortaPorClave,
  variacionPct,
  type Insight,
  type PorcionTorta
} from '../../features/comisiones/analisisComisiones'
import type { ComisionLiquidacion, ComisionMes, ComisionVendedor, ComisionVenta } from '../../services/comisionesApi'
import './ComisionesTablero.css'

const COLORES = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#f472b6', '#94a3b8']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const pesos = (n: unknown) => (Number(n) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const corto = (n: number) => {
  const v = Math.abs(n)
  if (v >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (v >= 1_000) return `$${Math.round(n / 1000).toLocaleString('es-AR')} k`
  return `$${Math.round(n)}`
}
const pct = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
const hoyAr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

const tooltipEstilo = {
  contentStyle: { background: '#0f172a', border: '1px solid rgba(148,163,184,.3)', borderRadius: 10, color: '#e2e8f0', fontSize: 12 },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8' }
}

type Props = {
  mes: string
  onElegirMes: (mes: string) => void
  momento: MomentoComision
  porcentajeGeneral: number
  porMes: ComisionMes[]
  ventas: ComisionVenta[]
  vendedores: ComisionVendedor[]
  pendienteTotal: number
  liquidaciones: ComisionLiquidacion[]
}

function mesAnterior(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function Dona({ datos, centro, sub, vacio }: { datos: PorcionTorta[]; centro: string; sub: string; vacio: string }) {
  const total = datos.reduce((s, d) => s + d.valor, 0)
  if (total <= 0) return <p className="ct-vacio">{vacio}</p>
  return (
    <div className="ct-dona">
      <div className="ct-dona__grafico">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={datos} dataKey="valor" nameKey="nombre" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none">
              {datos.map((d, i) => (
                <Cell key={d.nombre} fill={d.nombre === 'Pendiente de cobro' ? '#475569' : COLORES[i % COLORES.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipEstilo} formatter={(v: number, nombre: string) => [`${pesos(v)} · ${pct((v / total) * 100)}`, nombre]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="ct-dona__centro" aria-hidden>
          <strong>{centro}</strong>
          <span>{sub}</span>
        </div>
      </div>
      <ul className="ct-leyenda">
        {datos.map((d, i) => (
          <li key={d.nombre}>
            <span className="ct-leyenda__punto" style={{ background: d.nombre === 'Pendiente de cobro' ? '#475569' : COLORES[i % COLORES.length] }} />
            <span className="ct-leyenda__nombre">{d.nombre}</span>
            <span className="ct-leyenda__valor">
              {pct((d.valor / total) * 100)}
              <small>{corto(d.valor)}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function IconoTono({ tono }: { tono: Insight['tono'] }) {
  const t = { danger: '!', warn: '⚠', info: 'i', ok: '✓' }[tono]
  return <span className={`ct-insight__icono ct-insight__icono--${tono}`}>{t}</span>
}

export default function ComisionesTablero(p: Props) {
  const hoy = hoyAr()
  const prev = mesAnterior(p.mes)
  const datosMes = p.porMes.find((x) => x.mes === p.mes) || null
  const datosPrev = p.porMes.find((x) => x.mes === prev) || null

  const ventasMes = useMemo(() => p.ventas.filter((v) => String(v.fecha_venta || '').slice(0, 7) === p.mes), [p.ventas, p.mes])

  const ranking = useMemo(
    () => rankingVendedores(datosMes?.vendedores || [], datosPrev?.vendedores || [], ventasMes),
    [datosMes, datosPrev, ventasMes]
  )

  const insights = useMemo(
    () =>
      insightsComisiones({
        mes: p.mes,
        hoy,
        momento: p.momento,
        porcentajeGeneral: p.porcentajeGeneral,
        ranking,
        baseMes: Number(datosMes?.base_monto) || 0,
        baseMesAnterior: Number(datosPrev?.base_monto) || 0,
        ventasMes,
        ventasPeriodo: p.ventas,
        vendedores: p.vendedores,
        pendienteTotal: p.pendienteTotal,
        liquidacionesSinPagar: p.liquidaciones
          .filter((l) => l.estado === 'borrador' || l.estado === 'aprobada')
          .map((l) => ({ estado: l.estado, total: Number(l.total) || 0, periodo: l.periodo }))
      }),
    [p, hoy, ranking, datosMes, datosPrev, ventasMes]
  )

  const cobranza = useMemo(() => cobranzaMes(ventasMes), [ventasMes])
  const tortaVendedores = useMemo(
    () => ranking.map((r) => ({ nombre: r.nombre_vendedor, valor: Number(r.base_monto) || 0 })).filter((x) => x.valor > 0),
    [ranking]
  )
  const tortaMedios = useMemo(
    () => tortaPorClave(ventasMes, (v) => v.metodo_pago || 'Sin dato', (v) => Number(v.base_monto) || 0),
    [ventasMes]
  )
  const tortaCobranza: PorcionTorta[] = [
    { nombre: 'Cobrado', valor: cobranza.cobrado },
    { nombre: 'Pendiente de cobro', valor: cobranza.pendiente }
  ].filter((x) => x.valor > 0)

  const proy = proyeccionMes(Number(datosMes?.base_monto) || 0, p.mes, hoy)
  const varBase = variacionPct(Number(datosMes?.base_monto) || 0, Number(datosPrev?.base_monto) || 0)
  const varComision = variacionPct(Number(datosMes?.devengado) || 0, Number(datosPrev?.devengado) || 0)

  const evolucion = useMemo(() => {
    const anio = p.mes.slice(0, 4)
    return MESES_CORTOS.map((nombre, i) => {
      const clave = `${anio}-${String(i + 1).padStart(2, '0')}`
      const d = p.porMes.find((x) => x.mes === clave)
      // Los meses que todavía no llegaron no se dibujan (si no, la línea "cae" a cero).
      const futuro = clave > hoy.slice(0, 7)
      return {
        clave,
        nombre,
        venta: futuro ? null : Number(d?.base_monto) || 0,
        comision: futuro ? null : Number(d?.devengado) || 0,
        ventas: Number(d?.ventas) || 0
      }
    })
  }, [p.porMes, p.mes, hoy])

  const barrasVendedor = useMemo(
    () =>
      ranking.map((r) => ({
        nombre: r.nombre_vendedor,
        Liquidado: Number(r.liquidado) || 0,
        Pendiente: Number(r.pendiente) || 0
      })),
    [ranking]
  )

  const top = ranking[0]
  const ticket = (Number(datosMes?.ventas) || 0) > 0 ? (Number(datosMes?.base_monto) || 0) / Number(datosMes?.ventas) : 0

  return (
    <div className="ct">
      {/* KPIs */}
      <div className="ct-kpis">
        <article className="ct-kpi ct-kpi--verde">
          <span className="ct-kpi__label">Comisión devengada</span>
          <strong className="ct-kpi__valor">{pesos(datosMes?.devengado)}</strong>
          <Delta valor={varComision} />
        </article>
        <article className="ct-kpi ct-kpi--azul">
          <span className="ct-kpi__label">Vendido en el mes</span>
          <strong className="ct-kpi__valor">{pesos(datosMes?.base_monto)}</strong>
          <Delta valor={varBase} />
          {proy && proy.avance < 0.97 ? <span className="ct-kpi__extra">Proyección: {corto(proy.proyectado)}</span> : null}
        </article>
        <article className="ct-kpi ct-kpi--violeta">
          <span className="ct-kpi__label">Ventas · ticket promedio</span>
          <strong className="ct-kpi__valor">
            {Number(datosMes?.ventas) || 0} <small>· {corto(ticket)}</small>
          </strong>
          {top ? <span className="ct-kpi__extra">Mejor: {top.nombre_vendedor}</span> : null}
        </article>
        <article className="ct-kpi ct-kpi--ambar">
          <span className="ct-kpi__label">Pendiente de pagar (total)</span>
          <strong className="ct-kpi__valor">{pesos(p.pendienteTotal)}</strong>
          <span className="ct-kpi__extra">Cobrado del mes: {pct(cobranza.pct)}</span>
        </article>
      </div>

      {/* Lecturas */}
      {insights.length > 0 ? (
        <section className="ct-card ct-insights">
          <h3 className="ct-card__titulo">
            Lo que hay que mirar <small>{insights.length}</small>
          </h3>
          <ul>
            {insights.slice(0, 6).map((i) => (
              <li key={i.id} className={`ct-insight ct-insight--${i.tono}`}>
                <IconoTono tono={i.tono} />
                <div>
                  <strong>{i.titulo}</strong>
                  <span>{i.detalle}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Tortas */}
      <div className="ct-grid ct-grid--3">
        <section className="ct-card">
          <h3 className="ct-card__titulo">Participación por vendedor</h3>
          <Dona
            datos={tortaVendedores}
            centro={corto(Number(datosMes?.base_monto) || 0)}
            sub={`${ranking.length} vendedor${ranking.length === 1 ? '' : 'es'}`}
            vacio="Sin ventas en el mes."
          />
        </section>
        <section className="ct-card">
          <h3 className="ct-card__titulo">Cobranza del mes</h3>
          <Dona datos={tortaCobranza} centro={pct(cobranza.pct)} sub="cobrado" vacio="Sin ventas en el mes." />
        </section>
        <section className="ct-card">
          <h3 className="ct-card__titulo">Medios de pago</h3>
          <Dona datos={tortaMedios} centro={String(ventasMes.length)} sub="ventas" vacio="Sin ventas en el mes." />
        </section>
      </div>

      {/* Evolución y comisión por vendedor */}
      <div className="ct-grid ct-grid--2">
        <section className="ct-card">
          <h3 className="ct-card__titulo">
            Evolución {p.mes.slice(0, 4)} <small>Tocá un mes para verlo</small>
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={evolucion} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
              <XAxis dataKey="nombre" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis yAxisId="v" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={56} />
              <YAxis yAxisId="c" orientation="right" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} width={52} />
              <Tooltip
                {...tooltipEstilo}
                cursor={{ fill: 'rgba(148,163,184,.08)' }}
                formatter={(v: number, nombre: string) => [pesos(v), nombre === 'venta' ? 'Vendido' : 'Comisión']}
              />
              <Bar
                yAxisId="v"
                dataKey="venta"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                style={{ cursor: 'pointer' }}
                onClick={(_dato: unknown, indice: number) => {
                  const clave = evolucion[indice]?.clave
                  if (clave) p.onElegirMes(clave)
                }}
              >
                {evolucion.map((d) => (
                  <Cell key={d.clave} fill={d.clave === p.mes ? '#38bdf8' : 'rgba(56,189,248,.35)'} />
                ))}
              </Bar>
              <Line yAxisId="c" type="monotone" dataKey="comision" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3, fill: '#34d399' }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="ct-mini-leyenda">
            <span>
              <i style={{ background: '#38bdf8' }} /> Vendido (eje izq.)
            </span>
            <span>
              <i style={{ background: '#34d399' }} /> Comisión (eje der.)
            </span>
          </div>
        </section>

        <section className="ct-card">
          <h3 className="ct-card__titulo">Comisión por vendedor</h3>
          {barrasVendedor.length === 0 ? (
            <p className="ct-vacio">Sin comisiones en el mes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, barrasVendedor.length * 44 + 50)}>
              <BarChart data={barrasVendedor} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={corto} />
                <YAxis type="category" dataKey="nombre" stroke="#cbd5e1" tickLine={false} axisLine={false} fontSize={12} width={110} />
                <Tooltip {...tooltipEstilo} cursor={{ fill: 'rgba(148,163,184,.08)' }} formatter={(v: number, nombre: string) => [pesos(v), nombre]} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="Liquidado" stackId="c" fill="#34d399" radius={[0, 0, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Pendiente" stackId="c" fill="#fbbf24" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* Ranking */}
      {ranking.length > 0 ? (
        <section className="ct-card">
          <h3 className="ct-card__titulo">Ranking del mes</h3>
          <div className="ct-ranking">
            {ranking.map((r, i) => (
              <div key={`${r.id_vendedor}-${r.nombre_vendedor}`} className="ct-ranking__fila">
                <span className={`ct-ranking__pos ct-ranking__pos--${i < 3 ? i + 1 : 'n'}`}>{i + 1}</span>
                <div className="ct-ranking__info">
                  <div className="ct-ranking__top">
                    <strong>{r.nombre_vendedor}</strong>
                    <span>{pesos(r.base_monto)}</span>
                  </div>
                  <div className="ct-ranking__barra">
                    <span style={{ width: `${Math.max(r.participacion, 2)}%`, background: COLORES[i % COLORES.length] }} />
                  </div>
                  <div className="ct-ranking__datos">
                    <span>{r.ventas} ventas</span>
                    <span>ticket {corto(r.ticket)}</span>
                    <span>cobrado {corto(r.cobrado)}</span>
                    <span>comisión {pesos(r.devengado)}</span>
                    <Delta valor={r.variacion} compacto />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Delta({ valor, compacto = false }: { valor: number | null; compacto?: boolean }) {
  if (valor === null) return compacto ? null : <span className="ct-delta ct-delta--neutro">sin mes anterior</span>
  const sube = valor >= 0
  return (
    <span className={`ct-delta ct-delta--${sube ? 'sube' : 'baja'}`}>
      {sube ? '▲' : '▼'} {Math.abs(valor).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%{compacto ? '' : ' vs mes anterior'}
    </span>
  )
}
