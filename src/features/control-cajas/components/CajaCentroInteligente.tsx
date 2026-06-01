import { useCallback, useEffect, useState } from 'react'
import { generateContent } from '../../../services/plotAIService'
import {
  CAJA_AI_PROMPTS,
  formatSnapshotForAI,
  loadCajaSnapshot,
  type CajaSnapshot
} from '../cajaInteligencia'
import { fmtArs } from '../format'
import type { CajaAlerta, CajaSectionId } from '../types'

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
  onNavigate?: (section: CajaSectionId) => void
  compact?: boolean
}

function severidadClass(s: CajaAlerta['severidad']): string {
  if (s === 'error') return 'error'
  if (s === 'warn') return 'warn'
  if (s === 'ok') return 'ok'
  return 'info'
}

function dominioLabel(d: CajaAlerta['dominio']): string {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    mercado_pago: 'Mercado Pago',
    banco: 'Banco',
    cierre: 'Cierre',
    arqueo: 'Arqueo',
    movimiento: 'Movimiento',
    diferencia: 'Diferencia',
    general: 'General'
  }
  return map[d] ?? d
}

export default function CajaCentroInteligente({
  isAdmin,
  usuarioNombre,
  usuarioId,
  onNavigate,
  compact = false
}: Props) {
  const [snap, setSnap] = useState<CajaSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadCajaSnapshot({
        isAdmin,
        usuario: usuarioNombre,
        usuarioId
      })
      setSnap(data)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, usuarioNombre, usuarioId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runBriefing = async (extraPrompt?: string) => {
    if (!snap || briefingLoading) return
    setBriefingLoading(true)
    setBriefing(null)
    try {
      const ctx = formatSnapshotForAI(snap, { isAdmin, usuario: usuarioNombre })
      const text = await generateContent({
        contents:
          extraPrompt ??
          'Generá un briefing ejecutivo de orquestación de caja: prioridades del día, concordancia efectivo/MP/banco, y pasos concretos ordenados por urgencia. Máximo 12 líneas, español Argentina.',
        extraContextPrefix: ctx,
        useCompleteContext: false,
        useMemory: false,
        includeAppManual: false,
        learnFromResponse: false,
        userName: usuarioNombre
      })
      setBriefing(text)
    } catch (e) {
      setBriefing(e instanceof Error ? e.message : 'No se pudo generar el briefing.')
    } finally {
      setBriefingLoading(false)
    }
  }

  if (loading && !snap) {
    return (
      <div className="caja-cc-intel caja-cc-intel-loading">
        <p>Analizando concordancia (efectivo, MP, banco, cierres)…</p>
      </div>
    )
  }

  if (!snap) return null

  const { salud } = snap
  const alertasVisibles = compact ? salud.alertas.filter((a) => a.severidad !== 'ok').slice(0, 5) : salud.alertas.slice(0, 24)
  const puntajeClass =
    salud.puntaje >= 90 ? 'ok' : salud.puntaje >= 70 ? 'warn' : 'bad'

  return (
    <section className={`caja-cc-intel${compact ? ' compact' : ''}`} aria-label="Centro de inteligencia de caja">
      <div className="caja-cc-intel-head">
        <div>
          <h3 className="caja-cc-intel-title">
            <span className="caja-cc-intel-spark" aria-hidden>
              ✨
            </span>
            Motor de concordancia
          </h3>
          <p className="caja-cc-sub">
            Cruza efectivo, Mercado Pago, banco, arqueos y cierres para detectar desvíos antes del cierre.
          </p>
        </div>
        <div className="caja-cc-intel-actions">
          <button type="button" className="btn-secondary" onClick={() => void refresh()} disabled={loading}>
            Actualizar
          </button>
          {!compact && (
            <button
              type="button"
              className="btn-primary"
              disabled={briefingLoading}
              onClick={() => void runBriefing()}
            >
              {briefingLoading ? 'Orquestando…' : 'Briefing IA'}
            </button>
          )}
        </div>
      </div>

      <div className="caja-cc-intel-kpis">
        <div className={`caja-cc-intel-score ${puntajeClass}`}>
          <span className="caja-cc-intel-score-v">{salud.puntaje}</span>
          <span className="caja-cc-intel-score-l">Salud · {salud.etiqueta}</span>
        </div>
        <div className="caja-cc-intel-pills">
          <span className="caja-cc-intel-pill">Tolerancia $ {fmtArs(snap.tolerancia)}</span>
          <span className="caja-cc-intel-pill">
            {salud.totalesMes.cierres} cierres · {salud.totalesMes.revisar} a revisar
          </span>
          <span className="caja-cc-intel-pill">Dif. mes $ {fmtArs(salud.totalesMes.difNeta)}</span>
        </div>
      </div>

      {!compact && (
        <div className="caja-cc-intel-prompts">
          {CAJA_AI_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="caja-cc-intel-chip"
              disabled={briefingLoading}
              onClick={() => void runBriefing(p.prompt)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {briefing && (
        <div className="caja-cc-intel-briefing">
          <strong>Orquestación PlotAI</strong>
          <p>{briefing}</p>
        </div>
      )}

      <div className="caja-cc-intel-alerts">
        <h4>Alertas de concordancia</h4>
        {alertasVisibles.length === 0 ? (
          <p className="caja-cc-empty">Sin alertas en la ventana analizada.</p>
        ) : (
          <ul className="caja-cc-intel-alert-list">
            {alertasVisibles.map((a) => (
              <li key={a.id} className={`caja-cc-intel-alert ${severidadClass(a.severidad)}`}>
                <div className="caja-cc-intel-alert-top">
                  <span className="caja-cc-intel-domain">{dominioLabel(a.dominio)}</span>
                  {a.fecha && <span className="caja-cc-intel-fecha">{a.fecha}</span>}
                </div>
                <strong>{a.titulo}</strong>
                <p>{a.detalle}</p>
                {a.accion && onNavigate && isAdmin && (
                  <button
                    type="button"
                    className="btn-link caja-cc-intel-goto"
                    onClick={() => onNavigate(a.accion!.section)}
                  >
                    {a.accion.label} →
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {compact && salud.alertas.length > 5 && onNavigate && (
          <button type="button" className="btn-link" onClick={() => onNavigate('centro_ia')}>
            Ver todas las alertas →
          </button>
        )}
      </div>
    </section>
  )
}
