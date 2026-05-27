import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import type { PresupuestoClienteItemRecord } from '../types/api'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClientePresupuestoDetallePage.css'

interface PresupuestoDetalle {
  presupuesto: any
  items: PresupuestoClienteItemRecord[]
}

export default function ClientePresupuestoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [presupuestoDetalle, setPresupuestoDetalle] = useState<PresupuestoDetalle | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    if (id) {
      loadPresupuesto()
    }
  }, [cliente, authLoading, navigate, id])

  const loadPresupuesto = async () => {
    if (!id) return
    
    setLoading(true)
    setError('')
    try {
      const response = await apiService.getDetallePresupuestoCliente(parseInt(id))
      if (response.success && response.data) {
        setPresupuestoDetalle(response.data)
      } else {
        setError(response.error || 'Error al cargar presupuesto')
      }
    } catch (err) {
      setError('Error al cargar presupuesto')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      borrador: '#6b7280',
      enviado: '#3b82f6',
      aceptado: '#10b981',
      rechazado: '#ef4444',
      cancelado: '#9ca3af',
      convertido: '#6366f1'
    }
    return colors[estado] || '#6b7280'
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      borrador: 'Borrador',
      enviado: 'Enviado',
      aceptado: 'Aceptado',
      rechazado: 'Rechazado',
      cancelado: 'Cancelado',
      convertido: 'Convertido a Pedido'
    }
    return labels[estado] || estado
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  if (!presupuestoDetalle) {
    return (
      <ClientePageLayout className="cliente-presupuesto-detalle-page">
        <div className="cliente-page-empty">
          <p>{error || 'Presupuesto no encontrado'}</p>
          <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/presupuestos')}>
            Volver a presupuestos
          </button>
        </div>
      </ClientePageLayout>
    )
  }

  const { presupuesto, items } = presupuestoDetalle
  const puedeEditar = presupuesto.estado === 'borrador'

  return (
    <ClientePageLayout className="cliente-presupuesto-detalle-page">
      <ClientePageHeader
        eyebrow="Cotizaciones"
        title={presupuesto.numero_presupuesto}
        subtitle={getEstadoLabel(presupuesto.estado)}
        actions={
          <>
            <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/presupuestos')}>
              ← Lista
            </button>
            {puedeEditar && (
              <button
                type="button"
                className="cliente-btn-primary"
                onClick={() => navigate(`/cliente/presupuesto/${presupuesto.id}/editar`)}
              >
                Editar
              </button>
            )}
          </>
        }
      />

      <div className="cliente-presupuesto-detalle-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Información del presupuesto */}
        <section className="presupuesto-info-section">
          <div className="presupuesto-header-info">
            <div className="presupuesto-status">
              <span 
                className="status-badge"
                style={{ backgroundColor: getEstadoColor(presupuesto.estado) }}
              >
                {getEstadoLabel(presupuesto.estado)}
              </span>
            </div>
            <div className="presupuesto-dates">
              <div className="date-item">
                <span className="date-label">Fecha de creación:</span>
                <span className="date-value">
                  {new Date(presupuesto.fecha_creacion).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              {presupuesto.fecha_envio && (
                <div className="date-item">
                  <span className="date-label">Fecha de envío:</span>
                  <span className="date-value">
                    {new Date(presupuesto.fecha_envio).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {presupuesto.fecha_vencimiento && (
                <div className="date-item">
                  <span className="date-label">Válido hasta:</span>
                  <span className="date-value">
                    {new Date(presupuesto.fecha_vencimiento).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {presupuesto.observaciones_cliente && (
            <div className="presupuesto-observaciones">
              <h3>Observaciones:</h3>
              <p>{presupuesto.observaciones_cliente}</p>
            </div>
          )}

          {presupuesto.id_pedido_asociado && (
            <div className="presupuesto-pedido-asociado">
              <p>
                <strong>Este presupuesto fue convertido a pedido:</strong> #{presupuesto.id_pedido_asociado}
              </p>
              <button
                className="cliente-btn-primary"
                onClick={() => navigate(`/cliente/pedido/${presupuesto.id_pedido_asociado}`)}
              >
                Ver Pedido
              </button>
            </div>
          )}
        </section>

        {/* Items del presupuesto */}
        <section className="presupuesto-items-section">
          <h2>Artículos</h2>
          <div className="items-table">
            <table>
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Cantidad</th>
                  <th>Precio Unitario</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="item-name">
                        <strong>{item.articulo?.nombre || 'Artículo'}</strong>
                        {item.descripcion_personalizada && (
                          <p className="item-description">{item.descripcion_personalizada}</p>
                        )}
                      </div>
                    </td>
                    <td>{item.cantidad}</td>
                    <td>${item.precio_unitario.toFixed(2)}</td>
                    <td className="item-total-cell">${item.precio_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="total-label">
                    <strong>Total:</strong>
                  </td>
                  <td className="total-value">
                    <strong>${presupuesto.precio_total.toFixed(2)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Acciones */}
        {puedeEditar && (
          <div className="presupuesto-actions">
            <button
              className="btn-secondary"
              onClick={() => navigate(`/cliente/presupuesto/${presupuesto.id}/editar`)}
            >
              Editar Presupuesto
            </button>
          </div>
        )}
      </div>
    </ClientePageLayout>
  )
}

