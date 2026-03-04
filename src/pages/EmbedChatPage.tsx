import { useState, useRef, useEffect } from 'react'
import './EmbedChatPage.css'

type ChatMessage = { role: 'user' | 'model'; parts: { text: string }[] }

export default function EmbedChatPage() {
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [op, setOp] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [briefUrl, setBriefUrl] = useState<string | null>(null)
  const [showIdentificacion, setShowIdentificacion] = useState(true)
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

  const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
  const chatApi = `${apiBase}/api/plotai/chat-public`

  const normalizeForSearch = (value: string, digitsOnly = false) => {
    const t = value.trim()
    if (!t) return undefined
    if (digitsOnly) {
      const num = t.replace(/\D/g, '')
      return num.length >= 2 ? num : t
    }
    return t
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', parts: [{ text }] }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const history = messages.map((m) => ({
        role: m.role,
        parts: m.parts
      }))
      const res = await fetch(chatApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          nombre: normalizeForSearch(nombre),
          dni: normalizeForSearch(dni, true),
          cuit: normalizeForSearch(cuit, true),
          op: normalizeForSearch(op, true),
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
    <div className="embed-chat-scope">
      <div className="embed-chat">
      <header className="embed-chat-header">
        <div className="embed-chat-header-inner">
          <div className="embed-chat-logo">
            <span className="embed-chat-logo-icon">◆</span>
            <div>
              <span className="embed-chat-title">Plot Center</span>
              <span className="embed-chat-subtitle">Asistente virtual</span>
            </div>
          </div>
        </div>
      </header>

      {showIdentificacion ? (
        <section className="embed-chat-identificacion">
          <p className="embed-chat-identificacion-text">
            Opcional: nombre, DNI, CUIT o número de OP para consultar tus trabajos.
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
          Identificarme (nombre, DNI, CUIT u OP)
        </button>
      )}

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
  )
}
