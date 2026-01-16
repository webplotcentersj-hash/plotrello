import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { FacturaVentaRecord } from '../types/api'
import './FacturasPage.css'

export default function FacturasPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState<FacturaVentaRecord[]>([])
  const [filtros, setFiltros] = useState({
    estado: searchParams.get('estado') || '',
    fechaDesde: '',
    fechaHasta: '',
    tipoComprobante: ''
  })

  useEffect(() => {
    loadFacturas()
  }, [filtros])

  const loadFacturas = async () => {
    setLoading(true)
    try {
      const response = await apiService.getFacturas({
        estado: filtros.estado || undefined,
        fechaDesde: filtros.fechaDesde || undefined,
        fechaHasta: filtros.fechaHasta || undefined,
        tipo_comprobante: filtros.tipoComprobante || undefined
      })

      if (response.success && response.data) {
        setFacturas(response.data)
      }
    } catch (error) {
      console.error('Error cargando facturas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmitirFactura = async (id: number) => {
    if (!confirm('¿Estás seguro de emitir esta factura? Se creará la cuenta por cobrar y el asiento contable.')) {
      return
    }

    try {
      const response = await apiService.emitirFactura(id)
      if (response.success) {
        alert('Factura emitida correctamente')
        loadFacturas()
      } else {
        alert('Error al emitir factura: ' + response.error)
      }
    } catch (error) {
      console.error('Error emitiendo factura:', error)
      alert('Error al emitir factura')
    }
  }

  if (loading) {
    return (
      <div className="facturas-page">
        <div className="loading">Cargando facturas...</div>
      </div>
    )
  }

  return (
    <div className="facturas-page">
      <div className="facturas-header">
        <h1>🧾 Facturas de Venta</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver
          </button>
          <button className="btn-primary" onClick={() => navigate('/erp/facturas/nueva')}>
            + Nueva Factura
          </button>
        </div>
      </div>

      <div className="facturas-filters">
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="Borrador">Borrador</option>
          <option value="Emitida">Emitida</option>
          <option value="Anulada">Anulada</option>
          <option value="Cancelada">Cancelada</option>
        </select>

        <select
          value={filtros.tipoComprobante}
          onChange={(e) => setFiltros({ ...filtros, tipoComprobante: e.target.value })}
          className="filter-select"
        >
          <option value="">Todos los tipos</option>
          <option value="Factura A">Factura A</option>
          <option value="Factura B">Factura B</option>
          <option value="Factura C">Factura C</option>
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

      <div className="facturas-table-container">
        <table className="facturas-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Total</th>
              <th>Estado</th>
              <th>AFIP</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facturas.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No hay facturas que coincidan con los filtros
                </td>
              </tr>
            ) : (
              facturas.map(factura => (
                <tr key={factura.id}>
                  <td>{factura.numero_factura}</td>
                  <td>{factura.cliente_nombre}</td>
                  <td>{new Date(factura.fecha_emision).toLocaleDateString('es-AR')}</td>
                  <td>{factura.tipo_comprobante}</td>
                  <td>${factura.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span className={`estado-badge estado-${factura.estado.toLowerCase()}`}>
                      {factura.estado}
                    </span>
                  </td>
                  <td>
                    {factura.estado_afip && (
                      <span className={`afip-badge afip-${factura.estado_afip.toLowerCase()}`}>
                        {factura.estado_afip}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-small btn-view"
                        onClick={() => navigate(`/erp/facturas/${factura.id}`)}
                      >
                        Ver
                      </button>
                      {factura.estado === 'Borrador' && (
                        <button
                          className="btn-small btn-emit"
                          onClick={() => handleEmitirFactura(factura.id)}
                        >
                          Emitir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

