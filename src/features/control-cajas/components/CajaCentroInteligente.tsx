import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateContent } from '../../../services/plotAIService'
import {
  CAJA_AI_PROMPTS,
  formatSnapshotForAI,
  loadCajaSnapshot,
  mezclarSaludConPlanilla,
  type CajaSnapshot
} from '../cajaInteligencia'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import { fmtArs } from '../format'
import type { CajaAlerta, CajaSectionId } from '../types'
import CajaVolverPlotLab from './CajaVolverPlotLab'

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
  onNavigate?: (section: CajaSectionId) => void
  compact?: boolean
  /** Panel plegable (por defecto en vista compacta). */
  collapsible?: boolean
  /** Estado inicial al montar (compacto: cerrado). */
  defaultExpanded?: boolean
  /** Planilla PDF leída en la misma pantalla — alimenta alertas de concordancia. */
  planillaActiva?: PlanillaCajaParsed | null
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
  compact = false,
  collapsible,
  defaultExpanded,
  planillaActiva = null
}: Props) {
  const esColapsable = collapsible ?? compact
  const [expanded, setExpanded] = useState(
    defaultExpanded !== undefined ? defaultExpanded : !compact
  )
  const [snap, setSnap] = useState<CajaSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [alertSearch, setAlertSearch] = useState('')

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

  const salud = useMemo(() => {
    if (!snap) return null
    return mezclarSaludConPlanilla(snap.salud, planillaActiva, snap.tolerancia)
  }, [snap, planillaActiva])

  const runBriefing = async (extraPrompt?: string) => {
    if (!snap || briefingLoading) return
    setBriefingLoading(true)
    setBriefing(null)
    try {
      const ctx = formatSnapshotForAI(snap, { isAdmin, usuario: usuarioNombre })
      const planillaCtx = planillaActiva
        ? `\n\nPLANILLA PDF ACTIVA (${planillaActiva.archivo_nombre}): ${planillaActiva.cantidad_ventas} ventas, neto $${fmtArs(planillaActiva.totales?.neto ?? 0)}.`
        : ''
      const text = await generateContent({
        contents:
          extraPrompt ??
          'Generá un briefing ejecutivo de orquestación de caja: prioridades del día, concordancia efectivo/MP/banco, y pasos concretos ordenados por urgencia. Máximo 12 líneas, español Argentina.',
        extraContextPrefix: ctx + planillaCtx,
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

  if (!snap || !salud) return null

  const alertasBase = compact
    ? salud.alertas.filter((a) => a.severidad !== 'ok').slice(0, 5)
    : salud.alertas.slice(0, 24)

  const qAlert = alertSearch.trim().toLowerCase()
  const alertasVisibles = qAlert
    ? alertasBase.filter(
        (a) =>
          a.titulo.toLowerCase().includes(qAlert) ||
          a.detalle.toLowerCase().includes(qAlert) ||
          dominioLabel(a.dominio).toLowerCase().includes(qAlert)
      )
    : alertasBase
  const puntajeClass = salud.puntaje >= 90 ? 'ok' : salud.puntaje >= 70 ? 'warn' : 'bad'

  const toggleExpanded = () => {
    if (esColapsable) setExpanded((v) => !v)
  }

  return (
    <section
      className={`caja-cc-intel${compact ? ' compact' : ''}${esColapsable ? ' collapsible' : ''}${expanded ? ' is-open' : ' is-collapsed'}`}
      aria-label="Centro de inteligencia de caja"
    >
      <div className="caja-cc-intel-head">
        <button
          type="button"
          className="caja-cc-intel-head-toggle"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          disabled={!esColapsable}
        >
          <span className="caja-cc-intel-chevron" aria-hidden>
            {esColapsable ? (expanded ? '▼' : '▶') : ''}
          </span>
          <span className="caja-cc-intel-title">
            <span className="caja-cc-intel-spark" aria-hidden>
              ✨
            </span>
            Motor de concordancia
          </span>
          {planillaActiva && (
            <span className="caja-cc-intel-planilla-badge" title={planillaActiva.archivo_nombre}>
              PDF activo
            </span>
          )}
        </button>
        <div className={`caja-cc-intel-score ${puntajeClass} caja-cc-intel-score-inline`}>
          <span className="caja-cc-intel-score-v">{salud.puntaje}</span>
          <span className="caja-cc-intel-score-l">{salud.etiqueta}</span>
        </div>
        <div className="caja-cc-intel-actions">
          <CajaVolverPlotLab small />
          <button
            type="button"
            className="btn-tiny caja-cc-intel-btn"
            onClick={() => void refresh()}
            disabled={loading}
            title="Recalcular concordancia"
          >
            {loading ? '…' : '↻'}
          </button>
          {!compact && (
            <button
              type="button"
              className="btn-tiny caja-cc-intel-btn caja-cc-intel-btn-primary"
              disabled={briefingLoading}
              onClick={() => void runBriefing()}
            >
              {briefingLoading ? '…' : 'Briefing'}
            </button>
          )}
          {esColapsable && (
            <button
              type="button"
              className="btn-tiny caja-cc-intel-btn"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Ocultar' : 'Ver'}
            </button>
          )}
        </div>
      </div>

      {!expanded && esColapsable && (
        <p className="caja-cc-intel-collapsed-hint">
          {salud.alertas.filter((a) => a.severidad !== 'ok').length} alerta(s)
          {planillaActiva ? ' · planilla PDF integrada' : ''} — desplegá para ver detalle.
        </p>
      )}

      {expanded && (
        <div className="caja-cc-intel-body">
          <p className="caja-cc-sub">
            Cruza efectivo, Mercado Pago, banco, arqueos y cierres
            {planillaActiva ? ' con los datos de la planilla PDF cargada' : ''} para detectar desvíos antes del
            cierre.
          </p>

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
            <div className="caja-cc-intel-alerts-head">
              <h4>Alertas de concordancia</h4>
              <label className="caja-cc-search caja-cc-search--dark">
                <span className="caja-cc-search-icon" aria-hidden>
                  ⌕
                </span>
                <input
                  type="search"
                  className="caja-cc-search-input"
                  placeholder="Buscar alerta…"
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  aria-label="Buscar en alertas"
                />
              </label>
            </div>
            {alertasVisibles.length === 0 ? (
              <p className="caja-cc-empty">
                {qAlert ? 'Ninguna alerta coincide con la búsqueda.' : 'Sin alertas en la ventana analizada.'}
              </p>
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
                    {a.accion && onNavigate && (isAdmin || a.accion.section === 'arqueo' || a.accion.section === 'historial' || a.accion.section === 'cierre_turno') && (
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
        </div>
      )}
    </section>
  )
}
