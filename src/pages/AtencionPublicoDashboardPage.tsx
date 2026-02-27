import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import './AtencionPublicoDashboardPage.css'

type SolicitudChat = {
  id: number
  cliente_nombre: string | null
  sector_solicitado: string
  rol_solicitado: string | null
  mensaje_cliente: string | null
  estado: string
  historial_mensajes: Array<{ role: string; text: string }>
  respuestas_staff: Array<{ autor: string; texto: string; created_at?: string }>
  created_at: string
}

type Conversacion = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  canal: string
  ultimo_mensaje_preview: string | null
  estado: string
  usuario_asignado_id: number | null
  created_at: string
  updated_at: string
}

type ConversacionDetalle = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  canal: string
  ultimo_mensaje_preview: string | null
  estado: string
  historial_mensajes: Array<{ role: string; text: string }>
  created_at: string
  updated_at: string
}

type Reclamo = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  descripcion: string
  estado: string
  prioridad: string
  notas_internas: string | null
  usuario_asignado_id: number | null
  created_at: string
  updated_at: string
}

const AtencionPublicoDashboardPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { canAccessAtencionPublico, usuario } = useAuth()
  const [activeTab, setActiveTab] = useState<'mensajes' | 'reclamos'>('mensajes')
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [reclamos, setReclamos] = useState<Reclamo[]>([])
  const [loadingConv, setLoadingConv] = useState(false)
  const [loadingReclamos, setLoadingReclamos] = useState(false)
  const [solicitudChat, setSolicitudChat] = useState<SolicitudChat | null>(null)
  const [loadingSolicitud, setLoadingSolicitud] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [conversacionDetalle, setConversacionDetalle] = useState<ConversacionDetalle | null>(null)
  const [loadingConversacion, setLoadingConversacion] = useState(false)

  const loadConversaciones = async () => {
    setLoadingConv(true)
    try {
      const res = await apiService.listConversacionesAtencion()
      if (res.success && res.data) setConversaciones(res.data)
      else setConversaciones([])
    } catch {
      setConversaciones([])
    } finally {
      setLoadingConv(false)
    }
  }

  const loadReclamos = async () => {
    setLoadingReclamos(true)
    try {
      const res = await apiService.listReclamosAtencion()
      if (res.success && res.data) setReclamos(res.data)
      else setReclamos([])
    } catch {
      setReclamos([])
    } finally {
      setLoadingReclamos(false)
    }
  }

  const solicitudChatId = searchParams.get('solicitud_chat')
  const conversacionId = searchParams.get('conversacion')

  const loadConversacionDetalle = async (id: number) => {
    setLoadingConversacion(true)
    try {
      const res = await apiService.getConversacionAtencion(id)
      if (res.success && res.data) setConversacionDetalle(res.data)
      else setConversacionDetalle(null)
    } catch {
      setConversacionDetalle(null)
    } finally {
      setLoadingConversacion(false)
    }
  }

  const loadSolicitudChat = async (id: number) => {
    setLoadingSolicitud(true)
    try {
      const res = await apiService.getSolicitudAtencionChat(id)
      if (res.success && res.data) setSolicitudChat(res.data)
      else setSolicitudChat(null)
    } catch {
      setSolicitudChat(null)
    } finally {
      setLoadingSolicitud(false)
    }
  }

  useEffect(() => {
    if (canAccessAtencionPublico) {
      loadConversaciones()
      loadReclamos()
    }
  }, [canAccessAtencionPublico])

  useEffect(() => {
    if (canAccessAtencionPublico && solicitudChatId) {
      const id = parseInt(solicitudChatId, 10)
      if (!isNaN(id)) loadSolicitudChat(id)
    } else {
      setSolicitudChat(null)
    }
  }, [canAccessAtencionPublico, solicitudChatId])

  useEffect(() => {
    if (canAccessAtencionPublico && conversacionId) {
      const id = parseInt(conversacionId, 10)
      if (!isNaN(id)) loadConversacionDetalle(id)
    } else {
      setConversacionDetalle(null)
    }
  }, [canAccessAtencionPublico, conversacionId])

  const sendReply = async () => {
    if (!solicitudChat || !replyText.trim() || sendingReply) return
    setSendingReply(true)
    try {
      const res = await apiService.addRespuestaSolicitudChat(solicitudChat.id, {
        autor: usuario?.nombre || 'Equipo',
        texto: replyText.trim()
      })
      if (res.success) {
        setReplyText('')
        await loadSolicitudChat(solicitudChat.id)
      }
    } finally {
      setSendingReply(false)
    }
  }

  const closeConversacion = () => {
    setSearchParams((p) => {
      p.delete('solicitud_chat')
      return p
    })
    setSolicitudChat(null)
  }

  const openConversacion = (id: number) => {
    setSearchParams({ conversacion: String(id) })
  }

  const closeConversacionDetalle = () => {
    setSearchParams((p) => {
      p.delete('conversacion')
      return p
    })
    setConversacionDetalle(null)
  }

  const formatFecha = (s: string) => {
    try {
      return new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return s
    }
  }

  const estadoLabel = (estado: string) => {
    const map: Record<string, string> = {
      abierto: 'Abierto',
      en_curso: 'En curso',
      cerrado: 'Cerrado',
      nuevo: 'Nuevo',
      en_revision: 'En revisión',
      resuelto: 'Resuelto'
    }
    return map[estado] || estado
  }

  if (!canAccessAtencionPublico) {
    return (
      <div className="atencion-publico-page">
        <div className="atencion-publico-header">
          <button type="button" className="back-button" onClick={() => navigate('/')}>
            ← Volver
          </button>
          <p className="atencion-publico-forbidden">No tenés acceso a Atención al público.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="atencion-publico-page">
      <header className="atencion-publico-header">
        <div className="atencion-publico-header-content">
          <div className="atencion-publico-header-top">
            <button type="button" className="back-button" onClick={() => navigate('/')}>
              ← Volver al Tablero
            </button>
          </div>
          <div className="atencion-publico-header-titulo">
            <span className="atencion-publico-header-icon">📞</span>
            <div>
              <h1>Atención al público</h1>
              <p className="atencion-publico-subtitle">
                Conversaciones del chat web, solicitudes de contacto y reclamos.
              </p>
            </div>
          </div>
        </div>
      </header>

      {solicitudChatId && (
        <section className="atencion-publico-conversacion-panel">
          {loadingSolicitud ? (
            <div className="atencion-publico-loading">Cargando conversación...</div>
          ) : solicitudChat ? (
            <>
              <div className="atencion-publico-conversacion-header">
                <h2>💬 Conversación con {solicitudChat.cliente_nombre || 'cliente'}</h2>
                <p className="atencion-publico-conversacion-meta">
                  Solicitó hablar con <strong>{solicitudChat.sector_solicitado}</strong> · Solicitud #{solicitudChat.id}
                </p>
                <button type="button" className="atencion-publico-cerrar-conversacion" onClick={closeConversacion}>
                  Cerrar
                </button>
              </div>
              <div className="atencion-publico-conversacion-mensajes">
                {solicitudChat.historial_mensajes?.map((m, i) => (
                  <div key={i} className={`atencion-publico-msg atencion-publico-msg--${m.role}`}>
                    <span className="atencion-publico-msg-role">{m.role === 'user' ? 'Cliente' : 'Asistente'}</span>
                    <p className="atencion-publico-msg-text">{m.text}</p>
                  </div>
                ))}
                {solicitudChat.respuestas_staff?.map((r, i) => (
                  <div key={`staff-${i}`} className="atencion-publico-msg atencion-publico-msg--staff">
                    <span className="atencion-publico-msg-role">{r.autor}</span>
                    <p className="atencion-publico-msg-text">{r.texto}</p>
                  </div>
                ))}
              </div>
              <div className="atencion-publico-conversacion-reply">
                <textarea
                  placeholder="Escribí tu respuesta al cliente..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="atencion-publico-reply-input"
                  rows={3}
                  disabled={sendingReply}
                />
                <button
                  type="button"
                  className="atencion-publico-reply-send"
                  onClick={sendReply}
                  disabled={sendingReply || !replyText.trim()}
                >
                  {sendingReply ? 'Enviando...' : 'Enviar respuesta'}
                </button>
              </div>
            </>
          ) : (
            <div className="atencion-publico-empty">
              <p>Solicitud no encontrada.</p>
              <button type="button" className="link-button" onClick={closeConversacion}>
                Volver
              </button>
            </div>
          )}
        </section>
      )}

      {conversacionId && !solicitudChatId && (
        <section className="atencion-publico-conversacion-panel atencion-publico-panel-conversacion">
          {loadingConversacion ? (
            <div className="atencion-publico-loading">Cargando conversación...</div>
          ) : conversacionDetalle ? (
            <>
              <div className="atencion-publico-conversacion-header">
                <h2>💬 {conversacionDetalle.cliente_nombre || 'Cliente web'}</h2>
                <p className="atencion-publico-conversacion-meta">
                  Canal: {conversacionDetalle.canal} · {formatFecha(conversacionDetalle.updated_at)}
                </p>
                <button type="button" className="atencion-publico-cerrar-conversacion" onClick={closeConversacionDetalle}>
                  Cerrar
                </button>
              </div>
              <div className="atencion-publico-conversacion-mensajes">
                {conversacionDetalle.historial_mensajes?.map((m, i) => (
                  <div key={i} className={`atencion-publico-msg atencion-publico-msg--${m.role}`}>
                    <span className="atencion-publico-msg-role">{m.role === 'user' ? 'Cliente' : 'Asistente'}</span>
                    <p className="atencion-publico-msg-text">{m.text}</p>
                  </div>
                ))}
                {(!conversacionDetalle.historial_mensajes || conversacionDetalle.historial_mensajes.length === 0) && (
                  <p className="atencion-publico-empty">Sin mensajes en esta conversación.</p>
                )}
              </div>
            </>
          ) : (
            <div className="atencion-publico-empty">
              <p>Conversación no encontrada.</p>
              <button type="button" className="link-button" onClick={closeConversacionDetalle}>
                Volver
              </button>
            </div>
          )}
        </section>
      )}

      <div className="atencion-publico-container">
        {/* Chat: embed para web + link interno */}
        <section className="atencion-publico-chat-ia">
          <h2>🤖 Chat con IA</h2>
          <p>El chat para clientes (Gemini) está disponible para la web <a href="https://plotcenter.com.ar/" target="_blank" rel="noopener noreferrer">plotcenter.com.ar</a>. Si el cliente se identifica con <strong>nombre, DNI o CUIT</strong>, la IA sabe quién es, conoce el estado de sus trabajos y los datos de la empresa.</p>
          <div className="atencion-publico-embed-actions">
            <a href="/embed/chat" target="_blank" rel="noopener noreferrer" className="atencion-publico-card atencion-publico-card-chat atencion-publico-card-link">
              <span className="atencion-publico-card-icon">🌐</span>
              <div className="atencion-publico-card-body">
                <h3>Abrir chat público (vista previa)</h3>
                <p>Mismo chat que se incrusta en la web. Probá identificándote con nombre, DNI o CUIT.</p>
              </div>
            </a>
            <button
              type="button"
              className="atencion-publico-card atencion-publico-card-chat"
              onClick={() => navigate('/chat')}
            >
              <span className="atencion-publico-card-icon">💬</span>
              <div className="atencion-publico-card-body">
                <h3>Chat del equipo (PlotAI)</h3>
                <p>Escribí <strong>@plotai</strong> o <strong>/plotai</strong> para consultar con la IA.</p>
              </div>
            </button>
          </div>
          <div className="atencion-publico-embed-code">
            <h4>Código para incrustar en WordPress (plotcenter.com.ar)</h4>
            <p className="atencion-publico-embed-code-hint">Elegí una opción y copiá el iframe en la web de Plot Center.</p>
            <p className="atencion-publico-embed-option-label"><strong>Opción 1 — Botón flotante (recomendado):</strong> se ve un botón en la esquina; al tocarlo se abre el chat en un panel flotante. Usá un iframe de al menos 400×600 para que el panel se vea completo.</p>
            <pre className="atencion-publico-pre">{`<iframe
  src="https://plotrello.vercel.app/embed/chat-widget"
  title="Chat Plot Center"
  width="400"
  height="600"
  style="border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999;"
></iframe>`}</pre>
            <p className="atencion-publico-embed-option-label"><strong>Opción 2 — Chat en página:</strong> el chat ocupa un bloque fijo en la página.</p>
            <pre className="atencion-publico-pre">{`<iframe
  src="https://plotrello.vercel.app/embed/chat"
  title="Chat Plot Center"
  width="100%"
  height="500"
  style="border: none; border-radius: 8px;"
></iframe>`}</pre>
          </div>
        </section>

        {/* Tabs: Mensajes | Reclamos */}
        <section className="atencion-publico-panel">
          <div className="atencion-publico-tabs">
            <button
              type="button"
              className={`atencion-publico-tab ${activeTab === 'mensajes' ? 'active' : ''}`}
              onClick={() => setActiveTab('mensajes')}
            >
              💬 Mensajes y conversaciones
            </button>
            <button
              type="button"
              className={`atencion-publico-tab ${activeTab === 'reclamos' ? 'active' : ''}`}
              onClick={() => setActiveTab('reclamos')}
            >
              📋 Estado de reclamos
            </button>
          </div>

          {activeTab === 'mensajes' && (
            <div className="atencion-publico-content">
              <h3>Conversaciones con clientes</h3>
              {loadingConv ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : conversaciones.length === 0 ? (
                <div className="atencion-publico-empty">
                  <p>No hay conversaciones aún. Las charlas del chat web (plotcenter.com.ar) se guardan acá automáticamente.</p>
                </div>
              ) : (
                <ul className="atencion-publico-list">
                  {conversaciones.map((c) => (
                    <li
                      key={c.id}
                      className="atencion-publico-list-item atencion-publico-list-item-clickable"
                      onClick={() => openConversacion(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && openConversacion(c.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="atencion-publico-item-header">
                        <span className="atencion-publico-item-nombre">{c.cliente_nombre || c.cliente_email || 'Cliente web'}</span>
                        <span className={`atencion-publico-badge atencion-publico-badge-${c.estado}`}>{estadoLabel(c.estado)}</span>
                      </div>
                      <div className="atencion-publico-item-meta">{c.canal} · {formatFecha(c.updated_at)}</div>
                      {c.ultimo_mensaje_preview && (
                        <p className="atencion-publico-item-preview">{c.ultimo_mensaje_preview}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'reclamos' && (
            <div className="atencion-publico-content">
              <h3>Reclamos</h3>
              {loadingReclamos ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : reclamos.length === 0 ? (
                <div className="atencion-publico-empty">
                  <p>No hay reclamos registrados.</p>
                </div>
              ) : (
                <ul className="atencion-publico-list">
                  {reclamos.map((r) => (
                    <li key={r.id} className="atencion-publico-list-item">
                      <div className="atencion-publico-item-header">
                        <span className="atencion-publico-item-nombre">{r.cliente_nombre || r.cliente_email || 'Sin nombre'}</span>
                        <span className={`atencion-publico-badge atencion-publico-badge-${r.estado}`}>{estadoLabel(r.estado)}</span>
                        <span className={`atencion-publico-badge atencion-publico-prioridad-${r.prioridad}`}>{r.prioridad}</span>
                      </div>
                      <p className="atencion-publico-item-desc">{r.descripcion}</p>
                      <div className="atencion-publico-item-meta">{formatFecha(r.updated_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default AtencionPublicoDashboardPage
