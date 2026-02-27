import { useState, useRef, useEffect } from 'react'
import './EmbedChatPage.css'
import './EmbedChatWidgetPage.css'

const PLOTAI_LOGO = 'https://plotcenter.com.ar/wp-content/uploads/2024/10/FAVICON_Mesa-de-trabajo-1.png'

type ChatMessage = { role: 'user' | 'model'; parts: { text: string }[] }

export default function EmbedChatWidgetPage() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<number | null>(() => {
    try {
      const s = typeof localStorage !== 'undefined' ? localStorage.getItem('embed_chat_conversation_id') : null
      const n = s ? parseInt(s, 10) : NaN
      return Number.isInteger(n) ? n : null
    } catch {
      return null
    }
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => {
    if (conversationId != null && typeof localStorage !== 'undefined') {
      localStorage.setItem('embed_chat_conversation_id', String(conversationId))
    }
  }, [conversationId])
  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  useEffect(() => {
    const prevHtml = document.documentElement.style.background
    const prevBody = document.body.style.background
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    return () => {
      document.documentElement.style.background = prevHtml
      document.body.style.background = prevBody
    }
  }, [])

  const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
  const chatApi = `${apiBase}/api/plotai/chat-public`

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', parts: [{ text }] }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const history = messages.map((m) => ({ role: m.role, parts: m.parts }))
      const res = await fetch(chatApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
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
      const reply = data.reply || 'No pude generar una respuesta.'
      setMessages((prev) => [...prev, { role: 'model', parts: [{ text: reply }] }])
      if (data.conversation_id != null) setConversationId(data.conversation_id)
    } catch (e) {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="embed-widget-wrap">
      <button
        type="button"
        className="embed-widget-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Cerrar chat' : 'Abrir chat'}
        aria-expanded={open}
      >
        <span className="embed-widget-button-icon">{open ? '✕' : '💬'}</span>
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
                  <p>Hola. Escribí tu consulta y te ayudo con información y contacto de Plot Center.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`embed-chat-msg embed-chat-msg--${m.role}`}>
                  <span className="embed-chat-msg-text">{m.parts?.[0]?.text}</span>
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

            <footer className="embed-chat-footer">
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
                disabled={loading || !input.trim()}
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
