import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { saldosCcPorCliente } from '../services/erpContableApi'
import './ErpSectionPage.css'

function inicioDia(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function diasDesdeHoy(fechaIso: string, hoy = inicioDia()): number {
  const f = inicioDia(new Date(fechaIso))
  return Math.round((f.getTime() - hoy.getTime()) / 86400000)
}

function fmtMoneyAr(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function esPendienteCx(c: { estado?: string | null }): boolean {
  return c.estado === 'Pendiente' || c.estado === 'Parcial'
}

export default function ErpTesoreriaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const estado = (searchParams.get('estado') || '').trim() || null

  const [loading, setLoading] = useState(true)
  const [loadingCaja, setLoadingCaja] = useState(true)
  const [cxc, setCxc] = useState<any[]>([])
  const [cxp, setCxp] = useState<any[]>([])
  const [movs, setMovs] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ccResumen, setCcResumen] = useState({ clientes: 0, saldo: 0 })

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
      apiService.erpSyncCxpDesdeFacturasCompra(),
      saldosCcPorCliente()
    ])
      .then(([r1, r2, _sync, rCc]) => {
        if (cancelled) return
        if (r1.success && r1.data) setCxc(Array.isArray(r1.data) ? r1.data : [])
        else setCxc([])
        if (r2.success && r2.data) setCxp(Array.isArray(r2.data) ? r2.data : [])
        else setCxp([])
        if (rCc.success && rCc.data) {
          let saldo = 0
          let clientes = 0
          for (const s of rCc.data.values()) {
            const neto = (Number(s.debe) || 0) - (Number(s.haber) || 0)
            if (Math.abs(neto) < 0.01) continue
            saldo += neto
            clientes += 1
          }
          setCcResumen({ clientes, saldo: Math.round(saldo * 100) / 100 })
        } else {
          setCcResumen({ clientes: 0, saldo: 0 })
        }
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

  const kpisCaja = useMemo(() => {
    const ingresos = movs.filter((m: any) => m?.tipo === 'Cobro').reduce((s: number, m: any) => s + (Number(m?.monto) || 0), 0)
    const egresos = movs.filter((m: any) => m?.tipo === 'Pago').reduce((s: number, m: any) => s + (Number(m?.monto) || 0), 0)
    return { ingresos, egresos, neto: ingresos - egresos, cantidad: movs.length }
  }, [movs])

  const resumenHub = useMemo(() => {
    const hoy = inicioDia().getTime()
    const cxcPend = cxc.filter((c: any) => esPendienteCx(c))
    const cxpPend = cxp.filter((c: any) => esPendienteCx(c))
    const montoCxc = cxcPend.reduce((s: number, c: any) => s + (Number(c?.monto_pendiente) || 0), 0)
    const montoCxp = cxpPend.reduce((s: number, c: any) => s + (Number(c?.monto_pendiente) || 0), 0)
    const cxpVencidas = cxpPend.filter(
      (c: any) => c?.fecha_vencimiento && new Date(c.fecha_vencimiento).getTime() < hoy
    ).length
    const cxcVencidas = cxcPend.filter(
      (c: any) => c?.fecha_vencimiento && new Date(c.fecha_vencimiento).getTime() < hoy
    ).length
    return {
      montoCxc,
      nCxc: cxcPend.length,
      cxcVencidas,
      montoCxp,
      nCxp: cxpPend.length,
      cxpVencidas,
      nBancos: cuentas.length
    }
  }, [cxc, cxp, cuentas])

  /** Vencidas recientes + por vencer (60 días); orden: más cerca de hoy. */
  const vencimientosCercanos = useMemo(() => {
    const hoy = inicioDia()
    const filas = [
      ...cxc.map((c: any) => ({ ...c, __tipo: 'Cobrar' as const })),
      ...cxp.map((c: any) => ({ ...c, __tipo: 'Pagar' as const }))
    ]
      .filter((c: any) => {
        if (!c?.fecha_vencimiento) return false
        if (c.estado === 'Pagado' || c.estado === 'Cancelado') return false
        const dias = diasDesdeHoy(String(c.fecha_vencimiento), hoy)
        return dias >= -45 && dias <= 60
      })
      .map((c: any) => {
        const dias = diasDesdeHoy(String(c.fecha_vencimiento), hoy)
        return { ...c, __dias: dias }
      })
      .sort((a: any, b: any) => Math.abs(a.__dias) - Math.abs(b.__dias) || a.__dias - b.__dias)
      .slice(0, 12)
    return filas
  }, [cxc, cxp])

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
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria/cheques')}>
            Cheques
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria/cobradores')}>
            Cobradores
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria/consolidadas')}>
            Ctas. ctes. consolidadas
          </button>
        </div>
      </header>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      {resumenHub.cxpVencidas > 0 && (
        <div className="erp-alertas-panel erp-alertas-panel--danger erp-alertas-panel--compact">
          <p>
            <strong>{resumenHub.cxpVencidas}</strong> CxP vencida{resumenHub.cxpVencidas === 1 ? '' : 's'} ·{' '}
            {fmtMoneyAr(resumenHub.montoCxp)} pendientes en total
          </p>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/erp/cuentas-por-pagar')}>
            Ver CxP
          </button>
        </div>
      )}

      <div className="erp-quick-grid">
        <button
          type="button"
          className="erp-quick-card"
          style={{ '--quick-accent': '#10b981' } as CSSProperties}
          onClick={() => navigate('/erp/cuentas-por-cobrar')}
          disabled={loading}
        >
          <span className="erp-quick-card__glow" aria-hidden />
          <span className="erp-quick-card__icon">💳</span>
          <span className="erp-quick-card__title">Cuentas por cobrar</span>
          <span className="erp-quick-card__metric">
            {loading ? '…' : fmtMoneyAr(resumenHub.montoCxc)}
          </span>
          <span className="erp-quick-card__desc">
            {loading
              ? 'Cargando…'
              : `${resumenHub.nCxc} abierta${resumenHub.nCxc === 1 ? '' : 's'}${
                  resumenHub.cxcVencidas > 0 ? ` · ${resumenHub.cxcVencidas} vencida${resumenHub.cxcVencidas === 1 ? '' : 's'}` : ''
                }`}
          </span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button
          type="button"
          className="erp-quick-card"
          style={{ '--quick-accent': '#0ea5e9' } as CSSProperties}
          onClick={() => navigate('/erp/cuentas-por-cobrar?tab=cuenta_corriente')}
          disabled={loading}
        >
          <span className="erp-quick-card__glow" aria-hidden />
          <span className="erp-quick-card__icon">🤝</span>
          <span className="erp-quick-card__title">Cuenta corriente</span>
          <span className="erp-quick-card__metric">
            {loading ? '…' : fmtMoneyAr(ccResumen.saldo)}
          </span>
          <span className="erp-quick-card__desc">
            {loading
              ? 'Cargando…'
              : `${ccResumen.clientes} cliente${ccResumen.clientes === 1 ? '' : 's'} con saldo · ventas fiadas`}
          </span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button
          type="button"
          className="erp-quick-card"
          style={{ '--quick-accent': '#f43f5e' } as CSSProperties}
          onClick={() => navigate('/erp/cuentas-por-pagar')}
          disabled={loading}
        >
          <span className="erp-quick-card__glow" aria-hidden />
          <span className="erp-quick-card__icon">📋</span>
          <span className="erp-quick-card__title">Cuentas por pagar</span>
          <span className="erp-quick-card__metric">
            {loading ? '…' : fmtMoneyAr(resumenHub.montoCxp)}
          </span>
          <span className="erp-quick-card__desc">
            {loading
              ? 'Cargando…'
              : `${resumenHub.nCxp} abierta${resumenHub.nCxp === 1 ? '' : 's'}${
                  resumenHub.cxpVencidas > 0 ? ` · ${resumenHub.cxpVencidas} vencida${resumenHub.cxpVencidas === 1 ? '' : 's'}` : ''
                }`}
          </span>
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
          <span className="erp-quick-card__metric">{resumenHub.nBancos}</span>
          <span className="erp-quick-card__desc">
            {resumenHub.nBancos === 1 ? 'cuenta activa' : 'cuentas activas'} · catálogo de cobros/pagos
          </span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
      </div>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <div>
            <h2>Vencimientos cercanos</h2>
            <p className="erp-panel__hint">Últimos 45 días y próximos 60 · ordenados por cercanía a hoy</p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => navigate('/erp/cuentas-por-pagar')}>
            Todas las CxP
          </button>
        </div>
        {loading ? (
          <div className="erp-loading-inline">
            <div className="erp-loading-inline__spinner" aria-hidden />
            <span>Cargando…</span>
          </div>
        ) : vencimientosCercanos.length === 0 ? (
          <p className="erp-muted">No hay vencimientos en esa ventana.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cliente / Proveedor</th>
                  <th>Vencimiento</th>
                  <th>Situación</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {vencimientosCercanos.map((c: any, idx: number) => {
                  const dias = Number(c.__dias) || 0
                  const situacion =
                    dias < 0 ? `Vencida hace ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoy' : `En ${dias}d`
                  return (
                    <tr key={`${c.__tipo}-${c.id ?? idx}`}>
                      <td>
                        <span className={c.__tipo === 'Cobrar' ? 'erp-pill ok' : 'erp-pill warn'}>{c.__tipo}</span>
                      </td>
                      <td>{c.cliente_nombre || c.proveedor_nombre || c.nombre || '—'}</td>
                      <td>{new Date(c.fecha_vencimiento).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span className={dias < 0 ? 'erp-pill danger' : dias <= 7 ? 'erp-pill warn' : 'erp-pill ok'}>
                          {situacion}
                        </span>
                      </td>
                      <td className="erp-td-monto">
                        ${Number(c.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <div>
            <h2>Flujo de caja (ERP)</h2>
            <p className="erp-panel__hint">
              Cobros y pagos de tesorería en el período · la caja del mostrador está en Control de cajas
            </p>
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
    </div>
  )
}

