import { useCallback, useRef, useState } from 'react'
import { generateContent } from '../../../services/plotAIService'
import {
  CAJA_AI_PROMPTS,
  formatSnapshotForAI,
  loadCajaSnapshot
} from '../cajaInteligencia'

type Msg = { role: 'user' | 'assistant'; text: string }

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
}

export default function CajaPlotAI({ isAdmin, usuarioNombre, usuarioId }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: isAdmin
        ? 'Soy PlotAI para Control de Cajas. Tengo contexto de cierres, efectivo, Mercado Pago, banco, conciliaciones y arqueos. Preguntame cómo orquestar el día o resolver una diferencia.'
        : 'Soy PlotAI para tu caja. Te ayudo con arqueos, movimientos y cómo cuadrar con el cierre de administración.'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const buildContext = useCallback(async () => {
    const snap = await loadCajaSnapshot({
      isAdmin,
      usuario: usuarioNombre,
      usuarioId
    })
    return formatSnapshotForAI(snap, { isAdmin, usuario: usuarioNombre })
  }, [isAdmin, usuarioNombre, usuarioId])

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return
    if (!textOverride) setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const ctx = await buildContext()
      const history = messages
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'Usuario' : 'PlotAI'}: ${m.text}`)
        .join('\n')
      const reply = await generateContent({
        contents: text,
        extraContextPrefix: ctx,
        conversationHistory: history,
        useCompleteContext: false,
        useMemory: false,
        includeAppManual: false,
        learnFromResponse: false,
        userName: usuarioNombre
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: e instanceof Error ? e.message : 'No pude responder. Revisá VITE_GEMINI_API_KEY.'
        }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <div className="caja-cc-ai">
      <div className="caja-cc-help">
        Asistente con motor de concordancia: efectivo, MP, banco, cierres y arqueos. No reemplaza firma ni control
        de administración.
      </div>
      <div className="caja-cc-intel-prompts caja-cc-ai-chips">
        {CAJA_AI_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="caja-cc-intel-chip"
            disabled={loading}
            onClick={() => void send(p.prompt)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="caja-cc-ai-messages">
        {messages.map((m, i) => (
          <div key={i} className={`caja-cc-ai-msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && <div className="caja-cc-ai-msg assistant">Analizando concordancia…</div>}
        <div ref={endRef} />
      </div>
      <div className="caja-cc-ai-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isAdmin
              ? 'Ej: ¿Por qué no cuadra MP hoy y qué reviso primero?'
              : 'Ej: ¿Cómo cargo un pase a administración?'
          }
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void send()}>
          Enviar
        </button>
      </div>
    </div>
  )
}
