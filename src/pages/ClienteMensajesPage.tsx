import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import type { MensajePedidoClienteRecord, PedidoClienteRecord } from '../types/api'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClienteMensajesPage.css'

export default function ClienteMensajesPage() {
  const { idPedido } = useParams<{ idPedido?: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<PedidoClienteRecord[]>([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<number | null>(
    idPedido ? parseInt(idPedido) : null
  )
  const [mensajes, setMensajes] = useState<MensajePedidoClienteRecord[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadPedidos()
  }, [cliente, authLoading, navigate])

  useEffect(() => {
    if (pedidoSeleccionado) {
      loadMensajes()
      const interval = setInterval(loadMensajes, 5000) // Actualizar cada 5 segundos
      return () => clearInterval(interval)
    }
  }, [pedidoSeleccionado, cliente])

  useEffect(() => {
    scrollToBottom()
  }, [mensajes])

  const loadPedidos = async () => {
    if (!cliente) return
    setLoading(true)
    try {
      const response = await apiService.getPedidosCliente(cliente.id)
      if (response.success && response.data) {
        setPedidos(response.data)
        if (idPedido && !pedidoSeleccionado) {
          setPedidoSeleccionado(parseInt(idPedido))
        }
      }
    } catch (err) {
      setError('Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }

  const loadMensajes = async () => {
    if (!cliente || !pedidoSeleccionado) return
    try {
      const response = await apiService.obtenerMensajesPedido(pedidoSeleccionado, cliente.id)
      if (response.success && response.data) {
        setMensajes(response.data)
      }
    } catch (err) {
      console.error('Error al cargar mensajes:', err)
    }
  }

  const enviarMensaje = async () => {
    if (!cliente || !pedidoSeleccionado || !nuevoMensaje.trim()) return

    setEnviando(true)
    setError('')
    try {
      const response = await apiService.crearMensajePedido(
        pedidoSeleccionado,
        cliente.id,
        nuevoMensaje.trim(),
        true
      )
      if (response.success) {
        setNuevoMensaje('')
        loadMensajes()
      } else {
        setError(response.error || 'Error al enviar mensaje')
      }
    } catch (err) {
      setError('Error al enviar mensaje')
    } finally {
      setEnviando(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatDate = (dateStr: string) => {
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
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (authLoading || loading) {
    return (
      <ClientePageLoading />
    )
  }

  return (
    <ClientePageLayout className="cliente-mensajes-page">
      <ClientePageHeader
        eyebrow="Comunicación"
        title="Mensajes"
        subtitle="Escribile al equipo sobre tus pedidos"
      />

      <div className="cliente-mensajes-main">
        <div className="mensajes-container">
          <div className="pedidos-sidebar">
            <h3>Mis Pedidos</h3>
            {pedidos.length === 0 ? (
              <div className="empty-sidebar">
                <p>No tienes pedidos</p>
              </div>
            ) : (
              <div className="pedidos-list">
                {pedidos.map((pedido) => (
                  <div
                    key={pedido.id}
                    className={`pedido-item ${pedidoSeleccionado === pedido.id ? 'active' : ''}`}
                    onClick={() => setPedidoSeleccionado(pedido.id)}
                  >
                    <div className="pedido-item-header">
                      <span className="pedido-numero">{pedido.numero_pedido}</span>
                      <span className={`pedido-estado estado-${pedido.estado}`}>
                        {pedido.estado}
                      </span>
                    </div>
                    <p className="pedido-fecha">
                      {new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mensajes-content">
            {pedidoSeleccionado ? (
              <>
                <div className="mensajes-header">
                  <h2>
                    {pedidos.find(p => p.id === pedidoSeleccionado)?.numero_pedido || 'Pedido'}
                  </h2>
                </div>

                <div className="mensajes-list">
                  {mensajes.length === 0 ? (
                    <div className="empty-messages">
                      <p>No hay mensajes aún. Sé el primero en escribir.</p>
                    </div>
                  ) : (
                    mensajes.map((mensaje) => (
                      <div
                        key={mensaje.id}
                        className={`mensaje-item ${mensaje.es_del_cliente ? 'cliente' : 'empresa'}`}
                      >
                        <div className="mensaje-content">
                          <div className="mensaje-header">
                            <span className="mensaje-autor">
                              {mensaje.es_del_cliente ? 'Tú' : mensaje.nombre_usuario || 'Empresa'}
                            </span>
                            <span className="mensaje-fecha">{formatDate(mensaje.fecha_creacion)}</span>
                          </div>
                          <div className="mensaje-texto">{mensaje.mensaje}</div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mensajes-input">
                  {error && <div className="error-message">{error}</div>}
                  <div className="input-group">
                    <textarea
                      className="mensaje-textarea"
                      placeholder="Escribe tu mensaje..."
                      value={nuevoMensaje}
                      onChange={(e) => setNuevoMensaje(e.target.value)}
                      rows={3}
                      disabled={enviando}
                    />
                    <button
                      className="btn-enviar"
                      onClick={enviarMensaje}
                      disabled={!nuevoMensaje.trim() || enviando}
                    >
                      {enviando ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-pedido-selected">
                <p>Selecciona un pedido para ver los mensajes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ClientePageLayout>
  )
}

