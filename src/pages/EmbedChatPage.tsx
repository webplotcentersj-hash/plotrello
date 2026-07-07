import { useState, useRef, useEffect } from 'react'
import './EmbedChatPage.css'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import {
  EmbedChatVoiceBanner,
  EmbedChatVoiceButton,
  useEmbedChatVoice
} from '../components/embed/EmbedChatVoice'
import '../components/embed/EmbedChatVoice.css'
import {
  type EmbedChatMessage,
  collectUserTexts,
  fileToChatImagePayload,
  EMBED_CHAT_CONVERSATION_KEY,
  EMBED_CHAT_OPENING_GREETING,
  buildEmbedChatApiPayload,
  clearEmbedChatSession,
  loadEmbedChatSession,
  openEmbedChatLarge,
  type EmbedPresupuestoPayload
} from '../utils/embedChatShared'
import { useEmbedStaffReplies } from '../hooks/useEmbedStaffReplies'
import { useEmbedShellLayout } from '../hooks/useEmbedShellLayout'
import { EmbedChatOnlineStatus } from '../components/embed/EmbedChatOnlineStatus'
import { EmbedPresupuestoBanner } from '../components/embed/EmbedPresupuestoBanner'
import '../components/embed/EmbedChatOnlineStatus.css'

const PLOTAI_LOGO = '/plot-lab-logo.png'

export default function EmbedChatPage() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const hideFormFromPortal = searchParams?.get('hideForm') === '1'
  const modoFromUrl = searchParams?.get('modo') || (hideFormFromPortal ? 'cliente_portal' : 'web_publico')
  const clienteIdFromUrl = (() => {
    const raw = searchParams?.get('clienteId')
    const n = raw ? parseInt(raw, 10) : NaN
    return Number.isInteger(n) && n > 0 ? n : null
  })()
  const clienteNombreFromUrl = searchParams?.get('clienteNombre') || ''
  const clienteEmpresaFromUrl = searchParams?.get('clienteEmpresa') || ''
  const clienteEmailFromUrl = searchParams?.get('clienteEmail') || ''
  const isClientePortal = modoFromUrl === 'cliente_portal'
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [op, setOp] = useState('')
  const [messages, setMessages] = useState<EmbedChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [briefUrl, setBriefUrl] = useState<string | null>(null)
  const [presupuesto, setPresupuesto] = useState<EmbedPresupuestoPayload | null>(null)
  const [showIdentificacion, setShowIdentificacion] = useState(!hideFormFromPortal)
  const [conversationId, setConversationId] = useState<number | null>(() => {
    try {
      const s = typeof localStorage !== 'undefined' ? localStorage.getItem(EMBED_CHAT_CONVERSATION_KEY) : null
      const n = s ? parseInt(s, 10) : NaN
      return Number.isInteger(n) ? n : null
    } catch {
      return null
    }
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImage, setPendingImage] = useState<{
    mimeType: string
    data: string
    previewUrl: string
    staffPreviewUrl: string
  } | null>(null)
  const [autoStartVoice, setAutoStartVoice] = useState(() => searchParams?.get('voice') === '1')
  const voiceBootstrappedRef = useRef(false)

  const { staffReplies } = useEmbedStaffReplies(conversationId, {
    notifyIcon: PLOTAI_LOGO
  })

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => {
    if (conversationId != null && typeof localStorage !== 'undefined') {
      localStorage.setItem(EMBED_CHAT_CONVERSATION_KEY, String(conversationId))
    }
  }, [conversationId])
  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, staffReplies])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEmbedShellLayout('page')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('resume') !== '1') return
    const snap = loadEmbedChatSession()
    if (!snap) return
    if (snap.messages.length > 0) setMessages(snap.messages)
    if (snap.nombre) setNombre(snap.nombre)
    if (snap.telefono) setTelefono(snap.telefono)
    if (snap.dni) setDni(snap.dni)
    if (snap.cuit) setCuit(snap.cuit)
    if (snap.op) setOp(snap.op)
    if (snap.presupuesto) setPresupuesto(snap.presupuesto)
    if (snap.conversationId != null) setConversationId(snap.conversationId)
    setShowIdentificacion(false)
    clearEmbedChatSession()
  }, [])

  useEffect(() => {
    if (isClientePortal || messages.length > 0) return
    setMessages([{ role: 'model', parts: [{ text: EMBED_CHAT_OPENING_GREETING }] }])
  }, [isClientePortal, messages.length])

  useEffect(() => {
    if (!isClientePortal || messages.length > 0) return
    const saludo =
      clienteNombreFromUrl.trim().length > 0
        ? `¡Hola, ${clienteNombreFromUrl.trim()}! Soy PlotAI. Tengo acceso a tus pedidos del portal y a tus órdenes de trabajo. Preguntame por el estado de un pedido, una OP o una fecha de entrega.`
        : '¡Hola! Soy PlotAI. Preguntame por el estado de tus pedidos u órdenes de trabajo.'
    setMessages([{ role: 'model', parts: [{ text: saludo }] }])
  }, [isClientePortal, clienteNombreFromUrl, messages.length])

  const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
  const chatApi = plotLabApiUrl('/api/plotai/chat-public')

  const renderMessageText = (text: string) => {
    const urlRegex = /((https?:\/\/|www\.)\S+|\/brief\/[A-Za-z0-9._-]+)/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(text)) !== null) {
      const [full] = match
      const index = match.index
      if (index > lastIndex) {
        parts.push(text.slice(lastIndex, index))
      }
      const href = full.startsWith('http') ? full : full.startsWith('www.') ? `https://${full}` : `${apiBase}${full}`
      parts.push(
        <a
          key={`${href}-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="embed-chat-link-inline"
        >
          {full}
        </a>
      )
      lastIndex = index + full.length
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }
    return parts
  }

  const handlePickImage = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.')
      return
    }
    setError(null)
    try {
      const payload = await fileToChatImagePayload(file)
      setPendingImage(payload)
    } catch {
      setError('No pude procesar la imagen. Probá con otra.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if ((!text && !pendingImage) || loading) return

    const imageSnapshot = pendingImage
    const userMsgText = text || (imageSnapshot ? '📷 Imagen enviada' : '')
    const userMsg: EmbedChatMessage = {
      role: 'user',
      parts: [{ text: userMsgText }],
      ...(imageSnapshot ? { imagePreviewUrl: imageSnapshot.previewUrl } : {})
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setPendingImage(null)
    setLoading(true)
    setError(null)

    try {
      const history = messages
        .filter((m) => m.role === 'user' || (m.role === 'model' && m.parts?.[0]?.text))
        .map((m) => ({
          role: m.role,
          parts: m.parts
        }))
      const res = await fetch(chatApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildEmbedChatApiPayload({
            message: text,
            modo: modoFromUrl,
            history,
            conversationId,
            clienteId: clienteIdFromUrl,
            identificacion: {
              nombre: nombre || clienteNombreFromUrl || undefined,
              telefono,
              empresa: clienteEmpresaFromUrl || undefined,
              clienteEmail: clienteEmailFromUrl || undefined,
              dni,
              cuit,
              op
            },
            image: imageSnapshot
              ? {
                  mimeType: imageSnapshot.mimeType,
                  data: imageSnapshot.data,
                  staffPreviewUrl: imageSnapshot.staffPreviewUrl
                }
              : null
          })
        )
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Error al enviar el mensaje.')
        setLoading(false)
        return
      }
      const reply = data.reply || 'No pude generar una respuesta.'
      setMessages((prev) => [...prev, { role: 'model', parts: [{ text: reply }] }])
      if (data.conversation_id != null) setConversationId(data.conversation_id)
      if (data.presupuesto && Array.isArray(data.presupuesto.items) && data.presupuesto.items.length > 0) {
        setPresupuesto(data.presupuesto as EmbedPresupuestoPayload)
      }
      if (data.brief && (data.brief.url || data.brief.token)) {
        const url = typeof data.brief.url === 'string' && data.brief.url
          ? data.brief.url
          : `${apiBase}/brief/${data.brief.token}`
        setBriefUrl(url)
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const appendVoiceTranscript = (role: 'user' | 'model', text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === role && last.parts?.[0]?.text) {
        const merged = `${last.parts[0].text} ${trimmed}`.trim()
        return [...prev.slice(0, -1), { role, parts: [{ text: merged }] }]
      }
      return [...prev, { role, parts: [{ text: trimmed }] }]
    })
  }

  const voice = useEmbedChatVoice({
    userTexts: collectUserTexts(messages),
    disabled: loading,
    identificacion: { nombre, telefono, dni, cuit, op, empresa: clienteEmpresaFromUrl || undefined },
    onUserTranscript: (text) => appendVoiceTranscript('user', text),
    onModelTranscript: (text) => appendVoiceTranscript('model', text)
  })

  useEffect(() => {
    if (!autoStartVoice || voiceBootstrappedRef.current || voice.active || voice.starting) return
    voiceBootstrappedRef.current = true
    setAutoStartVoice(false)
    const timer = window.setTimeout(() => {
      void voice.toggleLive()
    }, 600)
    return () => window.clearTimeout(timer)
  }, [autoStartVoice, voice.active, voice.starting, voice])

  const openLargeChat = () => {
    openEmbedChatLarge({
      messages,
      nombre: nombre || clienteNombreFromUrl || '',
      telefono,
      dni,
      cuit,
      op,
      presupuesto,
      conversationId
    })
  }

  return (
    <div className="embed-chat-scope embed-chat-scope--page">
      <div className="embed-chat">
      <header className="embed-chat-header">
        <div className="embed-chat-header-inner">
          <div className="embed-chat-logo embed-chat-logo-block">
            <img
              src="/plot-lab-logo.png"
              alt="Plot Center Logo"
              className="embed-chat-logo-image"
            />
            <EmbedChatOnlineStatus />
          </div>
        </div>
      </header>

      {!hideFormFromPortal && (showIdentificacion ? (
        <section className="embed-chat-identificacion">
          <p className="embed-chat-identificacion-text">
            Para cotizar: nombre y WhatsApp. Para tu OP: nombre, DNI, CUIT o número de OP.
          </p>
          <div className="embed-chat-identificacion-fields">
            <input
              type="text"
              placeholder="Nombre o empresa"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="embed-chat-input-field"
              aria-label="Nombre o empresa"
            />
            <input
              type="tel"
              placeholder="WhatsApp"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="embed-chat-input-field"
              aria-label="WhatsApp"
            />
            <input
              type="text"
              placeholder="DNI"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              className="embed-chat-input-field"
              aria-label="DNI"
            />
            <input
              type="text"
              placeholder="CUIT"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              className="embed-chat-input-field"
              aria-label="CUIT"
            />
            <input
              type="text"
              placeholder="Nº OP"
              value={op}
              onChange={(e) => setOp(e.target.value)}
              className="embed-chat-input-field embed-chat-input-op"
              aria-label="Número de OP"
            />
          </div>
          <button
            type="button"
            className="embed-chat-link"
            onClick={() => setShowIdentificacion(false)}
          >
            Ocultar
          </button>
        </section>
      ) : (
        <button
          type="button"
          className="embed-chat-link embed-chat-link-bar"
          onClick={() => setShowIdentificacion(true)}
        >
          Identificarme (nombre, WhatsApp, DNI, CUIT u OP)
        </button>
      ))}

      <div className="embed-chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`embed-chat-msg embed-chat-msg--${m.role}`}>
            {m.imagePreviewUrl && (
              <img src={m.imagePreviewUrl} alt="Imagen enviada" className="embed-chat-msg-image" />
            )}
            {m.parts?.[0]?.text && m.parts[0].text !== '📷 Imagen enviada' && (
              <span className="embed-chat-msg-text">
                {renderMessageText(m.parts[0].text)}
              </span>
            )}
            {m.parts?.[0]?.text === '📷 Imagen enviada' && !m.imagePreviewUrl && (
              <span className="embed-chat-msg-text">{m.parts[0].text}</span>
            )}
          </div>
        ))}
        {staffReplies.map((r, i) => (
          <div key={`staff-${i}`} className="embed-chat-msg embed-chat-msg--staff">
            <span className="embed-chat-msg-role">Equipo · {r.autor}</span>
            <span className="embed-chat-msg-text">{r.texto}</span>
          </div>
        ))}
        {loading && (
          <div className="embed-chat-msg embed-chat-msg--model embed-chat-msg--typing">
            <div className="embed-chat-typing">
              <span className="embed-chat-typing-dot" />
              <span className="embed-chat-typing-dot" />
              <span className="embed-chat-typing-dot" />
            </div>
            <span className="embed-chat-typing-label">Plot Center está escribiendo...</span>
          </div>
        )}
        <div ref={messagesEndRef} className="embed-chat-anchor" />
      </div>

      {error && (
        <div className="embed-chat-error" role="alert">
          {error}
        </div>
      )}

      {presupuesto && <EmbedPresupuestoBanner presupuesto={presupuesto} />}

      {briefUrl && (
        <div className="embed-brief-banner">
          <div className="embed-brief-text">
            <strong>Formulario de brief listo</strong>
            <span>Completalo para que podamos ayudarte mejor con tu proyecto.</span>
          </div>
          <a
            href={briefUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="embed-brief-button"
          >
            Abrir formulario
          </a>
        </div>
      )}

      {pendingImage && (
        <div className="embed-attach-preview" aria-label="Imagen adjunta">
          <img src={pendingImage.previewUrl} alt="Vista previa" className="embed-attach-preview-img" />
          <button
            type="button"
            className="embed-attach-remove"
            onClick={() => setPendingImage(null)}
            aria-label="Quitar imagen"
          >
            ✕
          </button>
        </div>
      )}

      <EmbedChatVoiceBanner
        active={voice.active}
        starting={voice.starting}
        speaking={voice.speaking}
        error={voice.error}
        status={voice.status}
        onStop={voice.stopLive}
        onRetry={() => void voice.toggleLive()}
        onOpenStandalone={openLargeChat}
      />

      <footer className="embed-chat-footer">
        <div className="embed-chat-footer-tools">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="embed-attach-input"
            onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="embed-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-label="Adjuntar foto"
            title="Adjuntar foto"
          >
            📎
          </button>
          <EmbedChatVoiceButton
            active={voice.active}
            starting={voice.starting}
            disabled={loading}
            micAvailable={voice.micAvailable}
            onClick={() => void voice.toggleLive()}
          />
        </div>
        <input
          type="text"
          placeholder="Escribí tu mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          className="embed-chat-input"
          disabled={loading}
          aria-label="Mensaje"
        />
        <button
          type="button"
          className="embed-chat-send"
          onClick={sendMessage}
          disabled={loading || (!input.trim() && !pendingImage)}
          aria-label="Enviar"
        >
          <span className="embed-chat-send-icon">↑</span>
          <span className="embed-chat-send-text">Enviar</span>
        </button>
      </footer>
      </div>
    </div>
  )
}
