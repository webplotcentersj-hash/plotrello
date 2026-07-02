import { useState, useRef, useEffect } from 'react'
import './EmbedChatPage.css'
import './EmbedChatWidgetPage.css'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import {
  EmbedChatVoiceBanner,
  EmbedChatVoiceButton,
  useEmbedChatVoice
} from '../components/embed/EmbedChatVoice'
import {
  type EmbedChatMessage,
  collectUserTexts,
  fileToChatImagePayload,
  EMBED_CHAT_CONVERSATION_KEY,
  EMBED_CHAT_OPENING_GREETING,
  postEmbedWidgetResize,
  buildEmbedChatApiPayload,
  type EmbedPresupuestoPayload
} from '../utils/embedChatShared'
import { getEmbedStandaloneChatUrl } from '../utils/embedMicPermission'
import { EmbedPresupuestoBanner } from '../components/embed/EmbedPresupuestoBanner'
import '../components/embed/EmbedChatVoice.css'
import { useEmbedStaffReplies } from '../hooks/useEmbedStaffReplies'
import { useEmbedShellLayout } from '../hooks/useEmbedShellLayout'
import { EmbedChatOnlineStatus } from '../components/embed/EmbedChatOnlineStatus'
import '../components/embed/EmbedChatOnlineStatus.css'

const PLOTAI_LOGO = '/plot-lab-logo.png'

/** Ícono de chat atractivo: burbuja con puntos de conversación */
function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {/* Burbuja principal */}
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.06L1.5 22l5.18-1.5A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" opacity="0.95" />
      {/* Puntos de mensaje (más visibles) */}
      <circle cx="8.5" cy="11.5" r="1.25" fill="rgba(255,255,255,0.9)" />
      <circle cx="12" cy="11.5" r="1.25" fill="rgba(255,255,255,0.9)" />
      <circle cx="15.5" cy="11.5" r="1.25" fill="rgba(255,255,255,0.9)" />
    </svg>
  )
}

export default function EmbedChatWidgetPage() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<EmbedChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNewStaffReply, setHasNewStaffReply] = useState(false)
  const [briefUrl, setBriefUrl] = useState<string | null>(null)
  const [presupuesto, setPresupuesto] = useState<EmbedPresupuestoPayload | null>(null)
  const [showIdentificacion, setShowIdentificacion] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [op, setOp] = useState('')
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

  useEffect(() => {
    if (conversationId != null && typeof localStorage !== 'undefined') {
      localStorage.setItem(EMBED_CHAT_CONVERSATION_KEY, String(conversationId))
    }
  }, [conversationId])

  const { staffReplies, hasNewStaffReply: hookHasNewStaffReply, clearNewStaffReply } =
    useEmbedStaffReplies(conversationId, {
      enabled: open,
      notifyIcon: PLOTAI_LOGO
    })

  useEffect(() => {
    if (hookHasNewStaffReply) setHasNewStaffReply(true)
  }, [hookHasNewStaffReply])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, staffReplies])

  const [viewportSize, setViewportSize] = useState({ w: 88, h: 88 })

  useEffect(() => {
    const updateSize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const margin = 24
    const btnMax = Math.min(96, viewportSize.w - margin, viewportSize.h - margin)
    root.style.setProperty('--embed-btn-size', `${Math.max(32, btnMax)}px`)
    return () => { root.style.removeProperty('--embed-btn-size') }
  }, [viewportSize])

  useEmbedShellLayout('widget', { active: open })

  useEffect(() => {
    if (!open || messages.length > 0) return
    setMessages([{ role: 'model', parts: [{ text: EMBED_CHAT_OPENING_GREETING }] }])
  }, [open, messages.length])

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('embed-widget-page')
    const html = root.style
    const body = document.body.style
    const prevBgHtml = html.background
    const prevBgBody = body.background
    const prevOverflowHtml = html.overflow
    const prevOverflowBody = body.overflow
    const prevMarginBody = body.margin
    const prevPaddingBody = body.padding
    html.background = 'transparent'
    body.background = 'transparent'
    if (!open) {
      html.overflow = 'visible'
      body.overflow = 'visible'
    }
    body.margin = '0'
    body.padding = '0'
    return () => {
      root.classList.remove('embed-widget-page')
      html.background = prevBgHtml
      body.background = prevBgBody
      html.overflow = prevOverflowHtml
      body.overflow = prevOverflowBody
      body.margin = prevMarginBody
      body.padding = prevPaddingBody
    }
  }, [open])

  useEffect(() => {
    if (open && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [open])

  useEffect(() => {
    postEmbedWidgetResize(open)
    const raf = requestAnimationFrame(() => postEmbedWidgetResize(open))
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onResize = () => postEmbedWidgetResize(true)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [open])

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
      const history = messages.map((m) => ({ role: m.role, parts: m.parts }))
      const res = await fetch(chatApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildEmbedChatApiPayload({
            message: text,
            history,
            conversationId,
            identificacion: { nombre, telefono, dni, cuit, op },
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
      const reply = data.reply != null && data.reply !== '' ? data.reply : null
      if (reply) setMessages((prev) => [...prev, { role: 'model', parts: [{ text: reply }] }])
      else setMessages((prev) => prev)
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
    identificacion: { nombre, telefono, dni, cuit, op },
    onUserTranscript: (text) => appendVoiceTranscript('user', text),
    onModelTranscript: (text) => appendVoiceTranscript('model', text)
  })

  return (
    <div className="embed-widget-wrap embed-chat-scope">
      <button
        type="button"
        className="embed-widget-button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) {
            setHasNewStaffReply(false)
            clearNewStaffReply()
          }
        }}
        aria-label={open ? 'Cerrar chat' : 'Abrir chat'}
        aria-expanded={open}
      >
        {hasNewStaffReply && !open && <span className="embed-widget-badge" aria-hidden />}
        {!open && <EmbedChatOnlineStatus dotOnly />}
        <span className="embed-widget-button-icon">
          {open ? (
            <span className="embed-widget-button-close" aria-hidden>✕</span>
          ) : (
            <ChatBubbleIcon className="embed-widget-button-chat-icon" />
          )}
        </span>
      </button>

      {open && (
        <div className="embed-widget-panel">
          <div className="embed-widget-panel-inner embed-chat">
            <header className="embed-chat-header">
              <div className="embed-chat-header-inner">
                <div className="embed-chat-logo">
                  <img src={PLOTAI_LOGO} alt="" className="embed-chat-logo-img" />
                  <div>
                    <span className="embed-chat-title">PlotAI</span>
                    <EmbedChatOnlineStatus className="embed-chat-subtitle-status" />
                  </div>
                </div>
                <button
                  type="button"
                  className="embed-widget-close"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
            </header>

            {showIdentificacion ? (
              <section className="embed-chat-identificacion">
                <p className="embed-chat-identificacion-text">
                  Para cotizar: nombre y WhatsApp. Para tu OP: DNI, CUIT o número de OP.
                </p>
                <div className="embed-chat-identificacion-fields">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="embed-chat-input-field"
                    aria-label="Nombre"
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
                Identificarme (nombre, WhatsApp u OP)
              </button>
            )}

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
                  <span className="embed-chat-typing-label">PlotAI está escribiendo...</span>
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
                <img src={pendingImage.previewUrl} alt="Imagen adjunta" className="embed-attach-preview-img" />
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
              onOpenStandalone={() => window.open(getEmbedStandaloneChatUrl(), '_blank', 'noopener,noreferrer')}
            />

            <footer className="embed-chat-footer">
              <div className="embed-chat-footer-tools">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
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
      )}
    </div>
  )
}
