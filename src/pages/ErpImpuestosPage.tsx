import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpImpuestosPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [facturasMes, setFacturasMes] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const desde = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    void apiService
      .getFacturas({ fechaDesde: desde })
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setFacturasMes(Array.isArray(r.data) ? r.data : [])
        else {
          setFacturasMes([])
          if (!r.success) setError(r.error || 'No se pudieron cargar facturas.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = useMemo(() => {
    const emitidas = facturasMes.filter((f: any) => f?.estado === 'Emitida')
    const monto = emitidas.reduce((sum: number, f: any) => sum + (Number(f?.total) || 0), 0)
    return { emitidas: emitidas.length, monto }
  }, [facturasMes])

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>🧾 Impuestos</h1>
          <p className="erp-section-sub">AFIP, reportes impositivos y control fiscal</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/configuracion-afip')}>
            Configuración AFIP
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs (mes en curso)</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : (
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{kpis.emitidas}</div>
                <div className="erp-kpi-label">Facturas emitidas</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${kpis.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">Monto emitido</div>
              </div>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>Próximos módulos</h2>
          <p className="erp-muted" style={{ marginTop: 0 }}>
            Para impuestos, lo más útil suele ser:
          </p>
          <ul className="erp-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65 }}>
            <li>Libro IVA Ventas / IVA Compras</li>
            <li>Resumen mensual por alícuotas</li>
            <li>Percepciones / retenciones (si aplican)</li>
            <li>Alertas de vencimientos (IVA, cargas sociales, etc.)</li>
          </ul>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Facturas emitidas (últimas)</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {facturasMes
                  .filter((f: any) => f?.estado === 'Emitida')
                  .slice(0, 12)
                  .map((f: any) => (
                    <tr key={f.id}>
                      <td>{f.numero_factura || '—'}</td>
                      <td>{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-AR') : '—'}</td>
                      <td>{f.cliente_nombre || '—'}</td>
                      <td>${Number(f.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>{f.estado || '—'}</td>
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

