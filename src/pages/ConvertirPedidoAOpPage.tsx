import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoClienteDetalle } from '../types/api'
import {
  etiquetaTipoIntencionPedido,
  puedeConvertirPedidoAOp
} from '../utils/pedidoClienteConversion'
import './ConvertirPedidoAOpPage.css'

export default function ConvertirPedidoAOpPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canAccessMostradorViews, usuario, nombreVisible, loading: authLoading } = useAuth()
  const [detalle, setDetalle] = useState<PedidoClienteDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    sector_inicial: 'Diseño Gráfico',
    observaciones: ''
  })

  // Sectores válidos según el sistema
  const sectoresValidos = [
    'Diseño Gráfico',
    'Diseño en Proceso',
    'En Espera',
    'Imprenta (Área de Impresión)',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Instalaciones',
    'Metalúrgica',
    'Entregas taller de Imprenta',
    'Entregas taller gráfico'
  ]

  useEffect(() => {
    if (authLoading) return
    if (!canAccessMostradorViews) {
      navigate('/')
      return
    }
    if (id) {
      loadDetalle()
    }
  }, [id, canAccessMostradorViews, navigate, authLoading])

  const loadDetalle = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const response = await apiService.getDetallePedidoCliente(parseInt(id))
      if (response.success && response.data) {
        const p = response.data.pedido
        if (!puedeConvertirPedidoAOp(p)) {
          if (p.id_op_asociada) {
            navigate(`/op/${p.id_op_asociada}`, { replace: true })
            return
          }
          setError('Este pedido ya no puede convertirse a OP')
        }
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
        nombre_usuario_convertidor: nombreVisible,
        sector_inicial: formData.sector_inicial,
        observaciones: formData.observaciones || undefined
      })
      
      if (response.success && response.data) {
        const d = response.data
        const partes = [
          `OP: ${d.numero_op}`,
          d.numero_venta ? `Venta: ${d.numero_venta}` : '',
          'Mockup y archivos copiados a la OP',
          'Etiquetas y especificación incluidas',
          d.stock_descontados != null && d.stock_descontados > 0
            ? `Stock: ${d.stock_descontados} artículo(s) descontado(s)`
            : d.stock_errores?.length
              ? `Stock: ${d.stock_errores.join('; ')}`
              : 'Stock: sin cambios (ya aplicado o cotización sin stock)'
        ].filter(Boolean)
        alert(`Pedido convertido.\n\n${partes.join('\n')}`)
        navigate(`/op/${d.id_op}`)
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
            <p className="pedido-info">
              Pedido: {pedido.numero_pedido} · {etiquetaTipoIntencionPedido(pedido.tipo_intencion)}
              {pedido.id_venta_asociada ? ' · Venta ya registrada' : ''}
            </p>
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
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {/* Información importante */}
        <section className="info-section info-warning">
          <h2>ℹ️ ¿Qué hace esta conversión?</h2>
          <ul className="info-list">
            <li>Se creará una nueva <strong>Orden de Trabajo (OP)</strong> en el sistema</li>
            <li>La OP aparecerá en el tablero Kanban en el sector inicial seleccionado</li>
            <li>El pedido quedará marcado como <strong>Convertido</strong> y vinculado a la OP</li>
            <li>Se copiarán <strong>mockup, archivos y especificación</strong> a la OP (enlaces adjuntos)</li>
            <li>Se asignarán <strong>etiquetas</strong> (Pedido Web, número de pedido, urgente, etc.)</li>
            <li>Se registrará la <strong>venta</strong> con los ítems del pedido</li>
            <li>Se <strong>descontará stock</strong> si aún no se había aplicado</li>
            <li>La fecha límite del pedido se transferirá a la OP</li>
          </ul>
        </section>

        {/* Información del pedido */}
        <section className="info-section">
          <h2>📋 Información del Pedido</h2>
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
          <h2>⚙️ Configuración de la OP</h2>
          <div className="form-group">
            <label>Sector Inicial (donde comenzará la OP):</label>
            <select
              value={formData.sector_inicial}
              onChange={(e) => setFormData({ ...formData, sector_inicial: e.target.value })}
              className="form-select"
            >
              {sectoresValidos.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
            <p className="form-help-text">
              Selecciona el sector donde comenzará el trabajo. La OP aparecerá en este sector del tablero Kanban.
            </p>
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

