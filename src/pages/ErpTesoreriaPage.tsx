import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpTesoreriaPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const estado = (searchParams.get('estado') || '').trim() || null

  const [loading, setLoading] = useState(true)
  const [loadingCaja, setLoadingCaja] = useState(true)
  const [cxc, setCxc] = useState<any[]>([])
  const [cxp, setCxp] = useState<any[]>([])
  const [movs, setMovs] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [alertasCxp, setAlertasCxp] = useState<
    Array<{ id: number; mensaje: string | null; nivel: string; leida: boolean }>
  >([])

  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return d.toISOString().split('T')[0]
  }, [today])
  const defaultTo = useMemo(() => today.toISOString().split('T')[0], [today])
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo })
  const [tipoMov, setTipoMov] = useState<'Todos' | 'Cobro' | 'Pago'>('Todos')
  const [cuentaId, setCuentaId] = useState<string>('') // '' = todas

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([
      apiService.getCuentasPorCobrar(estado ? ({ estado } as any) : undefined),
      apiService.getCuentasPorPagar(estado ? ({ estado } as any) : undefined),
      apiService.erpSyncCxpDesdeFacturasCompra()
    ])
      .then(([r1, r2]) => {
        if (cancelled) return
        if (r1.success && r1.data) setCxc(Array.isArray(r1.data) ? r1.data : [])
        else setCxc([])
        if (r2.success && r2.data) setCxp(Array.isArray(r2.data) ? r2.data : [])
        else setCxp([])
        if (!r1.success || !r2.success) {
          setError(r1.error || r2.error || 'No se pudieron cargar cuentas.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [estado])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    void (async () => {
      await apiService.erpRefreshAlertasCxp(7)
      const r = await apiService.getErpAlertasCxp({ soloNoLeidas: true })
      if (!cancelled && r.success && r.data) {
        setAlertasCxp(r.data.map((a) => ({ id: a.id, mensaje: a.mensaje, nivel: a.nivel, leida: a.leida })))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  useEffect(() => {
    let cancelled = false
    void apiService.getCuentasBancarias({ activa: true }).then((r) => {
      if (cancelled) return
      if (r.success && r.data) setCuentas(Array.isArray(r.data) ? r.data : [])
      else setCuentas([])
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingCaja(true)
    void apiService
      .getPagosCobros({
        tipo: tipoMov === 'Todos' ? undefined : tipoMov,
        fechaDesde: range.from || undefined,
        fechaHasta: range.to || undefined,
        id_cuenta_bancaria: cuentaId ? Number(cuentaId) : undefined
      })
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setMovs(Array.isArray(r.data) ? r.data : [])
        else setMovs([])
        if (!r.success) setError((prev) => prev || r.error || 'No se pudieron cargar movimientos de caja.')
      })
      .finally(() => {
        if (!cancelled) setLoadingCaja(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.from, range.to, tipoMov, cuentaId])

  const kpis = useMemo(() => {
    const pendingCxc = cxc.filter((c: any) => c?.estado === 'Pendiente' || c?.estado === 'Parcial')
    const pendingCxp = cxp.filter((c: any) => c?.estado === 'Pendiente' || c?.estado === 'Parcial')
    const montoCxc = pendingCxc.reduce((sum: number, c: any) => sum + (Number(c?.monto_pendiente) || 0), 0)
    const montoCxp = pendingCxp.reduce((sum: number, c: any) => sum + (Number(c?.monto_pendiente) || 0), 0)
    const now = Date.now()
    const vencidasCxc = cxc.filter((c: any) => c?.fecha_vencimiento && new Date(c.fecha_vencimiento).getTime() < now && c?.estado !== 'Pagado').length
    const vencidasCxp = cxp.filter((c: any) => c?.fecha_vencimiento && new Date(c.fecha_vencimiento).getTime() < now && c?.estado !== 'Pagado').length
    return { montoCxc, montoCxp, vencidasCxc, vencidasCxp }
  }, [cxc, cxp])

  const kpisCaja = useMemo(() => {
    const ingresos = movs.filter((m: any) => m?.tipo === 'Cobro').reduce((s: number, m: any) => s + (Number(m?.monto) || 0), 0)
    const egresos = movs.filter((m: any) => m?.tipo === 'Pago').reduce((s: number, m: any) => s + (Number(m?.monto) || 0), 0)
    return { ingresos, egresos, neto: ingresos - egresos, cantidad: movs.length }
  }, [movs])

  const flujoPorDia = useMemo(() => {
    const map = new Map<string, { fecha: string; ingresos: number; egresos: number; neto: number }>()
    for (const m of movs) {
      const fecha = (String(m?.fecha_pago || '').split('T')[0] || '').trim()
      if (!fecha) continue
      const prev = map.get(fecha) || { fecha, ingresos: 0, egresos: 0, neto: 0 }
      const monto = Number(m?.monto) || 0
      if (m?.tipo === 'Cobro') prev.ingresos += monto
      else if (m?.tipo === 'Pago') prev.egresos += monto
      prev.neto = prev.ingresos - prev.egresos
      map.set(fecha, prev)
    }
    return Array.from(map.values()).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  }, [movs])

  const exportCajaCsv = () => {
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const num = (n: any) => {
      const x = Number(n) || 0
      return x.toFixed(2)
    }

    const header = ['fecha', 'tipo', 'metodo', 'monto', 'cuenta_cxc', 'cuenta_cxp', 'cuenta_bancaria', 'comprobante', 'observaciones']
    const lines = [header.join(',')]
    for (const m of movs) {
      const fecha = (String(m?.fecha_pago || '').split('T')[0] || '').trim()
      lines.push(
        [
          esc(fecha),
          esc(m?.tipo || ''),
          esc(m?.metodo_pago || ''),
          num(m?.monto),
          esc(m?.id_cuenta_por_cobrar || ''),
          esc(m?.id_cuenta_por_pagar || ''),
          esc(m?.id_cuenta_bancaria || ''),
          esc(m?.numero_comprobante || ''),
          esc(m?.observaciones || '')
        ].join(',')
      )
    }
    lines.push('')
    lines.push(['RESUMEN', '', '', '', '', '', '', '', ''].join(','))
    lines.push(['ingresos', num(kpisCaja.ingresos)].join(','))
    lines.push(['egresos', num(kpisCaja.egresos)].join(','))
    lines.push(['neto', num(kpisCaja.neto)].join(','))

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tesoreria_caja_${tipoMov.toLowerCase()}_${range.from || 'desde'}_${range.to || 'hasta'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="erp-section">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            🏦
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Contable</p>
            <h1>Tesorería</h1>
            <p className="erp-section-sub">Cobros, pagos, vencimientos y flujo de caja</p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/caja/dashboard')}>
            Ir a Caja
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria/cuentas')}>
            Cuentas bancarias
          </button>
        </div>
      </header>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      {isAdmin && alertasCxp.length > 0 && (
        <div className="erp-alertas-panel erp-alertas-panel--danger">
          <h3>⚠️ Alertas cuentas por pagar ({alertasCxp.length})</h3>
          <ul className="erp-alertas-list">
            {alertasCxp.slice(0, 5).map((a) => (
              <li key={a.id} className="erp-alerta-item">
                <span>{a.mensaje}</span>
                <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/erp/cuentas-por-pagar')}>
                  Revisar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="erp-stats-row">
        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">💵</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              ${kpis.montoCxc.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div className="erp-stat-card__label">Por cobrar</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--rose">
          <div className="erp-stat-card__icon">💸</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              ${kpis.montoCxp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div className="erp-stat-card__label">Por pagar</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--amber">
          <div className="erp-stat-card__icon">📥</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{kpis.vencidasCxc}</div>
            <div className="erp-stat-card__label">CxC vencidas</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">📤</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{kpis.vencidasCxp}</div>
            <div className="erp-stat-card__label">CxP vencidas</div>
          </div>
        </article>
      </div>

      <div className="erp-quick-grid">
        <button
          type="button"
          className="erp-quick-card"
          style={{ '--quick-accent': '#10b981' } as CSSProperties}
          onClick={() => navigate('/erp/cuentas-por-cobrar')}
        >
          <span className="erp-quick-card__glow" aria-hidden />
          <span className="erp-quick-card__icon">💳</span>
          <span className="erp-quick-card__title">Cuentas por cobrar</span>
          <span className="erp-quick-card__desc">Facturas ERP + cuenta corriente</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button
          type="button"
          className="erp-quick-card"
          style={{ '--quick-accent': '#f43f5e' } as CSSProperties}
          onClick={() => navigate('/erp/cuentas-por-pagar')}
        >
          <span className="erp-quick-card__glow" aria-hidden />
          <span className="erp-quick-card__icon">📋</span>
          <span className="erp-quick-card__title">Cuentas por pagar</span>
          <span className="erp-quick-card__desc">Deudas con proveedores</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button
          type="button"
          className="erp-quick-card"
          style={{ '--quick-accent': '#0ea5e9' } as CSSProperties}
          onClick={() => navigate('/erp/cuentas-por-cobrar?tab=cuenta_corriente')}
        >
          <span className="erp-quick-card__glow" aria-hidden />
          <span className="erp-quick-card__icon">🤝</span>
          <span className="erp-quick-card__title">Cuenta corriente</span>
          <span className="erp-quick-card__desc">Ventas fiadas del mostrador</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button
          type="button"
          className="erp-quick-card"
          style={{ '--quick-accent': '#8b5cf6' } as CSSProperties}
          onClick={() => navigate('/erp/tesoreria/cuentas')}
        >
          <span className="erp-quick-card__glow" aria-hidden />
          <span className="erp-quick-card__icon">🏛️</span>
          <span className="erp-quick-card__title">Cuentas bancarias</span>
          <span className="erp-quick-card__desc">Catálogo para cobros y pagos</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
      </div>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <div>
            <h2>Flujo de caja</h2>
            <p className="erp-panel__hint">Pagos y cobros registrados en tesorería</p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={exportCajaCsv} disabled={loadingCaja}>
            Exportar CSV
          </button>
        </div>

        <div className="erp-toolbar">
          <label className="erp-field">
            <span className="erp-field__label">Tipo</span>
            <select value={tipoMov} onChange={(e) => setTipoMov(e.target.value as any)}>
              <option value="Todos">Todos</option>
              <option value="Cobro">Cobros</option>
              <option value="Pago">Pagos</option>
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Cuenta bancaria</span>
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Todas</option>
              {cuentas.map((c: any) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Desde</span>
            <input type="date" value={range.from} onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))} />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Hasta</span>
            <input type="date" value={range.to} onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))} />
          </label>
        </div>

        {loadingCaja ? (
          <div className="erp-loading-inline">
            <div className="erp-loading-inline__spinner" aria-hidden />
            <span>Cargando movimientos…</span>
          </div>
        ) : (
          <>
            <div className="erp-stats-row" style={{ marginBottom: 16 }}>
              <article className="erp-stat-card erp-stat-card--green">
                <div className="erp-stat-card__icon">↑</div>
                <div className="erp-stat-card__body">
                  <div className="erp-stat-card__value">
                    ${kpisCaja.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="erp-stat-card__label">Ingresos</div>
                </div>
              </article>
              <article className="erp-stat-card erp-stat-card--rose">
                <div className="erp-stat-card__icon">↓</div>
                <div className="erp-stat-card__body">
                  <div className="erp-stat-card__value">
                    ${kpisCaja.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="erp-stat-card__label">Egresos</div>
                </div>
              </article>
              <article className="erp-stat-card erp-stat-card--cyan">
                <div className="erp-stat-card__icon">∑</div>
                <div className="erp-stat-card__body">
                  <div className="erp-stat-card__value">
                    ${kpisCaja.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="erp-stat-card__label">Neto</div>
                </div>
              </article>
              <article className="erp-stat-card erp-stat-card--violet">
                <div className="erp-stat-card__icon">#</div>
                <div className="erp-stat-card__body">
                  <div className="erp-stat-card__value">{kpisCaja.cantidad}</div>
                  <div className="erp-stat-card__label">Movimientos</div>
                </div>
              </article>
            </div>

            {flujoPorDia.length === 0 ? (
              <div className="erp-empty">
                <span className="erp-empty__icon">📊</span>
                Sin movimientos en el rango seleccionado
              </div>
            ) : (
              <div className="erp-chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flujoPorDia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: 10,
                        color: '#e2e8f0'
                      }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="egresos" name="Egresos" fill="#fb7185" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="neto" name="Neto" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Método</th>
                    <th>Cuenta</th>
                    <th>Banco</th>
                    <th>Monto</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.slice(0, 20).map((m: any) => (
                    <tr key={m.id}>
                      <td>{m.fecha_pago ? new Date(m.fecha_pago).toLocaleDateString('es-AR') : '—'}</td>
                      <td className={m.tipo === 'Cobro' ? 'erp-td-tipo--cobro' : 'erp-td-tipo--pago'}>{m.tipo}</td>
                      <td>{m.metodo_pago || '—'}</td>
                      <td>
                        {m.id_cuenta_por_cobrar
                          ? `CxC #${m.id_cuenta_por_cobrar}`
                          : m.id_cuenta_por_pagar
                            ? `CxP #${m.id_cuenta_por_pagar}`
                            : '—'}
                      </td>
                      <td>
                        {m.id_cuenta_bancaria
                          ? (cuentas.find((c: any) => c.id === m.id_cuenta_bancaria)?.nombre ?? `#${m.id_cuenta_bancaria}`)
                          : '—'}
                      </td>
                      <td className="erp-td-monto">
                        ${Number(m.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td>{m.numero_comprobante || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <div>
            <h2>Próximos vencimientos</h2>
            <p className="erp-panel__hint">Vista rápida de cobros y pagos pendientes</p>
          </div>
        </div>
        {loading ? (
          <div className="erp-loading-inline">
            <div className="erp-loading-inline__spinner" aria-hidden />
            <span>Cargando…</span>
          </div>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cliente / Proveedor</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {[...cxc.map((c: any) => ({ ...c, __tipo: 'Cobrar' })), ...cxp.map((c: any) => ({ ...c, __tipo: 'Pagar' }))]
                  .filter((c: any) => c?.fecha_vencimiento)
                  .sort((a: any, b: any) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
                  .slice(0, 12)
                  .map((c: any, idx) => (
                    <tr key={`${c.__tipo}-${c.id ?? idx}`}>
                      <td>
                        <span className={c.__tipo === 'Cobrar' ? 'erp-pill ok' : 'erp-pill warn'}>{c.__tipo}</span>
                      </td>
                      <td>{c.cliente_nombre || c.proveedor_nombre || c.nombre || '—'}</td>
                      <td>{new Date(c.fecha_vencimiento).toLocaleDateString('es-AR')}</td>
                      <td>{c.estado || '—'}</td>
                      <td className="erp-td-monto">
                        ${Number(c.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

