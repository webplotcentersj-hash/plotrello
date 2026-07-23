import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateContent } from '../../../services/plotAIService'
import {
  formatSnapshotForAI,
  getCajaAiPrompts,
  loadCajaSnapshot,
  type CajaSnapshot
} from '../cajaInteligencia'
import { BILLETE_DENOMINACIONES } from '../constants'
import { fmtArs, parseNum } from '../format'
import CajaVolverPlotLab from './CajaVolverPlotLab'

type Msg = { role: 'user' | 'assistant'; text: string }

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
}

const CONTEXT_TTL_MS = 90_000

export default function CajaPlotAI({ isAdmin, usuarioNombre, usuarioId }: Props) {
  const prompts = useMemo(() => getCajaAiPrompts(isAdmin), [isAdmin])
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: isAdmin
        ? 'Te ayudo con el día de caja: cuadres, MP, banco y qué revisar primero. Elegí un acceso rápido o preguntá.'
        : 'Soy tu ayudante de caja: te oriento a contar billetes, armar el arqueo, egresos, pase y cierre. Usá “Resumen de mi día” o el contador de billetes.'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [snap, setSnap] = useState<CajaSnapshot | null>(null)
  const [snapLoading, setSnapLoading] = useState(true)
  const [billetes, setBilletes] = useState<Record<string, number>>({})
  const [contadorOpen, setContadorOpen] = useState(!isAdmin)
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

  const totalBilletes = useMemo(() => {
    let t = 0
    for (const d of BILLETE_DENOMINACIONES) {
      t += (billetes[`b${d}`] || 0) * d
    }
    return t
  }, [billetes])

  const objetivo =
    snap?.operativaHoy?.efectivoTeorico != null ? snap.operativaHoy.efectivoTeorico : null
  const deltaObjetivo = objetivo != null && totalBilletes > 0 ? totalBilletes - objetivo : null

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
    let text = formatSnapshotForAI(data, { isAdmin, usuario: usuarioNombre })
    if (totalBilletes > 0) {
      const det = BILLETE_DENOMINACIONES.filter((d) => (billetes[`b${d}`] || 0) > 0)
        .map((d) => `${billetes[`b${d}`]}×$${d.toLocaleString('es-AR')}`)
        .join(', ')
      text += `\n\nCONTADOR DE BILLETES EN VIVO (usuario):\n- Detalle: ${det || '—'}\n- Total contado ahora: $${fmtArs(totalBilletes)}\n- Objetivo teórico: ${objetivo != null ? `$${fmtArs(objetivo)}` : 'n/d'}\n- Diferencia: ${deltaObjetivo != null ? `$${fmtArs(deltaObjetivo)}` : 'n/d'}`
    }
    ctxCacheRef.current = { at: now, text }
    return text
  }, [snap, isAdmin, usuarioNombre, usuarioId, billetes, totalBilletes, objetivo, deltaObjetivo])

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return
    if (!textOverride) setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)
    ctxCacheRef.current = null
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

  const preguntarContador = () => {
    const det = BILLETE_DENOMINACIONES.filter((d) => (billetes[`b${d}`] || 0) > 0)
      .map((d) => `${billetes[`b${d}`]} de $${d.toLocaleString('es-AR')}`)
      .join(', ')
    void send(
      `Conté estos billetes: ${det || 'ninguno'}. Total $ ${fmtArs(totalBilletes)}` +
        (objetivo != null ? ` (objetivo $ ${fmtArs(objetivo)})` : '') +
        '. ¿Cuadra? Si no, qué reviso (egresos, fondo, ventas en efectivo) y qué hago en Mi arqueo.'
    )
  }

  const puntaje = snap?.salud.puntaje
  const puntajeClass =
    puntaje == null ? '' : puntaje >= 90 ? 'ok' : puntaje >= 70 ? 'warn' : 'bad'
  const op = snap?.operativaHoy

  return (
    <div className="caja-cc-ai">
      <header className="caja-cc-ai-hero">
        <div className="caja-cc-ai-hero-text">
          <span className="caja-cc-ai-hero-icon" aria-hidden>
            ✨
          </span>
          <div>
            <h2 className="caja-cc-ai-hero-title">Asistente de caja</h2>
            <p className="caja-cc-ai-hero-lead">
              {isAdmin
                ? 'Resúmenes, cuadres MP/banco y prioridades del día. No reemplaza firma ni control de administración.'
                : 'Te ayuda a contar, armar el arqueo, egresos y cerrar el turno con datos reales de tu caja.'}
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
          {!isAdmin && op ? (
            <>
              <span className="caja-cc-ai-kpi">{op.cajaNombre || 'Tu caja'}</span>
              <span className="caja-cc-ai-kpi">
                Teórico $ {op.efectivoTeorico != null ? fmtArs(op.efectivoTeorico) : '—'}
              </span>
              <span className="caja-cc-ai-kpi">
                {op.arqueoHecho ? 'Arqueo ✓' : 'Sin arqueo'} ·{' '}
                {op.egresosPendientes > 0
                  ? `${op.egresosPendientes} egreso(s) pend.`
                  : 'Egresos OK'}
              </span>
              <span className="caja-cc-ai-kpi">
                Plot Lab ef. $ {fmtArs(op.resumenPlotlab?.efectivo ?? 0)}
              </span>
            </>
          ) : (
            <>
              <span className="caja-cc-ai-kpi">Tolerancia $ {fmtArs(snap.tolerancia)}</span>
              <span className="caja-cc-ai-kpi">
                {snap.salud.totalesMes.cierres} cierres · {snap.salud.totalesMes.revisar} a revisar
              </span>
              <span className="caja-cc-ai-kpi">
                Egresos hoy: {(snap.egresosHoy ?? []).length}
              </span>
            </>
          )}
        </div>
      )}

      {!isAdmin && (
        <div className="caja-cc-ai-contador">
          <button
            type="button"
            className="caja-cc-ai-contador-toggle"
            onClick={() => setContadorOpen((v) => !v)}
            aria-expanded={contadorOpen}
          >
            <span aria-hidden>💵</span> Contador de billetes {contadorOpen ? '▼' : '▶'}
            {totalBilletes > 0 ? ` · $ ${fmtArs(totalBilletes)}` : ''}
          </button>
          {contadorOpen && (
            <div className="caja-cc-ai-contador-body">
              <p className="caja-cc-help">
                Contá acá y pedile al asistente si cuadra con el teórico
                {objetivo != null ? ` ($ ${fmtArs(objetivo)})` : ''}.
              </p>
              <div className="caja-cc-ai-contador-grid">
                {BILLETE_DENOMINACIONES.map((d) => (
                  <label key={d} className="caja-cc-ai-contador-row">
                    <span>$ {d.toLocaleString('es-AR')}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={billetes[`b${d}`] || ''}
                      onChange={(e) => {
                        const q = Math.max(0, Math.floor(parseNum(e.target.value)))
                        setBilletes((prev) => ({ ...prev, [`b${d}`]: q }))
                        ctxCacheRef.current = null
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="caja-cc-ai-contador-total">
                <strong>Total contado: $ {fmtArs(totalBilletes)}</strong>
                {deltaObjetivo != null && (
                  <span className={Math.abs(deltaObjetivo) <= 1.5 ? 'ok' : 'bad'}>
                    {Math.abs(deltaObjetivo) <= 1.5
                      ? ' · Cuadra con teórico'
                      : deltaObjetivo < 0
                        ? ` · Faltan $ ${fmtArs(Math.abs(deltaObjetivo))}`
                        : ` · Sobran $ ${fmtArs(deltaObjetivo)}`}
                  </span>
                )}
              </div>
              <div className="caja-cc-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loading || totalBilletes <= 0}
                  onClick={preguntarContador}
                >
                  Preguntar si cuadra
                </button>
                <button
                  type="button"
                  className="btn-tiny"
                  onClick={() => {
                    setBilletes({})
                    ctxCacheRef.current = null
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="caja-cc-ai-quick" role="group" aria-label="Accesos rápidos">
        {prompts.map((p) => (
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
        {loading && <div className="caja-cc-ai-msg assistant">Analizando tu caja…</div>}
        <div ref={endRef} />
      </div>
      <div className="caja-cc-ai-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isAdmin
              ? 'Ej: ¿Qué cierres reviso primero hoy?'
              : 'Ej: Me faltan $50.000, ¿puede ser un egreso sin ticket?'
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
