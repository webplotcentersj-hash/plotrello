import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpPlanCuentasPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiService
      .getPlanCuentas()
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setRows(Array.isArray(r.data) ? r.data : [])
        else {
          setRows([])
          if (!r.success) setError(r.error || 'No se pudo cargar el plan de cuentas.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>📋 Plan de Cuentas</h1>
          <p className="erp-section-sub">Estructura contable</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/contabilidad')}>
            Ir a Contabilidad
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-panel">
        <h2>Listado</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="erp-muted">Sin cuentas cargadas.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Nivel</th>
                  <th>Naturaleza</th>
                  <th>Activa</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 250).map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.codigo}</td>
                    <td>{c.nombre}</td>
                    <td>{c.tipo}</td>
                    <td>{c.nivel}</td>
                    <td>{c.naturaleza}</td>
                    <td>{c.activa ? 'Sí' : 'No'}</td>
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

