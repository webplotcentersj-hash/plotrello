import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function ErpReportesPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return d.toISOString().split('T')[0]
  }, [today])
  const defaultTo = useMemo(() => today.toISOString().split('T')[0], [today])

  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo })
  const [facturasEmitidas, setFacturasEmitidas] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiService
      .getFacturas({
        estado: 'Emitida',
        fechaDesde: range.from || undefined,
        fechaHasta: range.to || undefined
      })
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setFacturasEmitidas(Array.isArray(r.data) ? r.data : [])
        else {
          setFacturasEmitidas([])
          if (!r.success) setError(r.error || 'No se pudieron cargar facturas.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.from, range.to])

  const kpisVentas = useMemo(() => {
    const total = facturasEmitidas.reduce((sum: number, f: any) => sum + (Number(f?.total) || 0), 0)
    const count = facturasEmitidas.length
    const avgTicket = count > 0 ? total / count : 0
    return { total, count, avgTicket }
  }, [facturasEmitidas])

  const ventasPorDia = useMemo(() => {
    const map = new Map<string, { fecha: string; total: number; cantidad: number }>()
    for (const f of facturasEmitidas) {
      const fecha = (String(f?.fecha_emision || '').split('T')[0] || '').trim()
      if (!fecha) continue
      const prev = map.get(fecha) || { fecha, total: 0, cantidad: 0 }
      prev.total += Number(f?.total) || 0
      prev.cantidad += 1
      map.set(fecha, prev)
    }
    return Array.from(map.values()).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  }, [facturasEmitidas])

  const topClientes = useMemo(() => {
    const map = new Map<string, { cliente: string; total: number; cantidad: number }>()
    for (const f of facturasEmitidas) {
      const cliente = (f?.cliente_nombre || 'Sin cliente').toString().trim() || 'Sin cliente'
      const prev = map.get(cliente) || { cliente, total: 0, cantidad: 0 }
      prev.total += Number(f?.total) || 0
      prev.cantidad += 1
      map.set(cliente, prev)
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [facturasEmitidas])

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>📊 Reportes ERP</h1>
          <p className="erp-section-sub">Reportes financieros, contables y gerenciales</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/statistics')}>
            Ir a Statistics
          </button>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Ventas (facturas emitidas)</h2>
        <div className="erp-section-actions" style={{ marginBottom: 10 }}>
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
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/facturas?estado=Emitida')}>
            Ver listado →
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 10 }}>
            <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
          </div>
        )}

        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : (
          <>
            <div className="erp-kpi" style={{ marginBottom: 12 }}>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpisVentas.count}</div>
                <div className="erp-kpi-label">Facturas emitidas</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpisVentas.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">Total vendido</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpisVentas.avgTicket.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">Ticket promedio</div>
              </div>
            </div>

            <div className="erp-section-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
              <div className="erp-panel">
                <h2>Ventas por día</h2>
                {ventasPorDia.length === 0 ? (
                  <p className="erp-muted">Sin datos para el rango.</p>
                ) : (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ventasPorDia}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name="Total ($)" fill="#4299e1" />
                        <Bar dataKey="cantidad" name="Cantidad" fill="#68d391" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="erp-panel">
                <h2>Top clientes (por $)</h2>
                {topClientes.length === 0 ? (
                  <p className="erp-muted">Sin datos para el rango.</p>
                ) : (
                  <>
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topClientes} layout="vertical" margin={{ left: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="cliente" width={140} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="total" name="Total ($)" fill="#805ad5" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="erp-table-wrap" style={{ marginTop: 10 }}>
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Cantidad</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topClientes.map((r) => (
                            <tr key={r.cliente}>
                              <td>{r.cliente}</td>
                              <td>{r.cantidad}</td>
                              <td>${Number(r.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>Contables</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/contabilidad')}>
              Contabilidad
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/asientos')}>
              Asientos
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/plan-cuentas')}>
              Plan de cuentas
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: mayor general, balance, estado de resultados.
          </p>
        </div>

        <div className="erp-panel">
          <h2>Tesorería</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/tesoreria')}>
              Tesorería
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-cobrar')}>
              CxC
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/cuentas-por-pagar')}>
              CxP
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: flujo de caja y conciliación bancaria.
          </p>
        </div>

        <div className="erp-panel">
          <h2>Impuestos</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/impuestos')}>
              Impuestos
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/configuracion-afip')}>
              AFIP
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: IVA ventas/compras y reportes por alícuotas.
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Roadmap rápido</h2>
        <ul className="erp-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Balance y estado de resultados (por período)</li>
          <li>Mayor general por cuenta</li>
          <li>Flujo de caja (ingresos/egresos) + proyección</li>
          <li>Libro IVA Ventas / Compras</li>
        </ul>
      </div>
    </div>
  )
}

