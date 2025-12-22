import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoClienteDetalle } from '../types/api'
import './ConvertirPedidoAOpPage.css'

export default function ConvertirPedidoAOpPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin, isMostrador, usuario, loading: authLoading } = useAuth()
  const [detalle, setDetalle] = useState<PedidoClienteDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    sector_inicial: 'Diseño Gráfico',
    observaciones: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    if (id) {
      loadDetalle()
    }
  }, [id, isAdmin, isMostrador, navigate, authLoading])

  const loadDetalle = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const response = await apiService.getDetallePedidoCliente(parseInt(id))
      if (response.success && response.data) {
        setDetalle(response.data)
      } else {
        setError(response.error || 'Error al cargar el pedido')
      }
    } catch (err) {
      setError('Error al cargar el pedido')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleConvertir = async () => {
    if (!id || !usuario) return
    
    if (!confirm('¿Estás seguro de convertir este pedido en una OP? Esto creará una nueva orden de trabajo.')) {
      return
    }

    setConvirtiendo(true)
    setError('')
    try {
      const response = await apiService.convertirPedidoAOp({
        id_pedido: parseInt(id),
        id_usuario_convertidor: usuario.id,
        nombre_usuario_convertidor: usuario.nombre || 'Usuario',
        sector_inicial: formData.sector_inicial,
        observaciones: formData.observaciones || undefined
      })
      
      if (response.success && response.data) {
        alert(`Pedido convertido exitosamente. OP creada: ${response.data.numero_op}`)
        navigate(`/clientes-web/pedidos`)
      } else {
        setError(response.error || 'Error al convertir pedido')
      }
    } catch (err) {
      setError('Error al convertir pedido')
      console.error(err)
    } finally {
      setConvirtiendo(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="convertir-pedido-op-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando pedido...</p>
        </div>
      </div>
    )
  }

  if (!detalle) {
    return (
      <div className="convertir-pedido-op-page">
        <div className="error-container">
          <p>{error || 'Pedido no encontrado'}</p>
          <button className="btn-secondary" onClick={() => navigate('/clientes-web/pedidos')}>
            Volver a Pedidos
          </button>
        </div>
      </div>
    )
  }

  const { pedido } = detalle

  return (
    <div className="convertir-pedido-op-page">
      <header className="convertir-pedido-op-header">
        <div className="convertir-pedido-op-header-content">
          <div>
            <h1>Convertir Pedido a OP</h1>
            <p className="pedido-info">Pedido: {pedido.numero_pedido}</p>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/clientes-web/pedidos')}
          >
            ← Cancelar
          </button>
        </div>
      </header>

      <main className="convertir-pedido-op-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Información del pedido */}
        <section className="info-section">
          <h2>Información del Pedido</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Cliente:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {pedido.cliente?.nombre || '-'} {pedido.cliente?.apellido || ''}
                {pedido.cliente?.empresa && ` - ${pedido.cliente.empresa}`}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Total:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                ${pedido.precio_total.toFixed(2)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Artículos:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {detalle.items.length}
              </span>
            </div>
            {pedido.fecha_limite_deseada && (
              <div className="info-item">
                <span className="info-label">Fecha límite:</span>
                <span className="info-value" style={{ color: '#111827' }}>
                  {new Date(pedido.fecha_limite_deseada).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Formulario de conversión */}
        <section className="info-section">
          <h2>Configuración de la OP</h2>
          <div className="form-group">
            <label>Sector Inicial:</label>
            <select
              value={formData.sector_inicial}
              onChange={(e) => setFormData({ ...formData, sector_inicial: e.target.value })}
              className="form-select"
            >
              <option value="Diseño Gráfico">Diseño Gráfico</option>
              <option value="Impresión">Impresión</option>
              <option value="Corte">Corte</option>
              <option value="Terminación">Terminación</option>
              <option value="Instalación">Instalación</option>
            </select>
          </div>
          <div className="form-group">
            <label>Observaciones Adicionales (opcional):</label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              className="form-textarea"
              placeholder="Agregar observaciones adicionales para la OP..."
              rows={4}
            />
          </div>
        </section>

        {/* Resumen de items */}
        <section className="info-section">
          <h2>Artículos del Pedido</h2>
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
                {detalle.items.map((item) => (
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
                  <td colSpan={3} className="total-label">Total:</td>
                  <td className="total-value">${pedido.precio_total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Botones de acción */}
        <div className="form-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate('/clientes-web/pedidos')}
            disabled={convirtiendo}
          >
            Cancelar
          </button>
          <button
            className="btn-convert"
            onClick={handleConvertir}
            disabled={convirtiendo}
          >
            {convirtiendo ? 'Convirtiendo...' : '✓ Convertir a OP'}
          </button>
        </div>
      </main>
    </div>
  )
}

