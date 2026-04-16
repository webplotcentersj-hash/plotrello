import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpTesoreriaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const estado = (searchParams.get('estado') || '').trim() || null

  const [loading, setLoading] = useState(true)
  const [cxc, setCxc] = useState<any[]>([])
  const [cxp, setCxp] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>🏦 Tesorería</h1>
          <p className="erp-section-sub">Cuentas por cobrar / pagar, vencimientos y caja</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/caja/dashboard')}>
            Ir a Caja
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
            Próximo paso: flujo de caja (ingresos/egresos) y conciliaciones bancarias.
          </p>
        </div>
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

