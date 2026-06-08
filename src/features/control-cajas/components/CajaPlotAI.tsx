import { useCallback, useEffect, useRef, useState } from 'react'
import { generateContent } from '../../../services/plotAIService'
import {
  CAJA_AI_PROMPTS,
  formatSnapshotForAI,
  loadCajaSnapshot,
  type CajaSnapshot
} from '../cajaInteligencia'
import { fmtArs } from '../format'
import CajaVolverPlotLab from './CajaVolverPlotLab'

type Msg = { role: 'user' | 'assistant'; text: string }

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
}

const CONTEXT_TTL_MS = 90_000

export default function CajaPlotAI({ isAdmin, usuarioNombre, usuarioId }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: isAdmin
        ? 'PlotAI con contexto de cierres, efectivo, MP y banco. Elegí un acceso rápido o escribí tu consulta.'
        : 'Te ayudo con arqueos, movimientos y cómo cuadrar con administración. Usá los accesos rápidos o preguntá libremente.'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [snap, setSnap] = useState<CajaSnapshot | null>(null)
  const [snapLoading, setSnapLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const ctxCacheRef = useRef<{ at: number; text: string } | null>(null)

  const refreshSnap = useCallback(async () => {
    setSnapLoading(true)
    try {
      const data = await loadCajaSnapshot({
        isAdmin,
        usuario: usuarioNombre,
        usuarioId
      })
      setSnap(data)
      ctxCacheRef.current = null
    } finally {
      setSnapLoading(false)
    }
  }, [isAdmin, usuarioNombre, usuarioId])

  useEffect(() => {
    void refreshSnap()
  }, [refreshSnap])

  const buildContext = useCallback(async () => {
    const now = Date.now()
    if (ctxCacheRef.current && now - ctxCacheRef.current.at < CONTEXT_TTL_MS) {
      return ctxCacheRef.current.text
    }
    const data =
      snap ??
      (await loadCajaSnapshot({
        isAdmin,
        usuario: usuarioNombre,
        usuarioId
      }))
    const text = formatSnapshotForAI(data, { isAdmin, usuario: usuarioNombre })
    ctxCacheRef.current = { at: now, text }
    return text
  }, [snap, isAdmin, usuarioNombre, usuarioId])

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return
    if (!textOverride) setInput('')
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
          text: e instanceof Error ? e.message : 'No pude responder. Revisá GEMINI_API_KEY en Vercel.'
        }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const puntaje = snap?.salud.puntaje
  const puntajeClass =
    puntaje == null ? '' : puntaje >= 90 ? 'ok' : puntaje >= 70 ? 'warn' : 'bad'

  return (
    <div className="caja-cc-ai">
      <header className="caja-cc-ai-hero">
        <div className="caja-cc-ai-hero-text">
          <span className="caja-cc-ai-hero-icon" aria-hidden>
            ✨
          </span>
          <div>
            <h2 className="caja-cc-ai-hero-title">Asistente IA</h2>
            <p className="caja-cc-ai-hero-lead">
              Concordancia efectivo, MP, banco, cierres y arqueos. No reemplaza firma ni control de
              administración.
            </p>
          </div>
        </div>
        {puntaje != null && (
          <div className={`caja-cc-ai-hero-score ${puntajeClass}`}>
            <span className="caja-cc-ai-hero-score-v">{puntaje}</span>
            <span className="caja-cc-ai-hero-score-l">{snap?.salud.etiqueta ?? 'Salud'}</span>
          </div>
        )}
        <div className="caja-cc-ai-hero-actions">
          <button
            type="button"
            className="btn-tiny caja-cc-ai-refresh"
            disabled={snapLoading}
            onClick={() => void refreshSnap()}
            title="Actualizar datos de caja"
          >
            {snapLoading ? '…' : '↻'}
          </button>
          <CajaVolverPlotLab small />
        </div>
      </header>

      {snap && !snapLoading && (
        <div className="caja-cc-ai-kpis">
          <span className="caja-cc-ai-kpi">Tolerancia $ {fmtArs(snap.tolerancia)}</span>
          <span className="caja-cc-ai-kpi">
            {snap.salud.totalesMes.cierres} cierres · {snap.salud.totalesMes.revisar} a revisar
          </span>
        </div>
      )}

      <div className="caja-cc-ai-quick" role="group" aria-label="Accesos rápidos">
        {CAJA_AI_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="caja-cc-ai-quick-btn"
            disabled={loading || snapLoading}
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
        {loading && <div className="caja-cc-ai-msg assistant">PlotAI analizando…</div>}
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
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button type="button" className="btn-primary" disabled={loading || snapLoading} onClick={() => void send()}>
          {loading ? '…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
