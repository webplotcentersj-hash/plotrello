import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { AsientoContableRecord } from '../types/api'
import './AsientosContablesPage.css'

export default function AsientosContablesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [asientos, setAsientos] = useState<(AsientoContableRecord & { detalles?: any[] })[]>([])
  const [filtros, setFiltros] = useState({
    estado: searchParams.get('estado') || '',
    fechaDesde: '',
    fechaHasta: ''
  })

  useEffect(() => {
    loadAsientos()
  }, [filtros])

  const loadAsientos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getAsientosContables({
        estado: filtros.estado || undefined,
        fechaDesde: filtros.fechaDesde || undefined,
        fechaHasta: filtros.fechaHasta || undefined
      })

      if (response.success && response.data) {
        setAsientos(response.data)
      }
    } catch (error) {
      console.error('Error cargando asientos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleContabilizar = async (id: number) => {
    if (!confirm('¿Estás seguro de contabilizar este asiento? No se podrá modificar después.')) {
      return
    }

    try {
      const response = await apiService.contabilizarAsiento(id)
      if (response.success) {
        alert('Asiento contabilizado correctamente')
        loadAsientos()
      } else {
        alert('Error al contabilizar: ' + response.error)
      }
    } catch (error) {
      console.error('Error contabilizando asiento:', error)
      alert('Error al contabilizar asiento')
    }
  }

  if (loading) {
    return (
      <div className="asientos-page">
        <div className="loading">Cargando asientos...</div>
      </div>
    )
  }

  return (
    <div className="asientos-page">
      <div className="asientos-header">
        <h1>📝 Asientos Contables</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver
          </button>
          <button className="btn-primary" onClick={() => navigate('/erp/asientos/nuevo')}>
            + Nuevo Asiento
          </button>
        </div>
      </div>

      <div className="asientos-filters">
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="Borrador">Borrador</option>
          <option value="Contabilizado">Contabilizado</option>
          <option value="Anulado">Anulado</option>
        </select>

        <input
          type="date"
          value={filtros.fechaDesde}
          onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
          className="filter-input"
          placeholder="Desde"
        />

        <input
          type="date"
          value={filtros.fechaHasta}
          onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
          className="filter-input"
          placeholder="Hasta"
        />
      </div>

      <div className="asientos-list">
        {asientos.length === 0 ? (
          <div className="empty-state">
            No hay asientos que coincidan con los filtros
          </div>
        ) : (
          asientos.map(asiento => (
            <div key={asiento.id} className="asiento-card">
              <div className="asiento-header">
                <div>
                  <h3>{asiento.numero_asiento}</h3>
                  <p className="asiento-concepto">{asiento.concepto}</p>
                  <div className="asiento-meta">
                    <span>{new Date(asiento.fecha).toLocaleDateString('es-AR')}</span>
                    <span className="separator">•</span>
                    <span>{asiento.tipo_asiento}</span>
                    <span className="separator">•</span>
                    <span className={`estado-badge estado-${asiento.estado.toLowerCase()}`}>
                      {asiento.estado}
                    </span>
                  </div>
                </div>
                <div className="asiento-totales">
                  <div className="total-item">
                    <span className="total-label">Debe:</span>
                    <span className="total-value">${asiento.total_debe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">Haber:</span>
                    <span className="total-value">${asiento.total_haber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {Math.abs(asiento.total_debe - asiento.total_haber) > 0.01 && (
                    <div className="total-error">
                      ⚠️ Desbalance: ${Math.abs(asiento.total_debe - asiento.total_haber).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>

              {asiento.detalles && asiento.detalles.length > 0 && (
                <div className="asiento-detalles">
                  <table className="detalles-table">
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th>Concepto</th>
                        <th className="text-right">Debe</th>
                        <th className="text-right">Haber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asiento.detalles.map((detalle: any) => (
                        <tr key={detalle.id}>
                          <td>
                            {detalle.cuenta?.codigo || 'N/A'} - {detalle.cuenta?.nombre || 'Sin cuenta'}
                          </td>
                          <td>{detalle.concepto || '-'}</td>
                          <td className="text-right">
                            {detalle.debe > 0 ? `$${detalle.debe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="text-right">
                            {detalle.haber > 0 ? `$${detalle.haber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="asiento-actions">
                <button
                  className="btn-small btn-view"
                  onClick={() => navigate(`/erp/asientos/${asiento.id}`)}
                >
                  Ver Detalle
                </button>
                {asiento.estado === 'Borrador' && (
                  <>
                    <button
                      className="btn-small btn-edit"
                      onClick={() => navigate(`/erp/asientos/${asiento.id}/editar`)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn-small btn-contabilizar"
                      onClick={() => handleContabilizar(asiento.id)}
                    >
                      Contabilizar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

