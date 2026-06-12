import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, MessageCircle, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import {
  CLIENTE_MENSAJES_REFRESH_EVENT,
  useClienteMensajesBadge
} from '../hooks/useClienteMensajesBadge'
import apiService from '../services/api'
import type { MensajePedidoClienteRecord, PedidoClienteRecord } from '../types/api'
import {
  buildMensajesThread,
  formatMessageTime,
  formatRelativeTime,
  PEDIDO_ESTADO_LABELS
} from '../utils/clienteMensajesThread'
import {
  pedidoMensajePiiErrorMessage,
  validatePedidoMensajeSinPii
} from '../utils/pedidoMensajePiiFilter'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClienteMensajesPage.css'

function dispatchMensajesBadgeRefresh() {
  window.dispatchEvent(new Event(CLIENTE_MENSAJES_REFRESH_EVENT))
}

export default function ClienteMensajesPage() {
  const { idPedido } = useParams<{ idPedido?: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const { noLeidos: totalNoLeidos } = useClienteMensajesBadge()
  const navigate = useNavigate()

  const [pedidos, setPedidos] = useState<PedidoClienteRecord[]>([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<number | null>(
    idPedido ? parseInt(idPedido, 10) : null
  )
  const [mensajes, setMensajes] = useState<MensajePedidoClienteRecord[]>([])
  const [noLeidosPorPedido, setNoLeidosPorPedido] = useState<Record<number, number>>({})
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [showScrollFab, setShowScrollFab] = useState(false)

  const mensajesListRef = useRef<HTMLDivElement>(null)
  const stickBottomRef = useRef(true)
  const mensajesCountRef = useRef(0)

  const pedidoActivo = useMemo(
    () => pedidos.find((p) => p.id === pedidoSeleccionado) ?? null,
    [pedidos, pedidoSeleccionado]
  )

  const threadItems = useMemo(() => buildMensajesThread(mensajes), [mensajes])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    void loadPedidos()
  }, [cliente, authLoading, navigate])

  useEffect(() => {
    if (idPedido) {
      const id = parseInt(idPedido, 10)
      if (!Number.isNaN(id)) setPedidoSeleccionado(id)
    }
  }, [idPedido])

  useEffect(() => {
    if (!cliente?.id) return
    void loadNoLeidosPorPedido()
  }, [cliente?.id, totalNoLeidos])

  useEffect(() => {
    if (!pedidoSeleccionado || !cliente) return
    stickBottomRef.current = true
    void loadMensajes(true)
    const interval = window.setInterval(() => void loadMensajes(false), 8000)
    return () => window.clearInterval(interval)
  }, [pedidoSeleccionado, cliente?.id])

  useEffect(() => {
    const prevCount = mensajesCountRef.current
    const hasNew = mensajes.length > prevCount
    mensajesCountRef.current = mensajes.length

    if (hasNew && mensajes.length > 0 && stickBottomRef.current) {
      scrollThreadToBottom('smooth')
    }
  }, [mensajes])

  const loadPedidos = async () => {
    if (!cliente) return
    setLoading(true)
    try {
      const response = await apiService.getPedidosCliente(cliente.id)
      if (response.success && response.data) {
        setPedidos(response.data)
        if (idPedido) {
          const id = parseInt(idPedido, 10)
          if (!Number.isNaN(id)) setPedidoSeleccionado(id)
        }
      } else {
        setError(response.error || 'Error al cargar pedidos')
      }
    } catch {
      setError('Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }

  const loadNoLeidosPorPedido = async () => {
    if (!cliente) return
    const res = await apiService.listarMensajesPedidoNoLeidosCliente(cliente.id)
    if (res.success && res.data) {
      const map: Record<number, number> = {}
      for (const row of res.data) {
        map[row.id_pedido] = row.cantidad
      }
      setNoLeidosPorPedido(map)
    }
  }

  const scrollThreadToBottom = (behavior: ScrollBehavior = 'auto') => {
    const list = mensajesListRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior })
  }

  const handleThreadScroll = () => {
    const list = mensajesListRef.current
    if (!list) return
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight
    const nearBottom = distanceFromBottom < 56
    stickBottomRef.current = nearBottom
    setShowScrollFab(!nearBottom && mensajes.length > 0)
  }

  const loadMensajes = async (markRead: boolean) => {
    if (!cliente || !pedidoSeleccionado) return
    if (markRead) setCargandoMensajes(true)
    try {
      const response = await apiService.obtenerMensajesPedido(pedidoSeleccionado, cliente.id)
      if (response.success && response.data) {
        setMensajes(response.data)
        setError('')
        if (markRead) {
          await apiService.marcarMensajesPedidoLeidosCliente(pedidoSeleccionado, cliente.id)
          setNoLeidosPorPedido((prev) => {
            const next = { ...prev }
            delete next[pedidoSeleccionado]
            return next
          })
          dispatchMensajesBadgeRefresh()
        }
      } else {
        setError(response.error || 'No se pudieron cargar los mensajes')
      }
    } catch {
      setError('Error al cargar mensajes')
    } finally {
      setCargandoMensajes(false)
    }
  }

  const seleccionarPedido = (id: number) => {
    setPedidoSeleccionado(id)
    setMensajes([])
    setError('')
    stickBottomRef.current = true
    navigate(`/cliente/mensajes/${id}`, { replace: true })
  }

  const enviarMensaje = async () => {
    if (!cliente || !pedidoSeleccionado || !nuevoMensaje.trim()) return

    const pii = validatePedidoMensajeSinPii(nuevoMensaje)
    if (!pii.ok) {
      setError(pedidoMensajePiiErrorMessage(pii))
      return
    }

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
        stickBottomRef.current = true
        await loadMensajes(false)
        requestAnimationFrame(() => scrollThreadToBottom('smooth'))
      } else {
        setError(response.error || 'Error al enviar mensaje')
      }
    } catch {
      setError('Error al enviar mensaje')
    } finally {
      setEnviando(false)
    }
  }

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void enviarMensaje()
    }
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  return (
    <ClientePageLayout className="cliente-mensajes-page">
      <ClientePageHeader
        eyebrow="Comunicación"
        title="Mensajes"
        subtitle="Chateá con el equipo u operario asignado. No compartas teléfono, email ni datos de contacto."
      />

      <div className="cliente-mensajes-intro cliente-card">
        <span className="cliente-mensajes-intro__icon" aria-hidden>
          <MessageCircle size={22} strokeWidth={2} />
        </span>
        <div>
          <p className="cliente-mensajes-intro__title">¿Cómo funciona?</p>
          <ol className="cliente-mensajes-intro__steps">
            <li>Elegí un pedido de la lista.</li>
            <li>Escribí tu consulta; el equipo te responde en el mismo hilo.</li>
            <li>
              {totalNoLeidos > 0
                ? `Tenés ${totalNoLeidos} mensaje${totalNoLeidos === 1 ? '' : 's'} sin leer del equipo.`
                : 'No tenés mensajes nuevos del equipo.'}
            </li>
          </ol>
        </div>
      </div>

      <div className="cliente-mensajes-shell">
        <aside className="cliente-mensajes-sidebar cliente-card" aria-label="Pedidos con conversación">
          <div className="cliente-mensajes-sidebar__head">
            <h2 className="cliente-mensajes-sidebar__title">Tus pedidos</h2>
            <span className="cliente-mensajes-sidebar__count">{pedidos.length}</span>
          </div>

          {pedidos.length === 0 ? (
            <p className="cliente-mensajes-sidebar__empty">Todavía no tenés pedidos para chatear.</p>
          ) : (
            <ul className="cliente-mensajes-pedidos-list" role="list">
              {pedidos.map((pedido) => {
                const activo = pedidoSeleccionado === pedido.id
                const noLeidos = noLeidosPorPedido[pedido.id] ?? 0
                const estadoLabel = PEDIDO_ESTADO_LABELS[pedido.estado] ?? pedido.estado

                return (
                  <li key={pedido.id}>
                    <button
                      type="button"
                      className={`cliente-mensajes-pedido-btn${activo ? ' is-active' : ''}`}
                      onClick={() => seleccionarPedido(pedido.id)}
                      aria-current={activo ? 'true' : undefined}
                    >
                      <span className="cliente-mensajes-pedido-btn__row">
                        <span className="cliente-mensajes-pedido-btn__num">{pedido.numero_pedido}</span>
                        {noLeidos > 0 && (
                          <span className="cliente-mensajes-pedido-btn__badge" aria-label={`${noLeidos} sin leer`}>
                            {noLeidos > 9 ? '9+' : noLeidos}
                          </span>
                        )}
                      </span>
                      <span className={`cliente-mensajes-pedido-btn__estado estado-${pedido.estado}`}>
                        {estadoLabel}
                      </span>
                      <span className="cliente-mensajes-pedido-btn__fecha">
                        {new Date(pedido.fecha_pedido).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className="cliente-mensajes-chat cliente-card" aria-label="Conversación del pedido">
          {!pedidoSeleccionado ? (
            <div className="cliente-mensajes-chat__placeholder">
              <MessageCircle size={40} strokeWidth={1.5} aria-hidden />
              <p>Seleccioná un pedido para ver la conversación</p>
            </div>
          ) : (
            <>
              <header className="cliente-mensajes-chat__header">
                <div>
                  <p className="cliente-mensajes-chat__eyebrow">Pedido</p>
                  <h2 className="cliente-mensajes-chat__title">{pedidoActivo?.numero_pedido ?? '…'}</h2>
                </div>
                {pedidoActivo && (
                  <span className={`cliente-mensajes-chat__estado estado-${pedidoActivo.estado}`}>
                    {PEDIDO_ESTADO_LABELS[pedidoActivo.estado] ?? pedidoActivo.estado}
                  </span>
                )}
              </header>

              <div
                ref={mensajesListRef}
                className="cliente-mensajes-thread"
                onScroll={handleThreadScroll}
                aria-live="polite"
                aria-busy={cargandoMensajes}
              >
                {cargandoMensajes && mensajes.length === 0 ? (
                  <p className="cliente-mensajes-thread__loading">Cargando mensajes…</p>
                ) : mensajes.length === 0 ? (
                  <div className="cliente-mensajes-thread__empty">
                    <p>Todavía no hay mensajes en este pedido.</p>
                    <p className="cliente-mensajes-thread__empty-hint">
                      Contanos qué necesitás y el equipo te responde acá.
                    </p>
                  </div>
                ) : (
                  threadItems.map((item) => {
                    if (item.type === 'day') {
                      return (
                        <div key={item.key} className="cliente-mensajes-day" role="separator">
                          <span>{item.label}</span>
                        </div>
                      )
                    }

                    const mensaje = item.message
                    const esCliente = mensaje.es_del_cliente
                    const autor = esCliente ? 'Vos' : mensaje.nombre_usuario || 'Equipo Plot'

                    return (
                      <article
                        key={item.key}
                        className={`cliente-mensajes-bubble${esCliente ? ' is-mine' : ' is-theirs'}${
                          !esCliente && !mensaje.leido ? ' is-unread' : ''
                        }`}
                      >
                        <header className="cliente-mensajes-bubble__meta">
                          <span className="cliente-mensajes-bubble__autor">{autor}</span>
                          <time
                            className="cliente-mensajes-bubble__time"
                            dateTime={mensaje.fecha_creacion}
                            title={formatMessageTime(mensaje.fecha_creacion)}
                          >
                            {formatRelativeTime(mensaje.fecha_creacion)}
                          </time>
                        </header>
                        <p className="cliente-mensajes-bubble__text">{mensaje.mensaje}</p>
                      </article>
                    )
                  })
                )}
              </div>

              {showScrollFab && (
                <button
                  type="button"
                  className="cliente-mensajes-scroll-fab"
                  onClick={() => {
                    stickBottomRef.current = true
                    scrollThreadToBottom('smooth')
                  }}
                  aria-label="Ir al último mensaje"
                >
                  <ArrowDown size={18} strokeWidth={2.25} aria-hidden />
                </button>
              )}

              <footer className="cliente-mensajes-composer">
                {error && (
                  <p className="cliente-mensajes-composer__error" role="alert">
                    {error}
                  </p>
                )}
                <div className="cliente-mensajes-composer__row">
                  <textarea
                    className="cliente-mensajes-composer__input"
                    placeholder="Escribí tu mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={2}
                    disabled={enviando}
                    aria-label="Mensaje para el equipo"
                  />
                  <button
                    type="button"
                    className="cliente-btn-primary cliente-mensajes-composer__send"
                    onClick={() => void enviarMensaje()}
                    disabled={!nuevoMensaje.trim() || enviando}
                  >
                    <Send size={18} strokeWidth={2.25} aria-hidden />
                    <span>{enviando ? 'Enviando…' : 'Enviar'}</span>
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </ClientePageLayout>
  )
}
