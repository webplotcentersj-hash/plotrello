import { useState, useRef, useEffect } from 'react'
import './EmbedChatPage.css'
import './EmbedChatWidgetPage.css'

const PLOTAI_LOGO = 'https://plotcenter.com.ar/wp-content/uploads/2024/10/FAVICON_Mesa-de-trabajo-1.png'
const POLL_INTERVAL_MS = 4000

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

type ChatMessage = { role: 'user' | 'model'; parts: { text: string }[] }
type StaffReply = { autor: string; texto: string; created_at?: string }

export default function EmbedChatWidgetPage() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [staffReplies, setStaffReplies] = useState<StaffReply[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNewStaffReply, setHasNewStaffReply] = useState(false)
  const [briefUrl, setBriefUrl] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImage, setPendingImage] = useState<{
    mimeType: string
    data: string
    previewUrl: string
  } | null>(null)

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
    html.overflow = 'visible'
    body.overflow = 'visible'
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
  }, [])

  const IFRAME_CLOSED_WIDTH = 88
  const IFRAME_CLOSED_HEIGHT = 88
  const IFRAME_OPEN_WIDTH = 400
  const IFRAME_OPEN_HEIGHT = 580

  useEffect(() => {
    if (open && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [open])

  useEffect(() => {
    try {
      if (window.parent !== window) {
        const w = open ? IFRAME_OPEN_WIDTH : IFRAME_CLOSED_WIDTH
        const h = open ? IFRAME_OPEN_HEIGHT : IFRAME_CLOSED_HEIGHT
        window.parent.postMessage(
          { type: 'plotai-widget-resize', open, width: w, height: h },
          '*'
        )
      }
    } catch {
      // ignore
    }
  }, [open])

  const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
  const respuestasApi = `${apiBase}/api/plotai/conversation-respuestas`

  const prevStaffCountRef = useRef(0)

  useEffect(() => {
    if (conversationId == null) {
      setStaffReplies([])
      prevStaffCountRef.current = 0
      return
    }
    const fetchRespuestas = async () => {
      try {
        const res = await fetch(`${respuestasApi}?conversation_id=${conversationId}`)
        const data = await res.json().catch(() => ({}))
        if (Array.isArray(data.respuestas_staff)) {
          const prev = prevStaffCountRef.current
          const next = data.respuestas_staff.length
          setStaffReplies(data.respuestas_staff)
          if (next > prev && prev > 0) {
            setHasNewStaffReply(true)
            try {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Plot Center', {
                  body: 'Te respondieron en el chat.',
                  icon: PLOTAI_LOGO
                })
              }
            } catch {
              // ignore
            }
          }
          prevStaffCountRef.current = next
        }
      } catch {
        // ignore
      }
    }
    fetchRespuestas()
    const interval = setInterval(fetchRespuestas, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [open, conversationId])

  const chatApi = `${apiBase}/api/plotai/chat-public`

  const downscaleImageToJpeg = async (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('No se pudo leer la imagen'))
        el.src = objectUrl
      })
      const maxSide = 1280
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo crear canvas')
      ctx.drawImage(img, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', 0.82)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const handlePickImage = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.')
      return
    }
    setError(null)
    try {
      const dataUrl = file.size > 900_000 ? await downscaleImageToJpeg(file) : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
        reader.readAsDataURL(file)
      })
      const [meta, b64] = dataUrl.split(',')
      const mimeType = meta?.match(/data:([^;]+);base64/i)?.[1] || 'image/jpeg'
      if (!b64) throw new Error('Imagen inválida')
      setPendingImage({ mimeType, data: b64, previewUrl: dataUrl })
    } catch {
      setError('No pude procesar la imagen. Probá con otra.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if ((!text && !pendingImage) || loading) return

    const userMsgText = text || (pendingImage ? '📷 Imagen enviada' : '')
    const userMsg: ChatMessage = { role: 'user', parts: [{ text: userMsgText }] }
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
        body: JSON.stringify({
          message: text,
          ...(pendingImage ? { images: [{ mimeType: pendingImage.mimeType, data: pendingImage.data }] } : {}),
          conversation_id: conversationId ?? undefined,
          history
        })
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
      if (data.brief && (data.brief.url || data.brief.token)) {
        const url = typeof data.brief.url === 'string' && data.brief.url
          ? data.brief.url
          : `${apiBase}/brief/${data.brief.token}`
        setBriefUrl(url)
      }
    } catch (e) {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="embed-widget-wrap embed-chat-scope">
      <button
        type="button"
        className="embed-widget-button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) setHasNewStaffReply(false)
        }}
        aria-label={open ? 'Cerrar chat' : 'Abrir chat'}
        aria-expanded={open}
      >
        {hasNewStaffReply && !open && <span className="embed-widget-badge" aria-hidden />}
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
                    <span className="embed-chat-subtitle">Asistente virtual</span>
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

            <div className="embed-chat-messages">
              {messages.length === 0 && !loading && (
                <div className="embed-chat-welcome">
                  <p>Hola.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`embed-chat-msg embed-chat-msg--${m.role}`}>
                  <span className="embed-chat-msg-text">{m.parts?.[0]?.text}</span>
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

            <footer className="embed-chat-footer">
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
