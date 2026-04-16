import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpCuentasPorPagarPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const estado = (searchParams.get('estado') || '').trim() || ''

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiService
      .getCuentasPorPagar(estado ? ({ estado } as any) : undefined)
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setRows(Array.isArray(r.data) ? r.data : [])
        else {
          setRows([])
          if (!r.success) setError(r.error || 'No se pudieron cargar cuentas.')
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
    const pending = rows.filter((c: any) => c?.estado === 'Pendiente' || c?.estado === 'Parcial')
    const monto = pending.reduce((sum: number, c: any) => sum + (Number(c?.monto_pendiente) || 0), 0)
    return { total: rows.length, pendientes: pending.length, monto }
  }, [rows])

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>💸 Cuentas por Pagar</h1>
          <p className="erp-section-sub">Filtro: {estado || 'todas'}</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria')}>
            Ir a Tesorería
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs</h2>
          <div className="erp-kpi">
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.total}</div>
              <div className="erp-kpi-label">Cuentas</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.pendientes}</div>
              <div className="erp-kpi-label">Pendientes / parcial</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">
                ${kpis.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <div className="erp-kpi-label">Monto pendiente</div>
            </div>
          </div>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Listado</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="erp-muted">Sin datos para el filtro.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Monto pendiente</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.proveedor_nombre || '—'}</td>
                    <td>{c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-AR') : '—'}</td>
                    <td>{c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}</td>
                    <td>{c.estado || '—'}</td>
                    <td>${Number(c.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>{c.numero_comprobante || c.comprobante || '—'}</td>
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

