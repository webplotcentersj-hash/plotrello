import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PresupuestoClienteItemRecord } from '../types/api'
import './PresupuestoClienteDetalleAdminPage.css'

interface PresupuestoDetalle {
  presupuesto: any
  items: PresupuestoClienteItemRecord[]
}

export default function PresupuestoClienteDetalleAdminPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canAccessMostradorViews, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [presupuestoDetalle, setPresupuestoDetalle] = useState<PresupuestoDetalle | null>(null)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [observacionesInternas, setObservacionesInternas] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!canAccessMostradorViews) {
      navigate('/')
      return
    }
    if (id) {
      loadPresupuesto()
    }
  }, [id, canAccessMostradorViews, navigate, authLoading])

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

  const handleConvertirAPedido = async () => {
    if (!id) return
    
    if (!confirm('¿Estás seguro de convertir este presupuesto en un pedido? Esto creará un nuevo pedido de cliente.')) {
      return
    }

    setConvirtiendo(true)
    try {
      const response = await apiService.convertirPresupuestoAPedido(
        parseInt(id),
        observacionesInternas || undefined
      )
      if (response.success && response.data) {
        alert(`Presupuesto convertido exitosamente. Pedido creado: ${response.data.numero_pedido}`)
        navigate(`/clientes-web/presupuestos`)
      } else {
        alert(response.error || 'Error al convertir presupuesto')
      }
    } catch (err) {
      alert('Error al convertir presupuesto')
      console.error(err)
    } finally {
      setConvirtiendo(false)
    }
  }

  const handleCambiarEstado = async (nuevoEstado: 'aceptado' | 'rechazado') => {
    if (!id) return
    
    try {
      const response = await apiService.actualizarPresupuestoCliente(parseInt(id), {
        estado: nuevoEstado
      })
      if (response.success) {
        alert(`Presupuesto marcado como ${nuevoEstado}`)
        loadPresupuesto()
      } else {
        alert(response.error || 'Error al actualizar estado')
      }
    } catch (err) {
      alert('Error al actualizar estado')
      console.error(err)
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
    return (
      <div className="presupuesto-cliente-detalle-admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando presupuesto...</p>
        </div>
      </div>
    )
  }

  if (!presupuestoDetalle) {
    return (
      <div className="presupuesto-cliente-detalle-admin-page">
        <div className="error-container">
          <p>{error || 'Presupuesto no encontrado'}</p>
          <button className="btn-secondary" onClick={() => navigate('/clientes-web/presupuestos')}>
            Volver a Presupuestos
          </button>
        </div>
      </div>
    )
  }

  const { presupuesto, items } = presupuestoDetalle
  const puedeConvertir = presupuesto.estado === 'enviado' || presupuesto.estado === 'aceptado'
  const puedeCambiarEstado = presupuesto.estado === 'enviado'

  return (
    <div className="presupuesto-cliente-detalle-admin-page">
      <header className="presupuesto-detalle-admin-header">
        <div className="presupuesto-detalle-header-content">
          <div>
            <h1>Presupuesto {presupuesto.numero_presupuesto}</h1>
            <span 
              className="status-badge-large"
              style={{ backgroundColor: getEstadoColor(presupuesto.estado) }}
            >
              {getEstadoLabel(presupuesto.estado)}
            </span>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/clientes-web/presupuestos')}
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="presupuesto-detalle-admin-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Información del cliente */}
        <section className="info-section">
          <h2>Información del Cliente</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Nombre:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {presupuesto.cliente?.nombre || '-'} {presupuesto.cliente?.apellido || ''}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Empresa:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {presupuesto.cliente?.empresa || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {presupuesto.cliente?.email || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Teléfono:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {presupuesto.cliente?.telefono || '-'}
              </span>
            </div>
          </div>
        </section>

        {/* Información del presupuesto */}
        <section className="info-section">
          <h2>Información del Presupuesto</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Fecha de creación:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {new Date(presupuesto.fecha_creacion).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            {presupuesto.fecha_envio && (
              <div className="info-item">
                <span className="info-label">Fecha de envío:</span>
                <span className="info-value" style={{ color: '#111827' }}>
                  {new Date(presupuesto.fecha_envio).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            {presupuesto.fecha_vencimiento && (
              <div className="info-item">
                <span className="info-label">Válido hasta:</span>
                <span className="info-value" style={{ color: '#111827' }}>
                  {new Date(presupuesto.fecha_vencimiento).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
            {presupuesto.id_pedido_asociado && (
              <div className="info-item">
                <span className="info-label">Pedido asociado:</span>
                <span className="info-value">
                  <a 
                    href={`/clientes-web/pedidos/${presupuesto.id_pedido_asociado}`}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(`/cliente/pedido/${presupuesto.id_pedido_asociado}`)
                    }}
                    className="link-pedido"
                  >
                    #{presupuesto.id_pedido_asociado}
                  </a>
                </span>
              </div>
            )}
          </div>

          {presupuesto.observaciones_cliente && (
            <div className="observaciones-box">
              <h3>Observaciones del Cliente:</h3>
              <p>{presupuesto.observaciones_cliente}</p>
            </div>
          )}

          {presupuesto.observaciones_internas && (
            <div className="observaciones-box observaciones-internas">
              <h3>Observaciones Internas:</h3>
              <p>{presupuesto.observaciones_internas}</p>
            </div>
          )}
        </section>

        {/* Items del presupuesto */}
        <section className="info-section">
          <h2>Artículos</h2>
          <div className="items-table-container">
            <table className="items-table">
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
        <section className="actions-section">
          {puedeCambiarEstado && (
            <div className="actions-group">
              <h3>Cambiar Estado:</h3>
              <div className="actions-buttons">
                <button
                  className="btn-accept"
                  onClick={() => handleCambiarEstado('aceptado')}
                >
                  ✓ Aceptar Presupuesto
                </button>
                <button
                  className="btn-reject"
                  onClick={() => handleCambiarEstado('rechazado')}
                >
                  ✕ Rechazar Presupuesto
                </button>
              </div>
            </div>
          )}

          {puedeConvertir && (
            <div className="actions-group">
              <h3>Convertir a Pedido:</h3>
              <div className="convert-form">
                <textarea
                  className="observaciones-input"
                  placeholder="Observaciones internas (opcional)..."
                  value={observacionesInternas}
                  onChange={(e) => setObservacionesInternas(e.target.value)}
                  rows={3}
                />
                <button
                  className="btn-convert"
                  onClick={handleConvertirAPedido}
                  disabled={convirtiendo}
                >
                  {convirtiendo ? 'Convirtiendo...' : '🔄 Convertir a Pedido'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

