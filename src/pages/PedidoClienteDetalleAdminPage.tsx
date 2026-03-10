import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoClienteDetalle, MensajePedidoClienteRecord } from '../types/api'
import './PedidoClienteDetalleAdminPage.css'

export default function PedidoClienteDetalleAdminPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin, isMostrador, loading: authLoading } = useAuth()
  const [detalle, setDetalle] = useState<PedidoClienteDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mensajes, setMensajes] = useState<MensajePedidoClienteRecord[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorMensaje, setErrorMensaje] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  const loadMensajes = async () => {
    if (!detalle?.pedido) return
    const { id: pedidoId, id_cliente } = detalle.pedido
    try {
      const response = await apiService.obtenerMensajesPedido(pedidoId, id_cliente)
      if (response.success && response.data) {
        setMensajes(response.data)
      }
    } catch (err) {
      console.error('Error al cargar mensajes:', err)
    }
  }

  useEffect(() => {
    if (detalle?.pedido) {
      loadMensajes()
      const interval = setInterval(loadMensajes, 5000)
      return () => clearInterval(interval)
    }
  }, [detalle?.pedido?.id, detalle?.pedido?.id_cliente])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const enviarMensaje = async () => {
    if (!detalle?.pedido || !nuevoMensaje.trim()) return
    setEnviando(true)
    setErrorMensaje('')
    try {
      const response = await apiService.crearMensajePedido(
        detalle.pedido.id,
        detalle.pedido.id_cliente,
        nuevoMensaje.trim(),
        false
      )
      if (response.success) {
        setNuevoMensaje('')
        loadMensajes()
      } else {
        setErrorMensaje(response.error || 'Error al enviar mensaje')
      }
    } catch (err) {
      setErrorMensaje('Error al enviar mensaje')
    } finally {
      setEnviando(false)
    }
  }

  const formatDateMsg = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `Hace ${minutes} min`
    if (hours < 24) return `Hace ${hours} h`
    if (days < 7) return `Hace ${days} días`
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      pendiente: '#f59e0b',
      en_revision: '#3b82f6',
      aprobado: '#10b981',
      rechazado: '#ef4444',
      convertido_completo: '#6366f1',
      convertido_parcial: '#8b5cf6',
      cancelado: '#9ca3af'
    }
    return colors[estado] || '#6b7280'
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      en_revision: 'En Revisión',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
      convertido_completo: 'Convertido Completo',
      convertido_parcial: 'Convertido Parcial',
      cancelado: 'Cancelado'
    }
    return labels[estado] || estado
  }

  if (authLoading || loading) {
    return (
      <div className="pedido-cliente-detalle-admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando pedido...</p>
        </div>
      </div>
    )
  }

  if (!detalle) {
    return (
      <div className="pedido-cliente-detalle-admin-page">
        <div className="error-container">
          <p>{error || 'Pedido no encontrado'}</p>
          <button className="btn-secondary" onClick={() => navigate('/clientes-web/pedidos')}>
            Volver a Pedidos
          </button>
        </div>
      </div>
    )
  }

  const { pedido, items, archivos } = detalle

  return (
    <div className="pedido-cliente-detalle-admin-page">
      <header className="pedido-detalle-admin-header">
        <div className="pedido-detalle-header-content">
          <div>
            <h1>Pedido {pedido.numero_pedido}</h1>
            <span 
              className="status-badge-large"
              style={{ backgroundColor: getEstadoColor(pedido.estado) }}
            >
              {getEstadoLabel(pedido.estado)}
            </span>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/clientes-web/pedidos')}
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="pedido-detalle-admin-main">
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
                {pedido.cliente?.nombre || '-'} {pedido.cliente?.apellido || ''}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Empresa:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {pedido.cliente?.empresa || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {pedido.cliente?.email || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Teléfono:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {pedido.cliente?.telefono || '-'}
              </span>
            </div>
          </div>
        </section>

        {/* Información del pedido */}
        <section className="info-section">
          <h2>Información del Pedido</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Fecha de pedido:</span>
              <span className="info-value" style={{ color: '#111827' }}>
                {new Date(pedido.fecha_pedido).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            {pedido.fecha_limite_deseada && (
              <div className="info-item">
                <span className="info-label">Fecha límite deseada:</span>
                <span className="info-value" style={{ color: '#111827' }}>
                  {new Date(pedido.fecha_limite_deseada).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
            {pedido.id_op_asociada && (
              <div className="info-item">
                <span className="info-label">OP Asociada:</span>
                <span className="info-value">
                  <a 
                    href={`/op/${pedido.id_op_asociada}`}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(`/op/${pedido.id_op_asociada}`)
                    }}
                    className="link-pedido"
                  >
                    OP #{pedido.id_op_asociada}
                  </a>
                </span>
              </div>
            )}
            {pedido.es_urgente && (
              <div className="info-item">
                <span className="info-label">Urgente:</span>
                <span className="info-value" style={{ color: '#111827' }}>
                  Sí
                </span>
              </div>
            )}
            {pedido.requiere_delivery && (
              <div className="info-item">
                <span className="info-label">Requiere Delivery:</span>
                <span className="info-value" style={{ color: '#111827' }}>
                  {pedido.direccion_delivery || 'Sí'}
                </span>
              </div>
            )}
          </div>

          {pedido.observaciones_cliente && (
            <div className="observaciones-box">
              <h3>Observaciones del Cliente:</h3>
              <p>{pedido.observaciones_cliente}</p>
            </div>
          )}

          {pedido.observaciones_internas && (
            <div className="observaciones-box observaciones-internas">
              <h3>Observaciones Internas:</h3>
              <p>{pedido.observaciones_internas}</p>
            </div>
          )}
        </section>

        {/* Items del pedido */}
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
                  <td colSpan={3} className="total-label">Total:</td>
                  <td className="total-value">${pedido.precio_total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Información del Brief */}
        {(pedido.brief_publico || pedido.objetivo_proyecto || pedido.estilo_diseno || pedido.referencias) && (
          <section className="info-section">
            <h2>Información del Brief</h2>
            {pedido.brief_publico && (
              <div className="info-section">
                <h3>Brief Público:</h3>
                <p>{pedido.brief_publico}</p>
              </div>
            )}
            {pedido.objetivo_proyecto && (
              <div className="info-section">
                <h3>Objetivo del Proyecto:</h3>
                <p>{pedido.objetivo_proyecto}</p>
              </div>
            )}
            {pedido.estilo_diseno && (
              <div className="info-section">
                <h3>Estilo de Diseño:</h3>
                <p>{pedido.estilo_diseno}</p>
              </div>
            )}
            {pedido.referencias && (
              <div className="info-section">
                <h3>Referencias:</h3>
                <p>{pedido.referencias}</p>
              </div>
            )}
            {pedido.referencias_links && (
              <div className="info-section">
                <h3>Links de Referencias:</h3>
                <div className="links-list">
                  {pedido.referencias_links.split('\n').map((link, idx) => (
                    <a key={idx} href={link.trim()} target="_blank" rel="noopener noreferrer" className="link-item">
                      {link.trim()}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Archivos Adjuntos */}
        {archivos.length > 0 && (
          <section className="info-section">
            <h2>Archivos Adjuntos</h2>
            <div className="archivos-grid">
              {archivos.map((archivo) => (
                <a
                  key={archivo.id}
                  href={archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="archivo-card"
                >
                  <div className="archivo-icon">📎</div>
                  <div className="archivo-info">
                    <div className="archivo-nombre">{archivo.nombre_archivo}</div>
                    <div className="archivo-tamaño">
                      {archivo.tamaño ? `${(archivo.tamaño / 1024).toFixed(2)} KB` : ''}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Mensajes con el cliente */}
        <section className="info-section mensajes-section">
          <h2>💬 Mensajes con el Cliente</h2>
          <div className="mensajes-admin-container">
            <div className="mensajes-admin-list">
              {mensajes.length === 0 ? (
                <div className="mensajes-admin-empty">
                  <p>No hay mensajes aún. El cliente puede escribir desde su portal.</p>
                </div>
              ) : (
                mensajes.map((mensaje) => (
                  <div
                    key={mensaje.id}
                    className={`mensaje-admin-item ${mensaje.es_del_cliente ? 'cliente' : 'staff'}`}
                  >
                    <div className="mensaje-admin-header">
                      <span className="mensaje-admin-autor">
                        {mensaje.es_del_cliente
                          ? `${pedido.cliente?.nombre || 'Cliente'} ${pedido.cliente?.apellido || ''}`.trim()
                          : mensaje.nombre_usuario || 'Equipo'}
                      </span>
                      <span className="mensaje-admin-fecha">{formatDateMsg(mensaje.fecha_creacion)}</span>
                    </div>
                    <div className="mensaje-admin-texto">{mensaje.mensaje}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="mensajes-admin-input">
              {errorMensaje && <div className="mensaje-error">{errorMensaje}</div>}
              <div className="mensajes-admin-input-group">
                <textarea
                  className="mensajes-admin-textarea"
                  placeholder="Escribir respuesta al cliente..."
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  rows={3}
                  disabled={enviando}
                />
                <button
                  className="mensajes-admin-btn-enviar"
                  onClick={enviarMensaje}
                  disabled={!nuevoMensaje.trim() || enviando}
                >
                  {enviando ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

