import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import { sanitizeHtml } from '../utils/sanitizeHtml'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import type { Task, TeamMember } from '../types/board'
import type {
  ComentarioOrden,
  HistorialMovimiento,
  SectorRecord
} from '../types/api'
import apiService from '../services/api'
import { ordenToTask, parseTaskIdToOrdenId, mapStatusToEstado } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { useTagColors } from '../hooks/useTagColors'
import { fetchPlotAIRecommendationsForTask } from '../utils/taskPlotAIRecommendations'
import ReclamoTriangleIcon from './ReclamoTriangleIcon'
import OpCobroPill from './OpCobroPill'
import OpGaleriaCarousel from './OpGaleriaCarousel'
import Subtasks from './Subtasks'
import './TaskEditModal.css'
import './TaskViewModal.css'

/** Vista tablero: menos filas = menos DOM y scroll fluido. Biblioteca: más contexto sin pedir miles. */
const HISTORIAL_LIMIT_VISTA_RAPIDA = 120
const HISTORIAL_LIMIT_BIBLIOTECA = 900

type TaskViewModalProps = {
  task: Task
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  onClose: () => void
  /** Biblioteca: refrescar desde API y mostrar comentarios, adjuntos, trazados de etapas, checklist, etc. */
  exhaustiveDetail?: boolean
  /** Biblioteca: permitir editar desde esta vista */
  allowEdit?: boolean
  onRequestEdit?: (task: Task) => void
  /** Biblioteca: restaurar OP oculta o eliminada lógicamente al tablero visible */
  onRestartEnTablero?: () => void | Promise<void>
}

function formatCambiosJson(cd: unknown): string | null {
  if (cd == null) return null
  if (typeof cd === 'string' && cd.trim()) return cd.trim()
  try {
    return JSON.stringify(cd, null, 2)
  } catch {
    return String(cd)
  }
}

function formatDisplayDate(s: string | null | undefined) {
  if (s == null || s === '') return null
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return s
  }
}

function formatSeconds(sec: number) {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}

function describeHistorialMovimiento(m: HistorialMovimiento): string {
  const c = m.comentario?.trim()
  if (c) return c
  const at = m.accion_tipo?.trim()
  if (at === 'restart_tablero') return 'Restart en biblioteca — OP restaurada al tablero'
  const ea = m.estado_anterior?.trim()
  const en = m.estado_nuevo?.trim()
  if (ea || en) return `${ea || '—'} → ${en || '—'}`
  return at ? `Acción: ${etiquetaAccionHistorial(at)}` : 'Registro sin detalle'
}

function etiquetaAccionHistorial(raw: string): string {
  const k = raw.trim().toLowerCase()
  if (k === 'actualizacion' || k === 'actualización') return 'Actualización'
  if (k === 'restart_tablero') return 'Restart'
  if (k === 'creacion' || k === 'creación') return 'Creación'
  return raw.replace(/_/g, ' ')
}

function nombreEnHistorial(m: HistorialMovimiento, members: TeamMember[]): string {
  const id = Number(m.id_usuario)
  const idOk = Number.isFinite(id) && id > 0
  const member = members.find((t) => t.id.replace(/^user-/, '') === String(id))
  const raw = m.nombre_usuario?.trim() ?? ''
  const rawEsId = raw !== '' && /^\d+$/.test(raw)
  const candidato = !raw || rawEsId || raw === 'Usuario' || raw === 'Sistema' ? member?.name || raw : raw
  const nombre = etiquetaUsuarioNombre(candidato || null, idOk ? id : null)
  if (nombre && nombre !== '—' && !/^\d+$/.test(nombre)) return nombre
  return idOk ? `Usuario #${id}` : '—'
}

type ParteHistorial =
  | { kind: 'cambio'; label: string; from: string; to: string }
  | { kind: 'texto'; text: string }

function partesHistorial(texto: string): ParteHistorial[] {
  return texto
    .split(/\s*\|\s*/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const cambio = chunk.match(/^([^:]+):\s*(.+?)\s*(?:→|->)\s*(.+)$/)
      if (cambio) {
        return {
          kind: 'cambio' as const,
          label: cambio[1].trim(),
          from: cambio[2].trim(),
          to: cambio[3].trim()
        }
      }
      return { kind: 'texto' as const, text: chunk }
    })
}

function inicialesNombre(nombre: string): string {
  const parts = nombre.split(/\s+/).filter((p) => p && !/^\d+$/.test(p))
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()
}

/** Fila estándar: solo renderiza si hay contenido */
function Kv({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div className="task-view-kv-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Texto largo: siempre visible si hay string (incluso vacío mostramos guión opcional) */
function KvBlock({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value?.trim()
  return (
    <div className="task-view-kv-block">
      <h4 className="task-view-kv-block-title">{label}</h4>
      <div className="task-view-kv-block-body">{v ? v : <span className="task-view-empty">Sin datos cargados</span>}</div>
    </div>
  )
}

export default function TaskViewModal({
  task,
  teamMembers,
  sectores,
  onClose,
  exhaustiveDetail = false,
  allowEdit = false,
  onRequestEdit,
  onRestartEnTablero
}: TaskViewModalProps) {
  const { getTagColor, loadTagColor } = useTagColors()
  const [tagColorsCache, setTagColorsCache] = useState<Map<string, string>>(() => new Map())
  const [plotAIRecoOpen, setPlotAIRecoOpen] = useState(false)
  const [plotAIRecoLoading, setPlotAIRecoLoading] = useState(false)
  const [plotAIRecoText, setPlotAIRecoText] = useState('')
  const [plotAIRecoError, setPlotAIRecoError] = useState<string | null>(null)
  const [historial, setHistorial] = useState<HistorialMovimiento[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [historialError, setHistorialError] = useState<string | null>(null)
  const [fichaPdfEmbedOpen, setFichaPdfEmbedOpen] = useState(false)

  const [resolvedFromApi, setResolvedFromApi] = useState<Task | null>(null)
  const [exhaustiveLoading, setExhaustiveLoading] = useState(false)
  const [exhaustiveError, setExhaustiveError] = useState<string | null>(null)
  const [comentariosLib, setComentariosLib] = useState<ComentarioOrden[]>([])
  const [archivosLib, setArchivosLib] = useState<Array<Record<string, unknown>>>([])
  const [restartBusy, setRestartBusy] = useState(false)

  const viewTask = resolvedFromApi ?? task
  const ordenIdView = useMemo(() => parseTaskIdToOrdenId(viewTask.id), [viewTask.id])
  const historialRefreshKey = useMemo(
    () =>
      `${task.visibleEnTablero}|${task.ordenEliminada}|${task.entregado}|${task.status}`,
    [task.visibleEnTablero, task.ordenEliminada, task.entregado, task.status]
  )

  const tagsKey = useMemo(
    () => (viewTask.tags ?? []).map((t) => t.trim()).sort().join('\u0001'),
    [viewTask.tags]
  )

  const owner = teamMembers.find((m) => m.id === viewTask.ownerId)
  const createdByMember = teamMembers.find((m) => m.id === viewTask.createdBy)
  const columnCfg = BOARD_COLUMNS.find((c) => c.id === viewTask.status)
  const columnLabel = columnCfg?.label ?? mapStatusToEstado(viewTask.status)
  const sectorColor = sectores.find((s) => s.nombre === viewTask.assignedSector)?.color ?? '#eb671b'

  const impactLabel = useMemo(() => {
    const i = viewTask.impact
    if (i === 'alta') return 'Alta'
    if (i === 'media') return 'Media'
    return 'Baja'
  }, [viewTask.impact])

  useEffect(() => {
    setFichaPdfEmbedOpen(false)
  }, [ordenIdView])

  useEffect(() => {
    if (!exhaustiveDetail) return
    setResolvedFromApi((prev) => {
      if (!prev || prev.id !== task.id) return prev
      return { ...prev, ...task }
    })
  }, [
    exhaustiveDetail,
    task.id,
    task.visibleEnTablero,
    task.ordenEliminada,
    task.entregado,
    task.status,
    task.assignedSector
  ])

  /** Colores de etiquetas: antes se llamaba `loadTagColor` en cada render → re-renders en cascada y tildado. */
  useEffect(() => {
    const tags = viewTask.tags ?? []
    if (!tags.length) return
    let cancelled = false
    void (async () => {
      const pairs: Array<{ key: string; color: string }> = []
      const seen = new Set<string>()
      for (const tag of tags) {
        const key = tag.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        pairs.push({ key, color: await loadTagColor(tag) })
      }
      if (cancelled || !pairs.length) return
      setTagColorsCache((prev) => {
        const next = new Map(prev)
        for (const { key, color } of pairs) {
          if (!next.has(key)) next.set(key, color)
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [tagsKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (plotAIRecoOpen) {
        setPlotAIRecoOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, plotAIRecoOpen])

  useEffect(() => {
    if (!ordenIdView) {
      setHistorial([])
      return
    }
    if (exhaustiveDetail) {
      return
    }
    let cancelled = false
    setHistorialLoading(true)
    setHistorialError(null)
    void apiService
      .getHistorialMovimientos({ ordenId: ordenIdView, limit: HISTORIAL_LIMIT_VISTA_RAPIDA })
      .then((r) => {
      if (cancelled) return
      setHistorialLoading(false)
      if (r.success && r.data) {
        setHistorial(
          [...r.data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        )
      } else {
        setHistorial([])
        setHistorialError(r.error || 'No se pudo cargar el historial.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [ordenIdView, exhaustiveDetail, historialRefreshKey])

  useEffect(() => {
    setResolvedFromApi(null)
    setComentariosLib([])
    setArchivosLib([])
    setExhaustiveError(null)
    if (!exhaustiveDetail || !ordenIdView) {
      setExhaustiveLoading(false)
      return
    }
    let cancelled = false
    setExhaustiveLoading(true)
    setHistorialLoading(true)
    setHistorialError(null)
    void (async () => {
      try {
        const [ordResp, comResp, archResp, histResp] = await Promise.all([
          apiService.getOrden(ordenIdView),
          apiService.getComentariosOrden(ordenIdView),
          apiService.getArchivosOrden(ordenIdView),
          apiService.getHistorialMovimientos({ ordenId: ordenIdView, limit: HISTORIAL_LIMIT_BIBLIOTECA })
        ])
        if (cancelled) return
        if (ordResp.success && ordResp.data) {
          setResolvedFromApi(ordenToTask(ordResp.data))
        }
        if (comResp.success && comResp.data) {
          setComentariosLib(comResp.data as ComentarioOrden[])
        }
        if (archResp.success && archResp.data) {
          setArchivosLib((archResp.data as Record<string, unknown>[]) ?? [])
        }
        if (histResp.success && histResp.data) {
          setHistorial(
            [...histResp.data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          )
          setHistorialError(null)
        } else {
          setHistorial([])
          setHistorialError(histResp.error || 'No se pudo cargar el historial.')
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setExhaustiveError(e instanceof Error ? e.message : 'Error al cargar el detalle completo.')
        }
      } finally {
        if (!cancelled) {
          setExhaustiveLoading(false)
          setHistorialLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [exhaustiveDetail, ordenIdView, historialRefreshKey])

  // Modal solo lectura (tablero): también mostrar adjuntos del grupo.
  useEffect(() => {
    if (!ordenIdView || exhaustiveDetail) return
    let cancelled = false
    void apiService.getArchivosOrden(ordenIdView).then((archResp) => {
      if (cancelled) return
      if (archResp.success && archResp.data) {
        setArchivosLib((archResp.data as Record<string, unknown>[]) ?? [])
      } else {
        setArchivosLib([])
      }
    })
    return () => {
      cancelled = true
    }
  }, [ordenIdView, exhaustiveDetail])

  const openPlotAIRecommendations = () => {
    setPlotAIRecoOpen(true)
    setPlotAIRecoError(null)
    setPlotAIRecoText('')
    setPlotAIRecoLoading(true)
    void fetchPlotAIRecommendationsForTask(viewTask, columnLabel)
      .then((text) => {
        setPlotAIRecoText(text.trim())
      })
      .catch((err) => {
        setPlotAIRecoError(err instanceof Error ? err.message : 'No se pudo obtener la recomendación.')
      })
      .finally(() => {
        setPlotAIRecoLoading(false)
      })
  }

  const plotAIRecoHtml = useMemo(() => {
    const t = plotAIRecoText.trim()
    if (!t) return ''
    try {
      return sanitizeHtml(marked.parse(t, { async: false }) as string)
    } catch {
      return ''
    }
  }, [plotAIRecoText])

  const opLabel = viewTask.esFichaNoOP ? 'Ficha' : 'OP'
  const progress = Math.min(100, Math.max(0, viewTask.progress))

  return (
    <div
      className={`modal-overlay task-view-overlay${exhaustiveDetail ? ' task-view-overlay--exhaustive' : ''}`}
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        className={`modal-content task-view-modal${viewTask.enReclamo ? ' task-view-modal--reclamo' : ''}${exhaustiveDetail ? ' task-view-modal--exhaustive' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-view-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="task-view-header">
          <div className="task-view-header-accent" style={{ background: `linear-gradient(90deg, ${sectorColor}, #6366f1)` }} />
          <div className="task-view-header-inner">
            <div className="task-view-header-titles">
              <p className="task-view-op-pill" id="task-view-heading">
                <span className="task-view-op-label">{opLabel}</span>
                <span className="task-view-op-num">#{viewTask.opNumber}</span>
              </p>
              <h2 className="task-view-main-title">{viewTask.title}</h2>
              <p className="task-view-column-line">
                Columna actual:{' '}
                <strong>{columnCfg?.label ?? mapStatusToEstado(viewTask.status)}</strong>
                {columnCfg?.description ? ` · ${columnCfg.description}` : ''}
              </p>
            </div>
            <div className="task-view-header-actions">
              {onRestartEnTablero && (
                <button
                  type="button"
                  className="task-view-close task-view-close--secondary task-view-restart-tablero"
                  disabled={restartBusy}
                  onClick={() => {
                    setRestartBusy(true)
                    void Promise.resolve(onRestartEnTablero()).finally(() => setRestartBusy(false))
                  }}
                  aria-label="Restart — volver a mostrar en tablero"
                  title="Vuelve a mostrar la ficha en el tablero (visible, no eliminada, no entregada/archivada)"
                >
                  {restartBusy ? '…' : 'Restart'}
                </button>
              )}
              {allowEdit && onRequestEdit && (
                <button
                  type="button"
                  className="task-view-close task-view-close--secondary"
                  onClick={() => onRequestEdit(viewTask)}
                  aria-label="Editar"
                >
                  Editar
                </button>
              )}
              <button type="button" className="task-view-close" onClick={onClose} aria-label="Cerrar">
                Cerrar
              </button>
            </div>
          </div>
        </header>

        <div className="modal-body task-view-body">
          {viewTask.enReclamo && (
            <div className="task-view-reclamo-banner" role="status">
              <span className="task-view-reclamo-banner-icon" aria-hidden>
                <ReclamoTriangleIcon size={28} />
              </span>
              <div className="task-view-reclamo-banner-text">
                <strong>Reclamo — el trabajo debe rehacerse</strong>
                {viewTask.reclamoMotivo?.trim() ? (
                  <p className="task-view-reclamo-motivo">{viewTask.reclamoMotivo.trim()}</p>
                ) : (
                  <p className="task-view-reclamo-sin-motivo">No se cargó un motivo detallado al marcar el reclamo.</p>
                )}
              </div>
            </div>
          )}
          {exhaustiveLoading && exhaustiveDetail && (
            <p className="task-view-exhaustive-loading" role="status">
              Cargando ficha completa desde el servidor (movimientos, adjuntos, comentarios, trazados…)…
            </p>
          )}
          {exhaustiveError && exhaustiveDetail && (
            <p className="task-view-historial-error" role="alert">
              {exhaustiveError}
            </p>
          )}
          <div
            className={
              exhaustiveDetail
                ? 'task-view-banner'
                : 'task-view-banner task-view-banner--with-action'
            }
          >
            <span className="task-view-banner-icon" aria-hidden="true">
              👁
            </span>
            <div className="task-view-banner-copy">
              <strong>{exhaustiveDetail ? 'Biblioteca · detalle completo' : 'Vista expandida · solo lectura'}</strong>
              <p>
                {exhaustiveDetail
                  ? allowEdit
                    ? 'Todos los datos se cargan desde la base. Podés editar desde esta vista.'
                    : 'Todos los datos se cargan desde la base; no se puede editar desde aquí.'
                  : 'Para editar usá el botón ✏️ en la tarjeta del tablero.'}
              </p>
            </div>
            {!exhaustiveDetail && (
              <button
                type="button"
                className="task-view-plotai-reco-btn"
                onClick={openPlotAIRecommendations}
                disabled={plotAIRecoLoading}
              >
                {plotAIRecoLoading ? 'Generando…' : 'Recomendación de PlotAI'}
              </button>
            )}
          </div>

          <section className="task-view-hero-card">
            <div className="task-view-hero-main">
              <div className="task-view-tags-hero">
                <h3 className="task-view-tags-hero-title">Etiquetas</h3>
                {viewTask.tags?.length ? (
                  <div className="task-view-tags-hero-row" role="list">
                    {viewTask.tags.map((tag) => {
                      const color = tagColorsCache.get(tag.toLowerCase()) || getTagColor(tag)
                      return (
                        <span
                          key={tag}
                          role="listitem"
                          className="task-view-tag-pill"
                          style={{
                            background: color,
                            border: `2px solid ${color}`,
                            color: '#ffffff',
                            fontWeight: 600,
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)'
                          }}
                        >
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <p className="task-view-empty task-view-tags-hero-empty">Sin etiquetas</p>
                )}
              </div>

              <div className="task-view-chip-row">
                <span className={`task-view-chip task-view-chip--priority task-view-chip--${viewTask.priority}`}>
                  Prioridad {viewTask.priority}
                </span>
                <span className="task-view-chip task-view-chip--impact">Impacto {impactLabel}</span>
                {viewTask.assignedSector && (
                  <span
                    className="task-view-chip task-view-chip--sector"
                    style={{
                      borderColor: sectorColor,
                      background: `${sectorColor}24`,
                      color: '#fff'
                    }}
                  >
                    {viewTask.assignedSector}
                  </span>
                )}
                <OpCobroPill
                  marcadaPagada={viewTask.marcadaPagada}
                  sinPago={viewTask.sinPago}
                  pagoCuentaCorriente={viewTask.pagoCuentaCorriente}
                  montoPagoParcial={viewTask.montoPagoParcial}
                  className="task-view-chip task-view-chip--pagado"
                />
                {viewTask.entregado && <span className="task-view-chip task-view-chip--ok">Entregado</span>}
                {viewTask.esDuplicado && <span className="task-view-chip">Duplicado</span>}
                {viewTask.esSubTarea && <span className="task-view-chip">Subtarea</span>}
                {viewTask.origenPedidoWeb && <span className="task-view-chip task-view-chip--web">Pedido web</span>}
                {viewTask.esUrgencia && <span className="task-view-chip task-view-chip--urgent">Urgencia</span>}
                {viewTask.enReclamo && (
                  <span className="task-view-chip task-view-chip--reclamo">
                    <ReclamoTriangleIcon size={14} /> Reclamo
                  </span>
                )}
              </div>

              <div className="task-view-progress-wrap">
                <div className="task-view-progress-labels">
                  <span>Avance del trabajo</span>
                  <span className="task-view-progress-pct">{progress}%</span>
                </div>
                <div className="task-view-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="task-view-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="task-view-progress-meta">
                  <span>{viewTask.storyPoints} pts historia</span>
                  {viewTask.subtaskProgress != null && <span>Subtareas: {viewTask.subtaskProgress}%</span>}
                  {viewTask.subtaskTimeSpentSec != null && viewTask.subtaskTimeSpentSec > 0 && (
                    <span>Tiempo en subtareas: {formatSeconds(viewTask.subtaskTimeSpentSec)}</span>
                  )}
                </div>
              </div>

              <div className="task-view-dates-row">
                <div className="task-view-date-card">
                  <span className="task-view-date-label">Alta</span>
                  <span className="task-view-date-value">{formatDisplayDate(viewTask.createdAt) ?? viewTask.createdAt}</span>
                </div>
                <div className="task-view-date-card">
                  <span className="task-view-date-label">Vencimiento</span>
                  <span className="task-view-date-value">{formatDisplayDate(viewTask.dueDate) ?? viewTask.dueDate}</span>
                </div>
                <div className="task-view-date-card">
                  <span className="task-view-date-label">Última actividad</span>
                  <span className="task-view-date-value">{formatDisplayDate(viewTask.updatedAt) ?? viewTask.updatedAt}</span>
                </div>
              </div>
            </div>

            {viewTask.photoUrl ? (
              <div className="task-view-hero-photo">
                <img src={viewTask.photoUrl} alt="Referencia del trabajo" loading="lazy" />
              </div>
            ) : (
              <div className="task-view-hero-photo task-view-hero-photo--empty">Sin imagen</div>
            )}
          </section>

          {viewTask.galeriaCarrusel && viewTask.galeriaCarrusel.length > 0 ? (
            <section className="task-view-galeria-section" aria-label="Galería de la OP">
              <h3 className="task-view-galeria-title">Galería</h3>
              <p className="task-view-galeria-sub">Miniaturas visibles. Tocá una para verla grande.</p>
              <OpGaleriaCarousel slides={viewTask.galeriaCarrusel} />
            </section>
          ) : null}

          <KvBlock label="Descripción / resumen" value={viewTask.summary} />

          {viewTask.fichaTecnicaPdfUrl ? (
            <section className="task-view-panel" style={{ marginTop: 14 }}>
              <h3 className="task-view-panel-title">Ficha técnica (PDF)</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.open(viewTask.fichaTecnicaPdfUrl as string, '_blank', 'noopener,noreferrer')}
                >
                  Ver
                </button>
                <a
                  className="btn-secondary"
                  href={viewTask.fichaTecnicaPdfUrl as string}
                  download={`Ficha-Tecnica-${viewTask.opNumber || 'sin-op'}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar
                </a>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setFichaPdfEmbedOpen((o) => !o)}
                  aria-expanded={fichaPdfEmbedOpen}
                >
                  {fichaPdfEmbedOpen ? 'Ocultar vista embebida' : 'Mostrar PDF aquí (más pesado)'}
                </button>
              </div>
              {fichaPdfEmbedOpen ? (
                <iframe
                  src={viewTask.fichaTecnicaPdfUrl as string}
                  title={`Ficha técnica ${viewTask.opNumber || ''}`}
                  style={{
                    width: '100%',
                    height: 520,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    background: '#0b1020'
                  }}
                />
              ) : null}
            </section>
          ) : null}

          <div className="task-view-mega-grid">
            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Equipo</h3>
              <dl className="task-view-kv">
                <Kv label="Responsable">{owner?.name ?? viewTask.ownerId}</Kv>
                <Kv label="Creado por">
                  {createdByMember?.name ?? etiquetaUsuarioNombre(viewTask.createdBy)}
                </Kv>
                <Kv label="Trabajando ahora">{viewTask.workingUser}</Kv>
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Cliente & contacto</h3>
              <dl className="task-view-kv">
                <Kv label="Nombre completo">{viewTask.clienteNombreCompleto}</Kv>
                <Kv label="Empresa">{viewTask.clienteEmpresa}</Kv>
                <Kv label="Teléfono">
                  {viewTask.clientPhone || viewTask.whatsappUrl ? (
                    <span className="task-view-phone-line">
                      {viewTask.clientPhone ? <span>{viewTask.clientPhone}</span> : null}
                      <a
                        className="contact-pill whatsapp contact-pill--compact task-view-wa"
                        href={
                          viewTask.whatsappUrl ||
                          `https://wa.me/${encodeURIComponent(String(viewTask.clientPhone).replace(/[^0-9]/g, ''))}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir WhatsApp"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        WhatsApp
                      </a>
                    </span>
                  ) : null}
                </Kv>
                <Kv label="Email">{viewTask.clientEmail}</Kv>
                <Kv label="DNI / CUIT">{viewTask.dniCuit}</Kv>
                <Kv label="Dirección">{viewTask.clientAddress}</Kv>
                {viewTask.driveUrl && (
                  <Kv label="Google Drive">
                    <a href={viewTask.driveUrl} target="_blank" rel="noreferrer">
                      Abrir carpeta / archivo
                    </a>
                  </Kv>
                )}
                {viewTask.locationUrl && (
                  <Kv label="Ubicación">
                    <a href={viewTask.locationUrl} target="_blank" rel="noreferrer">
                      Ver en mapa
                    </a>
                  </Kv>
                )}
                {viewTask.fichaTecnicaPdfUrl && (
                  <Kv label="Ficha técnica (PDF)">
                    <a href={viewTask.fichaTecnicaPdfUrl} target="_blank" rel="noreferrer">
                      Descargar / ver PDF
                    </a>
                  </Kv>
                )}
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Materiales & m²</h3>
              <dl className="task-view-kv">
                <Kv label="Tipo impresión (texto libre)">{viewTask.tipoImpresion}</Kv>
                <Kv label="Lista">{viewTask.materials?.length ? viewTask.materials.join(' · ') : null}</Kv>
                <Kv label="Metros cuadrados (total OP)">
                  {viewTask.metrosCuadrados != null ? `${Number(viewTask.metrosCuadrados).toFixed(2)} m²` : null}
                </Kv>
              </dl>
              {viewTask.lineasMetrosM2 && viewTask.lineasMetrosM2.length > 0 ? (
                <div className="task-view-lineas-m2-readonly" aria-label="Ítems con metros, solo lectura">
                  <h4 className="task-view-lineas-m2-title">Ítems con metros (solo lectura)</h4>
                  <ul className="task-view-lineas-m2-list">
                    {viewTask.lineasMetrosM2.map((r, idx) => (
                      <li key={r.id ?? idx} className="task-view-lineas-m2-item">
                        <span className="task-view-lineas-m2-nombre">
                          {(r.tipo || '').trim() || 'Ítem sin nombre'}
                        </span>
                        <span className="task-view-lineas-m2-m2">
                          {Number(r.metrosCuadrados || 0).toFixed(2)} m²
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>

          {!exhaustiveDetail && viewTask.subtasks && viewTask.subtasks.length > 0 && (
            <section className="task-view-panel task-view-panel--subtasks">
              <h3 className="task-view-panel-title">Subtareas ({viewTask.subtasks.length})</h3>
              <ul className="task-view-subtasks">
                {viewTask.subtasks.map((s) => (
                  <li key={s.id} className={s.done ? 'is-done' : ''}>
                    <span className="task-view-subtask-check" aria-hidden="true">
                      {s.done ? '✓' : '○'}
                    </span>
                    <span className="task-view-subtask-text">{s.title}</span>
                    {s.estimatedMinutes != null && (
                      <span className="task-view-subtask-meta">~{s.estimatedMinutes} min</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ordenIdView != null && (
            <>
              {exhaustiveDetail && (
                <>
                  <section className="task-view-panel task-view-panel--wide" aria-label="Checklist en vivo">
                    <h3 className="task-view-panel-title">Checklist (subtareas en BD)</h3>
                    <Subtasks ordenId={ordenIdView} readOnly />
                  </section>

                  <section className="task-view-panel task-view-panel--wide" aria-label="Comentarios">
                    <h3 className="task-view-panel-title">Comentarios en la OP</h3>
                    {comentariosLib.length === 0 ? (
                      <p className="task-view-muted">Sin comentarios registrados.</p>
                    ) : (
                      <ul className="task-view-comentarios-thread">
                        {comentariosLib.map((c) => (
                          <li key={c.id} className="task-view-comentario-item">
                            <div className="task-view-historial-meta">
                              <time dateTime={c.timestamp}>{formatDisplayDate(c.timestamp) ?? c.timestamp}</time>
                              <span className="task-view-historial-user">{c.usuario_nombre}</span>
                            </div>
                            <p className="task-view-historial-body">{c.comentario}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}

              <section className="task-view-panel task-view-panel--wide" aria-label="Archivos y enlaces">
                <h3 className="task-view-panel-title">Archivos, fotos y enlaces adjuntos</h3>
                {archivosLib.length === 0 ? (
                  <p className="task-view-muted">Sin adjuntos en enlaces_adjuntos.</p>
                ) : (
                  <ul className="task-view-archivos-grid">
                    {(() => {
                      const seen = new Set<string>()
                      const rows = archivosLib.filter((a) => {
                        const u = String((a as any)?.url ?? '').trim()
                        if (!u) return false
                        if (seen.has(u)) return false
                        seen.add(u)
                        return true
                      })
                      return rows
                    })().map((a) => {
                      const id = Number(a.id)
                      const titulo = (a.titulo != null ? String(a.titulo) : '') || 'Adjunto'
                      const url = String(a.url ?? '')
                      const creado = a.creado_en != null ? String(a.creado_en) : ''
                      const evidencia = a.es_evidencia_campo === true
                      const relev = a.origen_relevamiento === true
                      const isImg = /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url)
                      return (
                        <li key={Number.isFinite(id) ? id : url} className="task-view-archivo-card">
                          <div className="task-view-archivo-meta">
                            <strong>{titulo}</strong>
                            {creado ? (
                              <span className="task-view-muted">{formatDisplayDate(creado) ?? creado}</span>
                            ) : null}
                            {evidencia ? (
                              <span className="task-view-chip task-view-chip--sector">Evidencia campo</span>
                            ) : null}
                            {relev ? <span className="task-view-chip">Relevamiento</span> : null}
                          </div>
                          {isImg ? (
                            <a href={url} target="_blank" rel="noreferrer" className="task-view-archivo-thumb-wrap">
                              <img src={url} alt="" className="task-view-archivo-thumb" loading="lazy" />
                            </a>
                          ) : null}
                          <a href={url} target="_blank" rel="noreferrer" className="task-view-archivo-link">
                            Abrir / descargar
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

            </>
          )}

          {ordenIdView != null && (
            <section className="task-view-panel task-view-panel--wide task-view-historial" aria-label="Historial de cambios">
              <h3 className="task-view-panel-title">
                Historial de cambios
                {!historialLoading && historial.length > 0 ? (
                  <span className="task-view-historial-count">{historial.length}</span>
                ) : null}
              </h3>
              {historialLoading && <p className="task-view-muted">Cargando historial…</p>}
              {historialError && (
                <p className="task-view-historial-error" role="alert">
                  {historialError}
                </p>
              )}
              {!historialLoading && !historialError && historial.length === 0 && (
                <p className="task-view-muted">No hay movimientos registrados para esta ficha.</p>
              )}
              {!historialLoading && historial.length > 0 && (
                <ul className="task-view-historial-thread">
                  {historial.map((m) => {
                    const quien = nombreEnHistorial(m, teamMembers)
                    const detalle = describeHistorialMovimiento(m)
                    const partes = partesHistorial(detalle)
                    return (
                      <li key={m.id} className="task-view-historial-item">
                        <div className="task-view-historial-meta">
                          <time className="task-view-historial-time" dateTime={m.timestamp}>
                            {formatDisplayDate(m.timestamp) ?? m.timestamp}
                          </time>
                          <span className="task-view-historial-user" title={quien}>
                            <span className="task-view-historial-avatar" aria-hidden="true">
                              {inicialesNombre(quien)}
                            </span>
                            {quien}
                          </span>
                          {m.accion_tipo ? (
                            <span className="task-view-historial-accion">
                              {etiquetaAccionHistorial(m.accion_tipo)}
                            </span>
                          ) : null}
                        </div>
                        <div className="task-view-historial-body">
                          {partes.map((p, i) =>
                            p.kind === 'cambio' ? (
                              <span key={i} className="task-view-historial-cambio">
                                <span className="task-view-historial-cambio-label">{p.label}</span>
                                <span className="task-view-historial-from">{p.from}</span>
                                <span className="task-view-historial-arrow" aria-hidden="true">
                                  →
                                </span>
                                <span className="task-view-historial-to">{p.to}</span>
                              </span>
                            ) : (
                              <span key={i} className="task-view-historial-texto">
                                {p.text}
                              </span>
                            )
                          )}
                        </div>
                        {exhaustiveDetail && m.cambios_detallados ? (
                          <pre className="task-view-historial-json">{formatCambiosJson(m.cambios_detallados)}</pre>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          <footer className="task-view-footer">
            <span>ID interno: {viewTask.id}</span>
            {viewTask.briefToken && <span>Brief token: configurado</span>}
            {viewTask.ordenEliminada && (
              <span className="task-view-footer-warn">OP eliminada (lógico) · motivo: {viewTask.motivoEliminacion ?? '—'}</span>
            )}
            {viewTask.fechaEliminacion && (
              <span className="task-view-muted">Eliminada: {formatDisplayDate(viewTask.fechaEliminacion) ?? viewTask.fechaEliminacion}</span>
            )}
          </footer>
        </div>
      </div>

      {plotAIRecoOpen && (
        <div
          className="task-view-reco-backdrop"
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            setPlotAIRecoOpen(false)
          }}
        >
          <div
            className="task-view-reco-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-view-reco-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="task-view-reco-header">
              <h2 id="task-view-reco-heading">Recomendación de PlotAI</h2>
              <button
                type="button"
                className="task-view-reco-close"
                onClick={() => setPlotAIRecoOpen(false)}
                aria-label="Cerrar recomendaciones"
              >
                Cerrar
              </button>
            </header>
            <div className="task-view-reco-body">
              {plotAIRecoLoading && (
                <p className="task-view-reco-status" role="status">
                  Analizando la ficha y generando recomendaciones, ideas y buenas prácticas…
                </p>
              )}
              {plotAIRecoError && (
                <p className="task-view-reco-error" role="alert">
                  {plotAIRecoError}
                </p>
              )}
              {!plotAIRecoLoading && plotAIRecoHtml ? (
                <div
                  className="task-view-reco-content markdown-body"
                  dangerouslySetInnerHTML={{ __html: plotAIRecoHtml }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
