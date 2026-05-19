import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TotemPlotAiInput } from '@/components/ui/totem-plotai-input'
import styles from './TotemAutogestionPlotAiChat.module.css'

const CHAT_API = '/api/plotai/chat-public'
const DEFAULT_MODO = 'totem_autogestion'
const DEFAULT_LS_CONV = 'plotrello_totem_autogestion_plotai_conv'

export type TotemPlotAiChatProps = {
  modo?: string
  conversationStorageKey?: string
  title?: string
  titleSub?: string
  emptyHint?: string
  className?: string
}

type ChatPart = { text: string }
type ChatMessage = { role: 'user' | 'model'; parts: ChatPart[] }

function renderMessageLinks(text: string, apiBase: string): ReactNode {
  const urlRegex = /((https?:\/\/|www\.)\S+|\/brief\/[A-Za-z0-9._-]+)/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(text)) !== null) {
    const [full] = match
    const index = match.index
    if (index > lastIndex) parts.push(text.slice(lastIndex, index))
    const href = full.startsWith('http') ? full : full.startsWith('www.') ? `https://${full}` : `${apiBase}${full}`
    parts.push(
      <a key={`${href}-${index}`} href={href} target="_blank" rel="noopener noreferrer">
        {full}
      </a>
    )
    lastIndex = index + full.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length ? parts : text
}

export function TotemAutogestionPlotAiChat({
  modo = DEFAULT_MODO,
  conversationStorageKey = DEFAULT_LS_CONV,
  title = 'PlotAI',
  titleSub = 'Chat en pantalla · distinto al asistente por voz',
  emptyHint = 'Escribí abajo para hablar con PlotAI. Tus mensajes quedan en esta sesión del tótem.',
  className
}: TotemPlotAiChatProps = {}) {
  const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | null>(() => {
    try {
      const s = localStorage.getItem(conversationStorageKey)
      const n = s ? parseInt(s, 10) : NaN
      return Number.isInteger(n) ? n : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (conversationId != null) {
      try {
        localStorage.setItem(conversationStorageKey, String(conversationId))
      } catch {
        /* noop */
      }
    }
  }, [conversationId, conversationStorageKey])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const resetChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setError(null)
    setLoading(false)
    try {
      localStorage.removeItem(conversationStorageKey)
    } catch {
      /* noop */
    }
  }, [conversationStorageKey])

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || loading) return

      setError(null)
      const historyForApi = messages.map((m) => ({ role: m.role, parts: m.parts }))
      setMessages((prev) => [...prev, { role: 'user', parts: [{ text }] }])
      setLoading(true)

      try {
        const res = await fetch(`${apiBase}${CHAT_API}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            modo,
            conversation_id: conversationId ?? undefined,
            history: historyForApi
          })
        })
        const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string; conversation_id?: number }
        if (!res.ok) {
          setError(data.error || 'No se pudo enviar el mensaje.')
          setMessages((prev) => prev.slice(0, -1))
          return
        }
        const reply = (data.reply && String(data.reply).trim()) || 'No pude generar una respuesta.'
        setMessages((prev) => [...prev, { role: 'model', parts: [{ text: reply }] }])
        if (data.conversation_id != null) setConversationId(Number(data.conversation_id))
      } catch {
        setError('Error de conexión. Intentá de nuevo.')
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setLoading(false)
      }
    },
    [apiBase, conversationId, loading, messages, modo]
  )

  const rootClass = className ? `${styles.root} ${className}` : styles.root

  return (
    <section className={rootClass} aria-label="Chat PlotAI">
      <div className={styles.shell}>
        <div className={styles.shellInner}>
          <div className={styles.head}>
            <div className={styles.titleRow}>
              <div className={styles.titleIcon} aria-hidden>
                AI
              </div>
              <h2 className={styles.title}>
                <span className={styles.titleBrand}>{title}</span> — consultas
                <span className={styles.titleSub}>{titleSub}</span>
              </h2>
            </div>
            <button type="button" className={styles.newChat} onClick={resetChat} disabled={loading}>
              Nuevo chat
            </button>
          </div>

          <div className={styles.messages} role="log" aria-live="polite">
            {messages.length === 0 && !loading && <p className={styles.emptyHint}>{emptyHint}</p>}
            {messages.map((m, i) => {
              const t = m.parts[0]?.text ?? ''
              const isUser = m.role === 'user'
              return (
                <div key={`${i}-${t.slice(0, 32)}`} className={`${styles.row} ${isUser ? styles.rowUser : styles.rowModel}`}>
                  <div className={`${styles.bubbleCol} ${isUser ? styles.bubbleColUser : styles.bubbleColModel}`}>
                    <span className={styles.bubbleLabel}>{isUser ? 'Vos' : 'PlotAI'}</span>
                    <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleModel}`}>
                      {isUser ? t : renderMessageLinks(t, apiBase)}
                    </div>
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className={`${styles.row} ${styles.rowModel}`}>
                <div className={styles.typingRow}>
                  <div className={styles.typing}>
                    <span className={styles.typingDots} aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                    PlotAI está escribiendo…
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.inputSlot}>
            <TotemPlotAiInput className={styles.inputEmbed} onSend={sendMessage} disabled={loading} />
          </div>
        </div>
      </div>
    </section>
  )
}
