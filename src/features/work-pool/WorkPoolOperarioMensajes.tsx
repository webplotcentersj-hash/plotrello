import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import type { MensajePedidoClienteRecord } from '../../types/api'
import type { WorkPoolPedidoChat, WorkPoolProduct } from '../../types/workPool'
import {
  buildMensajesThread,
  formatMessageTime,
  formatRelativeTime
} from '../../utils/clienteMensajesThread'
import {
  pedidoMensajePiiErrorMessage,
  validatePedidoMensajeSinPii
} from '../../utils/pedidoMensajePiiFilter'
import {
  contarMensajesOperarioNoLeidos,
  crearMensajePedidoOperario,
  listarPedidosChatOperario,
  marcarMensajesPedidoLeidosOperario,
  obtenerMensajesPedidoOperario
} from './workPoolRepository'

type Props = {
  idUsuario: number
  product: WorkPoolProduct
  pedidoInicial?: number | null
  onUnreadChange?: (count: number) => void
}

export default function WorkPoolOperarioMensajes({
  idUsuario,
  product,
  pedidoInicial,
  onUnreadChange
}: Props) {
  const [pedidos, setPedidos] = useState<WorkPoolPedidoChat[]>([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<number | null>(pedidoInicial ?? null)
  const [mensajes, setMensajes] = useState<MensajePedidoClienteRecord[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const mensajesListRef = useRef<HTMLDivElement>(null)
  const stickBottomRef = useRef(true)

  const pedidoActivo = useMemo(
    () => pedidos.find((p) => p.id_pedido === pedidoSeleccionado) ?? null,
    [pedidos, pedidoSeleccionado]
  )

  const threadItems = useMemo(() => buildMensajesThread(mensajes), [mensajes])

  const scrollThreadToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = mensajesListRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  const refreshUnread = useCallback(async () => {
    const res = await contarMensajesOperarioNoLeidos(idUsuario, product)
    if (res.success && res.data != null) onUnreadChange?.(res.data)
  }, [idUsuario, product, onUnreadChange])

  const loadPedidos = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await listarPedidosChatOperario(idUsuario, product)
    if (!res.success) {
      setError(res.error || 'No se pudieron cargar los pedidos')
      setPedidos([])
    } else {
      const list = res.data ?? []
      setPedidos(list)
      setPedidoSeleccionado((current) => {
        if (pedidoInicial && list.some((p) => p.id_pedido === pedidoInicial)) return pedidoInicial
        if (current && list.some((p) => p.id_pedido === current)) return current
        if (list.length === 1) return list[0].id_pedido
        return current
      })
    }
    await refreshUnread()
    setLoading(false)
  }, [idUsuario, product, pedidoInicial, refreshUnread])

  const loadMensajes = useCallback(
    async (markRead: boolean) => {
      if (!pedidoSeleccionado) return
      setCargandoMensajes(true)
      const res = await obtenerMensajesPedidoOperario(pedidoSeleccionado, idUsuario, product)
      if (res.success) {
        setMensajes(res.data ?? [])
        setError('')
        if (markRead) {
          await marcarMensajesPedidoLeidosOperario(pedidoSeleccionado, idUsuario, product)
          setPedidos((prev) =>
            prev.map((p) =>
              p.id_pedido === pedidoSeleccionado ? { ...p, mensajes_no_leidos: 0 } : p
            )
          )
          await refreshUnread()
        }
        if (stickBottomRef.current) {
          requestAnimationFrame(() => scrollThreadToBottom())
        }
      } else {
        setError(res.error || 'No se pudieron cargar los mensajes')
      }
      setCargandoMensajes(false)
    },
    [pedidoSeleccionado, idUsuario, product, refreshUnread]
  )

  useEffect(() => {
    void loadPedidos()
  }, [loadPedidos])

  useEffect(() => {
    if (pedidoInicial) setPedidoSeleccionado(pedidoInicial)
  }, [pedidoInicial])

  useEffect(() => {
    if (!pedidoSeleccionado) return
    stickBottomRef.current = true
    void loadMensajes(true)
  }, [pedidoSeleccionado, loadMensajes])

  const enviarMensaje = async () => {
    if (!pedidoSeleccionado || !nuevoMensaje.trim()) return

    const pii = validatePedidoMensajeSinPii(nuevoMensaje)
    if (!pii.ok) {
      setError(pedidoMensajePiiErrorMessage(pii))
      return
    }

    setEnviando(true)
    setError('')
    const res = await crearMensajePedidoOperario(pedidoSeleccionado, idUsuario, nuevoMensaje.trim(), product)
    if (res.success) {
      setNuevoMensaje('')
      stickBottomRef.current = true
      await loadMensajes(false)
      requestAnimationFrame(() => scrollThreadToBottom('smooth'))
    } else {
      setError(res.error || 'Error al enviar mensaje')
    }
    setEnviando(false)
  }

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void enviarMensaje()
    }
  }

  if (loading) {
    return <p className="work-pool-module__empty">Cargando mensajes…</p>
  }

  if (pedidos.length === 0) {
    return (
      <div className="work-pool-module__alert work-pool-module__alert--info">
        Cuando te asignen un trabajo vinculado a un pedido del portal, vas a poder chatear con el
        cliente acá. No compartas teléfono, email ni datos de contacto: el sistema los bloquea.
      </div>
    )
  }

  return (
    <div className="work-pool-mensajes">
      <div className="work-pool-mensajes__alert work-pool-module__alert work-pool-module__alert--info">
        Chateá con el cliente por pedido. No envíes teléfono, email, WhatsApp, CBU ni direcciones: el
        mensaje se rechaza automáticamente.
      </div>

      <div className="work-pool-mensajes__shell">
        <aside className="work-pool-mensajes__sidebar" aria-label="Pedidos con chat">
          <h3 className="work-pool-mensajes__sidebar-title">Pedidos</h3>
          <ul className="work-pool-mensajes__pedidos" role="list">
            {pedidos.map((pedido) => {
              const activo = pedidoSeleccionado === pedido.id_pedido
              return (
                <li key={pedido.id_pedido}>
                  <button
                    type="button"
                    className={`work-pool-mensajes__pedido-btn${activo ? ' is-active' : ''}`}
                    onClick={() => {
                      setPedidoSeleccionado(pedido.id_pedido)
                      setMensajes([])
                      setError('')
                    }}
                  >
                    <span className="work-pool-mensajes__pedido-num">{pedido.numero_pedido}</span>
                    <span className="work-pool-mensajes__pedido-titulo">{pedido.titulo_trabajo}</span>
                    {pedido.mensajes_no_leidos > 0 && (
                      <span className="work-pool-mensajes__badge">{pedido.mensajes_no_leidos}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="work-pool-mensajes__chat" aria-label="Conversación">
          {!pedidoSeleccionado ? (
            <div className="work-pool-mensajes__placeholder">
              <MessageCircle size={36} strokeWidth={1.5} aria-hidden />
              <p>Seleccioná un pedido para ver la conversación</p>
            </div>
          ) : (
            <>
              <header className="work-pool-mensajes__chat-head">
                <div>
                  <p className="work-pool-mensajes__chat-eyebrow">Pedido portal</p>
                  <h3>{pedidoActivo?.numero_pedido ?? '…'}</h3>
                </div>
                <span className="work-pool-mensajes__chat-sub">{pedidoActivo?.titulo_trabajo}</span>
              </header>

              <div
                ref={mensajesListRef}
                className="work-pool-mensajes__thread"
                aria-live="polite"
                aria-busy={cargandoMensajes}
              >
                {cargandoMensajes && mensajes.length === 0 ? (
                  <p className="work-pool-module__empty">Cargando…</p>
                ) : mensajes.length === 0 ? (
                  <p className="work-pool-module__empty">Todavía no hay mensajes en este pedido.</p>
                ) : (
                  threadItems.map((item) => {
                    if (item.type === 'day') {
                      return (
                        <div key={item.key} className="work-pool-mensajes__day">
                          <span>{item.label}</span>
                        </div>
                      )
                    }

                    const mensaje = item.message
                    const esCliente = mensaje.es_del_cliente
                    const autor = esCliente ? 'Cliente' : mensaje.nombre_usuario || 'Vos'

                    return (
                      <article
                        key={item.key}
                        className={`work-pool-mensajes__bubble${esCliente ? ' is-theirs' : ' is-mine'}`}
                      >
                        <header className="work-pool-mensajes__bubble-meta">
                          <span>{autor}</span>
                          <time dateTime={mensaje.fecha_creacion} title={formatMessageTime(mensaje.fecha_creacion)}>
                            {formatRelativeTime(mensaje.fecha_creacion)}
                          </time>
                        </header>
                        <p>{mensaje.mensaje}</p>
                      </article>
                    )
                  })
                )}
              </div>

              <footer className="work-pool-mensajes__composer">
                {error && (
                  <p className="work-pool-mensajes__error" role="alert">
                    {error}
                  </p>
                )}
                <div className="work-pool-mensajes__composer-row">
                  <textarea
                    placeholder="Escribí al cliente… (Enter envía)"
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={2}
                    disabled={enviando}
                    aria-label="Mensaje al cliente"
                  />
                  <button
                    type="button"
                    className="work-pool-module__btn work-pool-module__btn--primary"
                    onClick={() => void enviarMensaje()}
                    disabled={!nuevoMensaje.trim() || enviando}
                  >
                    <Send size={16} aria-hidden />
                    {enviando ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
