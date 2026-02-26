import { useState, useRef, useEffect } from 'react'
import './EmbedChatPage.css'

type ChatMessage = { role: 'user' | 'model'; parts: { text: string }[] }

export default function EmbedChatPage() {
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showIdentificacion, setShowIdentificacion] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
      const history = messages.map((m) => ({
        role: m.role,
        parts: m.parts
      }))
      const res = await fetch(chatApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          nombre: nombre.trim() || undefined,
          dni: dni.trim() || undefined,
          cuit: cuit.trim() || undefined,
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
    } catch (e) {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="embed-chat">
      <div className="embed-chat-header">
        <span className="embed-chat-title">Plot Center</span>
        <span className="embed-chat-subtitle">Asistente virtual</span>
      </div>

      {showIdentificacion && (
        <div className="embed-chat-identificacion">
          <p className="embed-chat-identificacion-text">
            Indicá nombre, DNI o CUIT (acá o en el chat, ej. &quot;me llamo Juan Pérez&quot;, &quot;mi DNI es 20123456&quot;) para que el asistente sepa con quién habla y pueda consultar tus OPs y datos.
          </p>
          <div className="embed-chat-identificacion-fields">
            <input
              type="text"
              placeholder="Nombre o empresa"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="embed-chat-input-field"
            />
            <input
              type="text"
              placeholder="DNI"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              className="embed-chat-input-field"
            />
            <input
              type="text"
              placeholder="CUIT"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              className="embed-chat-input-field"
            />
          </div>
          <button
            type="button"
            className="embed-chat-link"
            onClick={() => setShowIdentificacion(false)}
          >
            Ocultar
          </button>
        </div>
      )}
      {!showIdentificacion && (
        <button
          type="button"
          className="embed-chat-link"
          onClick={() => setShowIdentificacion(true)}
        >
          Identificarme (nombre, DNI, CUIT)
        </button>
      )}

      <div className="embed-chat-messages">
        {messages.length === 0 && !loading && (
          <div className="embed-chat-welcome">
            Hola. Si querés que consulte tus trabajos (OPs), decime tu nombre, DNI o CUIT (ej. &quot;me llamo María García&quot; o &quot;mi DNI es 20123456&quot;). También puedo ayudarte con info de Plot Center y contacto.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`embed-chat-msg embed-chat-msg--${m.role}`}>
            {m.parts?.[0]?.text}
          </div>
        ))}
        {loading && (
          <div className="embed-chat-msg embed-chat-msg--model embed-chat-msg--loading">
            ...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="embed-chat-error">{error}</div>}

      <div className="embed-chat-footer">
        <input
          type="text"
          placeholder="Escribí tu mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          className="embed-chat-input"
          disabled={loading}
        />
        <button
          type="button"
          className="embed-chat-send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
