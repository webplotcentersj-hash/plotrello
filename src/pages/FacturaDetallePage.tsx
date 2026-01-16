import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import apiService from '../services/api'
import type { FacturaVentaRecord, FacturaItemRecord } from '../types/api'
import './FacturaDetallePage.css'

export default function FacturaDetallePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [factura, setFactura] = useState<(FacturaVentaRecord & { items?: FacturaItemRecord[] }) | null>(null)

  useEffect(() => {
    if (id) {
      loadFactura(parseInt(id))
    }
  }, [id])

  const loadFactura = async (facturaId: number) => {
    setLoading(true)
    try {
      const response = await apiService.getFactura(facturaId)
      if (response.success && response.data) {
        setFactura(response.data)
      } else {
        alert('Error al cargar factura: ' + response.error)
        navigate('/erp/facturas')
      }
    } catch (error) {
      console.error('Error cargando factura:', error)
      alert('Error al cargar factura')
      navigate('/erp/facturas')
    } finally {
      setLoading(false)
    }
  }

  const handleEmitir = async () => {
    if (!factura || !confirm('¿Estás seguro de emitir esta factura? Se creará la cuenta por cobrar y el asiento contable.')) {
      return
    }

    try {
      const response = await apiService.emitirFactura(factura.id)
      if (response.success) {
        alert('Factura emitida correctamente')
        if (id) loadFactura(parseInt(id))
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
      <div className="factura-detalle-page">
        <div className="loading">Cargando factura...</div>
      </div>
    )
  }

  if (!factura) {
    return (
      <div className="factura-detalle-page">
        <div className="error">Factura no encontrada</div>
      </div>
    )
  }

  return (
    <div className="factura-detalle-page">
      <div className="factura-header">
        <div>
          <h1>Factura {factura.numero_factura}</h1>
          <div className="factura-meta">
            <span className={`estado-badge estado-${factura.estado.toLowerCase()}`}>
              {factura.estado}
            </span>
            {factura.estado_afip && (
              <>
                <span className="separator">•</span>
                <span className={`afip-badge afip-${factura.estado_afip.toLowerCase()}`}>
                  AFIP: {factura.estado_afip}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
            ← Volver
          </button>
          {factura.estado === 'Borrador' && (
            <button className="btn-primary" onClick={handleEmitir}>
              Emitir Factura
            </button>
          )}
        </div>
      </div>

      <div className="factura-content">
        <div className="factura-section">
          <h2>Datos del Comprobante</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Tipo de Comprobante</label>
              <div>{factura.tipo_comprobante}</div>
            </div>
            <div className="info-item">
              <label>Punto de Venta</label>
              <div>{factura.punto_venta}</div>
            </div>
            <div className="info-item">
              <label>Número de Comprobante</label>
              <div>{factura.numero_comprobante}</div>
            </div>
            <div className="info-item">
              <label>Fecha de Emisión</label>
              <div>{new Date(factura.fecha_emision).toLocaleDateString('es-AR')}</div>
            </div>
            {factura.fecha_vencimiento && (
              <div className="info-item">
                <label>Fecha de Vencimiento</label>
                <div>{new Date(factura.fecha_vencimiento).toLocaleDateString('es-AR')}</div>
              </div>
            )}
            {factura.cae && (
              <div className="info-item">
                <label>CAE</label>
                <div>{factura.cae}</div>
              </div>
            )}
            {factura.numero_cae && (
              <div className="info-item">
                <label>Número CAE</label>
                <div>{factura.numero_cae}</div>
              </div>
            )}
            {factura.fecha_vencimiento_cae && (
              <div className="info-item">
                <label>Vencimiento CAE</label>
                <div>{new Date(factura.fecha_vencimiento_cae).toLocaleDateString('es-AR')}</div>
              </div>
            )}
          </div>
        </div>

        <div className="factura-section">
          <h2>Datos del Cliente</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Cliente</label>
              <div>{factura.cliente_nombre}</div>
            </div>
            {factura.cliente_dni_cuit && (
              <div className="info-item">
                <label>DNI/CUIT</label>
                <div>{factura.cliente_dni_cuit}</div>
              </div>
            )}
            {factura.cliente_condicion_iva && (
              <div className="info-item">
                <label>Condición IVA</label>
                <div>{factura.cliente_condicion_iva}</div>
              </div>
            )}
            {factura.cliente_direccion && (
              <div className="info-item full-width">
                <label>Dirección</label>
                <div>{factura.cliente_direccion}</div>
              </div>
            )}
          </div>
        </div>

        {factura.numero_op && (
          <div className="factura-section">
            <h2>Orden de Trabajo Asociada</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Número OP</label>
                <div>
                  <button
                    className="link-button"
                    onClick={() => navigate(`/op/${factura.id_op}`)}
                  >
                    {factura.numero_op}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="factura-section">
          <h2>Items de la Factura</h2>
          <div className="items-table-container">
            <table className="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Descripción</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">P. Unitario</th>
                  <th className="text-right">Descuento</th>
                  <th className="text-right">IVA %</th>
                  <th className="text-right">IVA Monto</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {factura.items && factura.items.length > 0 ? (
                  factura.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.item_numero}</td>
                      <td>{item.descripcion}</td>
                      <td className="text-right">{item.cantidad}</td>
                      <td className="text-right">${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right">
                        {item.descuento > 0 ? `$${item.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="text-right">{item.iva_porcentaje}%</td>
                      <td className="text-right">${item.iva_monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right">${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="empty-state">No hay items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="factura-section">
          <h2>Totales</h2>
          <div className="totales-container">
            <div className="total-row">
              <span className="total-label">Subtotal:</span>
              <span className="total-value">${factura.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            {factura.descuento > 0 && (
              <div className="total-row">
                <span className="total-label">Descuento:</span>
                <span className="total-value">-${factura.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="total-row">
              <span className="total-label">IVA:</span>
              <span className="total-value">${factura.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="total-row total-final">
              <span className="total-label">Total:</span>
              <span className="total-value">${factura.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {factura.observaciones && (
          <div className="factura-section">
            <h2>Observaciones</h2>
            <div className="observaciones">{factura.observaciones}</div>
          </div>
        )}
      </div>
    </div>
  )
}

