import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpContabilidadPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [asientosBorrador, setAsientosBorrador] = useState<any[]>([])
  const [planCuentas, setPlanCuentas] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([
      apiService.getAsientosContables({ estado: 'Borrador' }),
      apiService.getPlanCuentas(true)
    ])
      .then(([a, pc]) => {
        if (cancelled) return
        if (a.success && a.data) setAsientosBorrador(Array.isArray(a.data) ? a.data : [])
        else setAsientosBorrador([])
        if (pc.success && pc.data) setPlanCuentas(Array.isArray(pc.data) ? pc.data : [])
        else setPlanCuentas([])
        if (!a.success || !pc.success) setError(a.error || pc.error || 'No se pudo cargar contabilidad.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = useMemo(() => {
    return {
      asientosPendientes: asientosBorrador.length,
      cuentasActivas: planCuentas.length
    }
  }, [asientosBorrador, planCuentas])

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>📚 Contabilidad</h1>
          <p className="erp-section-sub">Asientos, plan de cuentas y reportes contables</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/asientos')}>
            Ver Asientos
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : (
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.asientosPendientes}</div>
                <div className="erp-kpi-label">Asientos en borrador</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.cuentasActivas}</div>
                <div className="erp-kpi-label">Cuentas activas (plan)</div>
              </div>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>Accesos</h2>
          <div className="erp-section-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/asientos')}>
              Asientos
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/plan-cuentas')}>
              Plan de cuentas
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/contabilidad/reportes')}>
              Reportes contables
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/erp/reportes')}>
              Reportes
            </button>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            Próximo paso: mayor general, balance, estado de resultados.
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Asientos en borrador (últimos)</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : asientosBorrador.length === 0 ? (
          <p className="erp-muted">No hay asientos en borrador.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Total debe</th>
                  <th>Total haber</th>
                </tr>
              </thead>
              <tbody>
                {asientosBorrador.slice(0, 12).map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.numero_asiento ?? '—'}</td>
                    <td>{a.fecha ? new Date(a.fecha).toLocaleDateString('es-AR') : '—'}</td>
                    <td>{a.concepto ?? '—'}</td>
                    <td>${Number(a.total_debe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>${Number(a.total_haber || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
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

