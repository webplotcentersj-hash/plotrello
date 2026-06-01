import { useCallback, useRef, useState } from 'react'
import { generateContent } from '../../../services/plotAIService'
import { listArqueos, listMovimientos } from '../cajaRepository'
import { fmtArs } from '../format'

type Msg = { role: 'user' | 'assistant'; text: string }

type Props = {
  isAdmin: boolean
  usuarioNombre: string
}

export default function CajaPlotAI({ isAdmin, usuarioNombre }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Soy PlotAI para Control de Cajas. Puedo ayudarte con arqueos, movimientos, importación Excel y buenas prácticas de cierre. ¿Qué necesitás?'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const buildContext = useCallback(async () => {
    const [arqueos, movs] = await Promise.all([
      listArqueos(isAdmin ? undefined : { usuario: usuarioNombre }),
      listMovimientos(isAdmin ? undefined : { usuario: usuarioNombre })
    ])
    const ultArqueo = arqueos[0]
    const ultMovs = movs.slice(0, 5)
    return `Módulo Control de Cajas (Plot Lab).
Usuario: ${usuarioNombre}. Rol: ${isAdmin ? 'Administración' : 'Caja'}.
Último arqueo: ${ultArqueo ? `${ultArqueo.fecha} caja ${ultArqueo.caja_slug} total $${fmtArs(ultArqueo.total)}` : 'ninguno'}.
Últimos movimientos: ${
      ultMovs.length
        ? ultMovs.map((m) => `${m.fecha} ${m.concepto} $${fmtArs(m.efectivo + m.otros)}`).join('; ')
        : 'ninguno'
    }.
Guía: Fondo de caja = apertura; Pase = entre cajas; Cierre = entrega a administración.
Excel: columnas fecha, hora, concepto, origen, destino, efectivo, otros, nro, observacion.`
  }, [isAdmin, usuarioNombre])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const ctx = await buildContext()
      const history = messages
        .slice(-6)
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
        Asistente para dudas de arqueo, movimientos, plantilla Excel y procedimientos. No reemplaza la firma ni
        el control de administración.
      </div>
      <div className="caja-cc-ai-messages">
        {messages.map((m, i) => (
          <div key={i} className={`caja-cc-ai-msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && <div className="caja-cc-ai-msg assistant">Pensando…</div>}
        <div ref={endRef} />
      </div>
      <div className="caja-cc-ai-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ej: ¿Cómo cargo un pase a administración?"
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
