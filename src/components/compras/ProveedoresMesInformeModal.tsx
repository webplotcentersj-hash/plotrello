import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import apiService from '../../services/api'
import type { MovimientoProveedorEnriquecido, ProveedorConFinanzas } from '../../types/api'
import { getArgentinaDateString } from '../../utils/dateUtils'
import {
  estadoCuentaProveedor,
  moneyProveedor,
  saldoCuentaProveedor
} from '../../utils/proveedorCuenta'
import './ProveedoresMesInformeModal.css'

type Props = {
  open: boolean
  onClose: () => void
  proveedores: ProveedorConFinanzas[]
  mesInicial?: string // YYYY-MM
}

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
] as const

const PIE_COLORS = {
  deuda: '#f59e0b',
  ok: '#10b981',
  favor: '#3b82f6'
}

function mesClaveHoy(): string {
  return getArgentinaDateString().slice(0, 7)
}

function labelMes(clave: string): string {
  const [y, m] = clave.split('-')
  const mi = Math.max(0, Math.min(11, Number(m) - 1))
  return `${MESES_ES[mi]} ${y}`
}

function shiftMes(clave: string, delta: number): string {
  const [y, m] = clave.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  const yy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}`
}

function diasEnMes(clave: string): number {
  const [y, m] = clave.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function fechaMov(m: MovimientoProveedorEnriquecido): string {
  return String(m.fecha_comprobante || m.fecha_hora || '').slice(0, 10)
}

function esPago(m: MovimientoProveedorEnriquecido): boolean {
  return (Number(m.haber) || 0) > 0.009 || /pago/i.test(m.tipo_movimiento || '')
}

function tipMoney(v: number): string {
  return moneyProveedor(v)
}

export default function ProveedoresMesInformeModal({
  open,
  onClose,
  proveedores,
  mesInicial
}: Props) {
  const [mes, setMes] = useState(mesInicial || mesClaveHoy())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movs, setMovs] = useState<MovimientoProveedorEnriquecido[]>([])

  useEffect(() => {
    if (!open) return
    setMes(mesInicial || mesClaveHoy())
  }, [open, mesInicial])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await apiService.getMovimientosProveedores()
        if (cancelled) return
        if (!r.success || !r.data) {
          setMovs([])
          setError(r.error || 'No se pudieron cargar los movimientos')
        } else {
          setMovs(r.data.filter((m) => !m.es_saldo_inicial))
        }
      } catch {
        if (!cancelled) {
          setMovs([])
          setError('Error de conexión al cargar el informe')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const delMes = useMemo(
    () => movs.filter((m) => fechaMov(m).slice(0, 7) === mes),
    [movs, mes]
  )

  const resumen = useMemo(() => {
    let debe = 0
    let haber = 0
    let facturas = 0
    let pagos = 0
    for (const m of delMes) {
      const d = Number(m.debe) || 0
      const h = Number(m.haber) || 0
      debe += d
      haber += h
      if (esPago(m)) pagos += 1
      else if (d > 0.009) facturas += 1
    }
    const neto = debe - haber
    return { debe, haber, facturas, pagos, neto, movimientos: delMes.length }
  }, [delMes])

  const serieDiaria = useMemo(() => {
    const n = diasEnMes(mes)
    const byDay = new Map<string, { facturado: number; pagado: number }>()
    for (let d = 1; d <= n; d++) {
      const key = `${mes}-${String(d).padStart(2, '0')}`
      byDay.set(key, { facturado: 0, pagado: 0 })
    }
    for (const m of delMes) {
      const f = fechaMov(m)
      const row = byDay.get(f)
      if (!row) continue
      row.facturado += Number(m.debe) || 0
      row.pagado += Number(m.haber) || 0
    }
    return Array.from(byDay.entries()).map(([fecha, v]) => ({
      dia: fecha.slice(8, 10),
      fecha,
      facturado: Number(v.facturado.toFixed(2)),
      pagado: Number(v.pagado.toFixed(2)),
      neto: Number((v.facturado - v.pagado).toFixed(2))
    }))
  }, [delMes, mes])

  const topProveedores = useMemo(() => {
    const map = new Map<string, { nombre: string; facturado: number; pagado: number }>()
    for (const m of delMes) {
      const nombre = (m.proveedor_nombre || 'Sin nombre').trim() || 'Sin nombre'
      const cur = map.get(nombre) || { nombre, facturado: 0, pagado: 0 }
      cur.facturado += Number(m.debe) || 0
      cur.pagado += Number(m.haber) || 0
      map.set(nombre, cur)
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        facturado: Number(r.facturado.toFixed(2)),
        pagado: Number(r.pagado.toFixed(2)),
        neto: Number((r.facturado - r.pagado).toFixed(2))
      }))
      .sort((a, b) => b.facturado - a.facturado || b.pagado - a.pagado)
      .slice(0, 8)
  }, [delMes])

  const cartera = useMemo(() => {
    let deuda = 0
    let favor = 0
    let nDeuda = 0
    let nOk = 0
    let nFavor = 0
    const ranking: Array<{ nombre: string; saldo: number; cls: string }> = []
    for (const p of proveedores) {
      const saldo = saldoCuentaProveedor(p.finanzas)
      const cls = estadoCuentaProveedor(saldo).cls
      const nombre = p.razon_social || p.nombre
      if (cls === 'deuda') {
        deuda += saldo
        nDeuda += 1
      } else if (cls === 'favor') {
        favor += Math.abs(saldo)
        nFavor += 1
      } else {
        nOk += 1
      }
      if (Math.abs(saldo) > 0.009) {
        ranking.push({ nombre, saldo, cls })
      }
    }
    ranking.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
    return {
      deuda,
      favor,
      nDeuda,
      nOk,
      nFavor,
      pie: [
        { name: 'Le debemos', value: nDeuda, key: 'deuda' as const },
        { name: 'Al día', value: nOk, key: 'ok' as const },
        { name: 'A favor', value: nFavor, key: 'favor' as const }
      ].filter((x) => x.value > 0),
      topDeuda: ranking.filter((r) => r.cls === 'deuda').slice(0, 6),
      topFavor: ranking.filter((r) => r.cls === 'favor').slice(0, 4)
    }
  }, [proveedores])

  const estadoMes =
    Math.abs(resumen.neto) < 0.01 && resumen.movimientos === 0
      ? { label: 'Sin movimientos', cls: 'ok' }
      : Math.abs(resumen.neto) < 0.01
        ? { label: 'Mes equilibrado', cls: 'ok' }
        : resumen.neto > 0
          ? { label: 'Subió la deuda', cls: 'deuda' }
          : { label: 'Bajamos deuda', cls: 'favor' }

  if (!open) return null

  return (
    <div className="prov-mes-informe" role="dialog" aria-modal="true" aria-labelledby="prov-mes-informe-title">
      <button type="button" className="prov-mes-informe__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="prov-mes-informe__panel">
        <header className="prov-mes-informe__head">
          <div>
            <p className="prov-mes-informe__kicker">Informe de proveedores</p>
            <h2 id="prov-mes-informe-title">Estado del mes</h2>
            <p className="prov-mes-informe__sub">Facturado, pagado y cartera · gráficos y detalle</p>
          </div>
          <button type="button" className="prov-mes-informe__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="prov-mes-informe__nav">
          <button type="button" onClick={() => setMes((m) => shiftMes(m, -1))} aria-label="Mes anterior">
            ←
          </button>
          <strong>{labelMes(mes)}</strong>
          <button
            type="button"
            onClick={() => setMes((m) => shiftMes(m, 1))}
            disabled={mes >= mesClaveHoy()}
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>

        <div className="prov-mes-informe__body">
          {loading ? (
            <p className="prov-mes-informe__status">Cargando informe…</p>
          ) : error ? (
            <p className="prov-mes-informe__status prov-mes-informe__status--err">{error}</p>
          ) : (
            <>
              <div className="prov-mes-informe__kpis">
                <article>
                  <em>Facturado</em>
                  <b>{moneyProveedor(resumen.debe)}</b>
                  <small>
                    {resumen.facturas} factura{resumen.facturas === 1 ? '' : 's'}
                  </small>
                </article>
                <article>
                  <em>Pagado</em>
                  <b>{moneyProveedor(resumen.haber)}</b>
                  <small>
                    {resumen.pagos} pago{resumen.pagos === 1 ? '' : 's'}
                  </small>
                </article>
                <article className={`prov-mes-informe__kpi--${estadoMes.cls}`}>
                  <em>Resultado</em>
                  <b>
                    {resumen.neto > 0.009 ? '+' : resumen.neto < -0.009 ? '−' : ''}
                    {moneyProveedor(Math.abs(resumen.neto))}
                  </b>
                  <small>{estadoMes.label}</small>
                </article>
                <article>
                  <em>Movimientos</em>
                  <b>{resumen.movimientos}</b>
                  <small>en {labelMes(mes)}</small>
                </article>
              </div>

              <div className="prov-mes-informe__charts">
                <section className="prov-mes-informe__card">
                  <h3>Facturado vs pagado por día</h3>
                  {serieDiaria.every((d) => d.facturado < 0.01 && d.pagado < 0.01) ? (
                    <p className="prov-mes-informe__empty">Sin movimientos en este mes.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={serieDiaria} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          tickFormatter={(v) =>
                            Number(v) >= 1_000_000
                              ? `${(Number(v) / 1_000_000).toFixed(1)}M`
                              : Number(v) >= 1000
                                ? `${Math.round(Number(v) / 1000)}k`
                                : String(v)
                          }
                          width={48}
                        />
                        <Tooltip
                          formatter={(value) => tipMoney(Number(value) || 0)}
                          labelFormatter={(l) => `Día ${l}`}
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.3)',
                            borderRadius: 8
                          }}
                        />
                        <Legend />
                        <Bar dataKey="facturado" name="Facturado" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="pagado" name="Pagado" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </section>

                <section className="prov-mes-informe__card">
                  <h3>Cartera actual</h3>
                  {cartera.pie.length === 0 ? (
                    <p className="prov-mes-informe__empty">Sin proveedores.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={cartera.pie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {cartera.pie.map((entry) => (
                            <Cell key={entry.key} fill={PIE_COLORS[entry.key]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.3)',
                            borderRadius: 8
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="prov-mes-informe__cartera-nums">
                    <span>
                      Deuda <strong>{moneyProveedor(cartera.deuda)}</strong>
                    </span>
                    <span>
                      A favor <strong>{moneyProveedor(cartera.favor)}</strong>
                    </span>
                  </div>
                </section>
              </div>

              <div className="prov-mes-informe__charts">
                <section className="prov-mes-informe__card prov-mes-informe__card--wide">
                  <h3>Top proveedores del mes (facturado)</h3>
                  {topProveedores.length === 0 ? (
                    <p className="prov-mes-informe__empty">Nadie facturó este mes.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={topProveedores}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          tickFormatter={(v) =>
                            Number(v) >= 1_000_000
                              ? `${(Number(v) / 1_000_000).toFixed(1)}M`
                              : Number(v) >= 1000
                                ? `${Math.round(Number(v) / 1000)}k`
                                : String(v)
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="nombre"
                          width={140}
                          tick={{ fill: '#cbd5e1', fontSize: 11 }}
                          tickFormatter={(v) => (String(v).length > 22 ? `${String(v).slice(0, 20)}…` : String(v))}
                        />
                        <Tooltip
                          formatter={(value) => tipMoney(Number(value) || 0)}
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.3)',
                            borderRadius: 8
                          }}
                        />
                        <Legend />
                        <Bar dataKey="facturado" name="Facturado" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                        <Bar dataKey="pagado" name="Pagado" fill="#10b981" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </section>
              </div>

              <div className="prov-mes-informe__tables">
                <section className="prov-mes-informe__card">
                  <h3>Mayores deudas abiertas</h3>
                  {cartera.topDeuda.length === 0 ? (
                    <p className="prov-mes-informe__empty">No hay deudas abiertas.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Proveedor</th>
                          <th className="num">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartera.topDeuda.map((r) => (
                          <tr key={r.nombre}>
                            <td>{r.nombre}</td>
                            <td className="num">{moneyProveedor(r.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
                <section className="prov-mes-informe__card">
                  <h3>Movimientos del mes</h3>
                  {delMes.length === 0 ? (
                    <p className="prov-mes-informe__empty">Sin filas.</p>
                  ) : (
                    <div className="prov-mes-informe__table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Proveedor</th>
                            <th>Tipo</th>
                            <th className="num">Debe</th>
                            <th className="num">Haber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...delMes]
                            .sort((a, b) => fechaMov(b).localeCompare(fechaMov(a)) || b.id - a.id)
                            .slice(0, 40)
                            .map((m) => (
                              <tr key={m.id}>
                                <td>{fechaMov(m).slice(8, 10)}/{fechaMov(m).slice(5, 7)}</td>
                                <td title={m.proveedor_nombre}>
                                  {(m.proveedor_nombre || '—').length > 28
                                    ? `${(m.proveedor_nombre || '').slice(0, 26)}…`
                                    : m.proveedor_nombre || '—'}
                                </td>
                                <td>{esPago(m) ? 'Pago' : 'Factura'}</td>
                                <td className="num">
                                  {(Number(m.debe) || 0) > 0.009 ? moneyProveedor(Number(m.debe)) : '—'}
                                </td>
                                <td className="num">
                                  {(Number(m.haber) || 0) > 0.009 ? moneyProveedor(Number(m.haber)) : '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
