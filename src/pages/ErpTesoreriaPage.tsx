import { useEffect, useMemo, useState } from 'react'
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
import './ErpSectionPage.css'

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
      apiService.getCuentasPorPagar(estado ? ({ estado } as any) : undefined)
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
      <div className="erp-section-header">
        <div>
          <h1>🏦 Tesorería</h1>
          <p className="erp-section-sub">Cuentas por cobrar / pagar, vencimientos y flujo de caja</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/caja/dashboard')}>
            Ir a Caja
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria/cuentas')}>
            Cuentas bancarias
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>Resumen</h2>
          <div className="erp-kpi">
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">
                ${kpis.montoCxc.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <div className="erp-kpi-label">Por cobrar (pendiente/parcial)</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">
                ${kpis.montoCxp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <div className="erp-kpi-label">Por pagar (pendiente/parcial)</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.vencidasCxc}</div>
              <div className="erp-kpi-label">Cuentas por cobrar vencidas</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.vencidasCxp}</div>
              <div className="erp-kpi-label">Cuentas por pagar vencidas</div>
            </div>
          </div>
        </div>

        <div className="erp-panel">
          <h2>Accesos</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-cobrar')}>
              Cuentas por cobrar
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-pagar')}>
              Cuentas por pagar
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: conciliaciones bancarias y caja por cuenta.
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Flujo de caja (pagos / cobros)</h2>
        <div className="erp-section-actions" style={{ marginBottom: 10 }}>
          <label className="erp-muted">
            Tipo{' '}
            <select
              value={tipoMov}
              onChange={(e) => setTipoMov(e.target.value as any)}
              style={{ marginLeft: 8 }}
            >
              <option value="Todos">Todos</option>
              <option value="Cobro">Cobros</option>
              <option value="Pago">Pagos</option>
            </select>
          </label>
          <label className="erp-muted">
            Cuenta{' '}
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="">Todas</option>
              {cuentas.map((c: any) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-muted">
            Desde{' '}
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
              style={{ marginLeft: 8 }}
            />
          </label>
          <label className="erp-muted">
            Hasta{' '}
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
              style={{ marginLeft: 8 }}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={exportCajaCsv} disabled={loadingCaja}>
            Export CSV
          </button>
        </div>

        {loadingCaja ? (
          <p className="erp-muted">Cargando…</p>
        ) : (
          <>
            <div className="erp-kpi" style={{ marginBottom: 12 }}>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpisCaja.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">Ingresos (cobros)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpisCaja.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">Egresos (pagos)</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpisCaja.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">Saldo neto</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpisCaja.cantidad}</div>
                <div className="erp-kpi-label">Movimientos</div>
              </div>
            </div>

            {flujoPorDia.length === 0 ? (
              <p className="erp-muted">Sin movimientos para el rango.</p>
            ) : (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flujoPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#68d391" />
                    <Bar dataKey="egresos" name="Egresos" fill="#fc8181" />
                    <Bar dataKey="neto" name="Neto" fill="#4299e1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="erp-table-wrap" style={{ marginTop: 12 }}>
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
                    <th>Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.slice(0, 20).map((m: any) => (
                    <tr key={m.id}>
                      <td>{m.fecha_pago ? new Date(m.fecha_pago).toLocaleDateString('es-AR') : '—'}</td>
                      <td>{m.tipo}</td>
                      <td>{m.metodo_pago || '—'}</td>
                      <td>{m.id_cuenta_por_cobrar ? `CxC #${m.id_cuenta_por_cobrar}` : m.id_cuenta_por_pagar ? `CxP #${m.id_cuenta_por_pagar}` : '—'}</td>
                      <td>
                        {m.id_cuenta_bancaria
                          ? (cuentas.find((c: any) => c.id === m.id_cuenta_bancaria)?.nombre ?? `#${m.id_cuenta_bancaria}`)
                          : '—'}
                      </td>
                      <td>${Number(m.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>{m.numero_comprobante || '—'}</td>
                      <td>{m.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="erp-panel">
        <h2>Últimos vencimientos (vista rápida)</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cliente/Proveedor</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Monto pendiente</th>
                </tr>
              </thead>
              <tbody>
                {[...cxc.map((c: any) => ({ ...c, __tipo: 'Cobrar' })), ...cxp.map((c: any) => ({ ...c, __tipo: 'Pagar' }))]
                  .filter((c: any) => c?.fecha_vencimiento)
                  .sort((a: any, b: any) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
                  .slice(0, 12)
                  .map((c: any, idx) => (
                    <tr key={`${c.__tipo}-${c.id ?? idx}`}>
                      <td>{c.__tipo}</td>
                      <td>{c.cliente_nombre || c.proveedor_nombre || c.nombre || '—'}</td>
                      <td>{new Date(c.fecha_vencimiento).toLocaleDateString('es-AR')}</td>
                      <td>{c.estado || '—'}</td>
                      <td>${Number(c.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

