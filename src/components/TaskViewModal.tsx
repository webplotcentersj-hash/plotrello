import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import { sanitizeHtml } from '../utils/sanitizeHtml'
import type { Task, TeamMember } from '../types/board'
import type {
  ComentarioOrden,
  HistorialMovimiento,
  OrdenRelevamientoRecord,
  RegistroTiempo,
  RelevamientoSubitemRecord,
  RevisionOrden,
  SectorRecord
} from '../types/api'
import apiService from '../services/api'
import { ordenToTask, parseTaskIdToOrdenId, mapStatusToEstado } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { useTagColors } from '../hooks/useTagColors'
import { fetchPlotAIRecommendationsForTask } from '../utils/taskPlotAIRecommendations'
import ReclamoTriangleIcon from './ReclamoTriangleIcon'
import OpGaleriaCarousel from './OpGaleriaCarousel'
import Subtasks from './Subtasks'
import HistorialEtapasTallerGrafico from './HistorialEtapasTallerGrafico'
import HistorialEtapasInstalaciones from './HistorialEtapasInstalaciones'
import HistorialEtapasTallerImprenta from './HistorialEtapasTallerImprenta'
import HistorialEtapasMetalurgica from './HistorialEtapasMetalurgica'
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

function YesNo(v: boolean | null | undefined) {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return null
}

function describeHistorialMovimiento(m: HistorialMovimiento): string {
  const c = m.comentario?.trim()
  if (c) return c
  const ea = m.estado_anterior?.trim()
  const en = m.estado_nuevo?.trim()
  if (ea || en) return `${ea || '—'} → ${en || '—'}`
  const at = m.accion_tipo?.trim()
  return at ? `Acción: ${at}` : 'Registro sin detalle'
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
  const [relevamientoLib, setRelevamientoLib] = useState<OrdenRelevamientoRecord | null>(null)
  const [relevSubLib, setRelevSubLib] = useState<RelevamientoSubitemRecord[]>([])
  const [revisionesLib, setRevisionesLib] = useState<RevisionOrden[]>([])
  const [tiempoLib, setTiempoLib] = useState<RegistroTiempo[]>([])
  const [restartBusy, setRestartBusy] = useState(false)

  const viewTask = resolvedFromApi ?? task
  const ordenIdView = useMemo(() => parseTaskIdToOrdenId(viewTask.id), [viewTask.id])

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
  }, [ordenIdView, exhaustiveDetail])

  useEffect(() => {
    setResolvedFromApi(null)
    setComentariosLib([])
    setArchivosLib([])
    setRelevamientoLib(null)
    setRelevSubLib([])
    setRevisionesLib([])
    setTiempoLib([])
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
        const [
          ordResp,
          comResp,
          archResp,
          relResp,
          relSubResp,
          revResp,
          tiempoResp,
          histResp
        ] = await Promise.all([
          apiService.getOrden(ordenIdView),
          apiService.getComentariosOrden(ordenIdView),
          apiService.getArchivosOrden(ordenIdView),
          apiService.getOrdenRelevamiento(ordenIdView),
          apiService.getRelevamientoSubitems(ordenIdView),
          apiService.obtenerRevisionesOrden(ordenIdView),
          apiService.obtenerTiempoTrabajoOrden(ordenIdView),
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
        if (relResp.success && relResp.data) {
          setRelevamientoLib(relResp.data as OrdenRelevamientoRecord)
        }
        if (relSubResp.success && relSubResp.data) {
          setRelevSubLib(relSubResp.data as RelevamientoSubitemRecord[])
        }
        if (revResp.success && revResp.data) {
          setRevisionesLib(revResp.data as RevisionOrden[])
        }
        if (tiempoResp.success && tiempoResp.data) {
          setTiempoLib(tiempoResp.data as RegistroTiempo[])
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
  }, [exhaustiveDetail, ordenIdView])

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
                <Kv label="Creado por">{createdByMember?.name ?? viewTask.createdBy}</Kv>
                <Kv label="Trabajando ahora">{viewTask.workingUser}</Kv>
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Cliente & contacto</h3>
              <dl className="task-view-kv">
                <Kv label="Nombre completo">{viewTask.clienteNombreCompleto}</Kv>
                <Kv label="Empresa">{viewTask.clienteEmpresa}</Kv>
                <Kv label="Teléfono">{viewTask.clientPhone}</Kv>
                <Kv label="Email">{viewTask.clientEmail}</Kv>
                <Kv label="DNI / CUIT">{viewTask.dniCuit}</Kv>
                <Kv label="Dirección">{viewTask.clientAddress}</Kv>
                {viewTask.whatsappUrl && (
                  <Kv label="WhatsApp">
                    <a href={viewTask.whatsappUrl} target="_blank" rel="noreferrer">
                      Abrir conversación
                    </a>
                  </Kv>
                )}
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
              <h3 className="task-view-panel-title">Sectores & recorrido</h3>
              <dl className="task-view-kv">
                <Kv label="Sector asignado">{viewTask.assignedSector}</Kv>
                <Kv label="Sectores requeridos">{viewTask.sectores?.length ? viewTask.sectores.join(' · ') : null}</Kv>
                <Kv label="Sector inicial">{viewTask.sectorInicial}</Kv>
                <Kv label="Ubicación en taller (final)">{viewTask.finalLocation}</Kv>
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Checklist & pedido</h3>
              <dl className="task-view-kv">
                <Kv label="Planilla preliminar">{YesNo(viewTask.planillaPreliminar)}</Kv>
                <Kv label="Ficha técnica incompleta (manual)">{YesNo(viewTask.fichaTecnicaIncompleta)}</Kv>
                <Kv label="Ficha técnica cargada">{YesNo(viewTask.fichaTecnicaCargada)}</Kv>
                <Kv label="Presupuesto enviado al cliente">{YesNo(viewTask.presupuestoEnviadoCliente)}</Kv>
                <Kv label="Estado revisión">{viewTask.estadoRevision}</Kv>
                <Kv label="ID pedido cliente">{viewTask.idPedidoCliente != null ? String(viewTask.idPedidoCliente) : null}</Kv>
                {viewTask.esDuplicado && <Kv label="ID orden original">{viewTask.idOrdenOriginal != null ? String(viewTask.idOrdenOriginal) : null}</Kv>}
                {viewTask.esSubTarea && <Kv label="ID ficha principal">{viewTask.idFichaPrincipal}</Kv>}
              </dl>
            </section>

            <section className="task-view-panel task-view-panel--wide">
              <h3 className="task-view-panel-title">Etapas por área</h3>
              <dl className="task-view-kv task-view-kv--dense">
                <Kv label="Taller gráfico">
                  {viewTask.etapaTallerGrafico}
                  {viewTask.etapaTallerGraficoFechaInicio
                    ? ` · desde ${formatDisplayDate(viewTask.etapaTallerGraficoFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Instalaciones">
                  {viewTask.etapaInstalaciones}
                  {viewTask.etapaInstalacionesFechaInicio
                    ? ` · desde ${formatDisplayDate(viewTask.etapaInstalacionesFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Taller imprenta">
                  {viewTask.etapaTallerImprenta}
                  {viewTask.etapaTallerImprentaFechaInicio
                    ? ` · desde ${formatDisplayDate(viewTask.etapaTallerImprentaFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Impresión digital">
                  {viewTask.etapaImpresionDigital}
                  {viewTask.etapaImpresionDigitalFechaInicio
                    ? ` · desde ${formatDisplayDate(viewTask.etapaImpresionDigitalFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Metalúrgica">
                  {viewTask.etapaMetalurgica}
                  {viewTask.etapaMetalurgicaFechaInicio
                    ? ` · desde ${formatDisplayDate(viewTask.etapaMetalurgicaFechaInicio)}`
                    : null}
                </Kv>
              </dl>
            </section>

            <section className="task-view-panel task-view-panel--wide">
              <h3 className="task-view-panel-title">Brief público / proyecto</h3>
              <dl className="task-view-kv">
                <Kv label="Brief (texto)">{viewTask.briefPublico}</Kv>
                <Kv label="Objetivo del proyecto">{viewTask.objetivoProyecto}</Kv>
                <Kv label="Público objetivo">{viewTask.publicoObjetivo}</Kv>
                <Kv label="Estilo de diseño">{viewTask.estiloDiseno}</Kv>
                <Kv label="Referencias">{viewTask.referencias}</Kv>
                <Kv label="Deadline brief">{formatDisplayDate(viewTask.deadlineBrief ?? viewTask.fechaLimiteBrief)}</Kv>
                <Kv label="Tipo producto / servicio">{viewTask.tipoProductoServicio?.join(', ')}</Kv>
                <Kv label="Tipo (otro)">{viewTask.tipoProductoOtro}</Kv>
                <Kv label="Necesita asesoramiento">{YesNo(viewTask.necesitaAsesoramiento)}</Kv>
                <Kv label="Dónde colocados">{viewTask.dondeColocados}</Kv>
                <Kv label="Digital o impresión">{viewTask.digitalOImpresion}</Kv>
                <Kv label="Cantidades">{viewTask.cantidades}</Kv>
                <Kv label="Material: logo">{viewTask.materialLogo}</Kv>
                <Kv label="Material: textos">{viewTask.materialTextos}</Kv>
                <Kv label="Material: imágenes">{viewTask.materialImagenes}</Kv>
                <Kv label="Tiene referencias">{YesNo(viewTask.tieneReferencias)}</Kv>
                <Kv label="Links de referencias">{viewTask.referenciasLinks}</Kv>
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

              <section className="task-view-panel task-view-panel--wide" aria-label="Relevamiento campo">
                <h3 className="task-view-panel-title">Relevamiento (app campo)</h3>
                <KvBlock
                  label="Notas de relevamiento"
                  value={relevamientoLib?.notas?.trim() || undefined}
                />
                {relevamientoLib?.actualizado_por ? (
                  <p className="task-view-muted">
                    Última actualización:{' '}
                    {relevamientoLib.actualizado_en
                      ? formatDisplayDate(relevamientoLib.actualizado_en) ?? relevamientoLib.actualizado_en
                      : '—'}{' '}
                    · {relevamientoLib.actualizado_por}
                  </p>
                ) : null}
                {relevSubLib.length > 0 ? (
                  <>
                    <h4 className="task-view-lineas-m2-title">Checklist relevamiento</h4>
                    <ul className="task-view-relev-sublist">
                      {relevSubLib.map((r) => (
                        <li key={r.id}>
                          {r.done ? '✓' : '○'} {r.titulo}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>

              <section className="task-view-panel task-view-panel--wide" aria-label="Revisiones">
                <h3 className="task-view-panel-title">Revisiones de diseño</h3>
                {revisionesLib.length === 0 ? (
                  <p className="task-view-muted">Sin revisiones registradas.</p>
                ) : (
                  <ul className="task-view-comentarios-thread">
                    {revisionesLib.map((r) => (
                      <li key={r.id} className="task-view-comentario-item">
                        <div className="task-view-historial-meta">
                          <time dateTime={r.fecha_revision}>
                            {formatDisplayDate(r.fecha_revision) ?? r.fecha_revision}
                          </time>
                          <span className="task-view-historial-user">{r.usuario_revisor_nombre}</span>
                          <span className="task-view-historial-accion">{r.estado_revision}</span>
                        </div>
                        {r.comentarios?.trim() ? (
                          <p className="task-view-historial-body">{r.comentarios.trim()}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="task-view-panel task-view-panel--wide" aria-label="Tiempo de trabajo">
                <h3 className="task-view-panel-title">Tiempo de trabajo registrado</h3>
                {tiempoLib.length === 0 ? (
                  <p className="task-view-muted">Sin registros de tiempo.</p>
                ) : (
                  <ul className="task-view-comentarios-thread">
                    {tiempoLib.map((reg) => (
                      <li key={reg.id} className="task-view-comentario-item">
                        <div className="task-view-historial-meta">
                          <span>{formatDisplayDate(reg.fecha) ?? reg.fecha}</span>
                          <span className="task-view-historial-user">{reg.usuario_nombre}</span>
                          <span className="task-view-historial-accion">{reg.tipo_trabajo}</span>
                        </div>
                        <p className="task-view-historial-body">
                          {reg.hora_inicio}
                          {reg.hora_fin ? ` → ${reg.hora_fin}` : ''}
                          {reg.tiempo_minutos != null ? ` · ${reg.tiempo_minutos} min` : ''}
                          {reg.descripcion?.trim() ? ` — ${reg.descripcion.trim()}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="task-view-panel task-view-panel--wide" aria-label="Historial etapas taller gráfico">
                <h3 className="task-view-panel-title">Trazado de etapas · Taller Gráfico</h3>
                <HistorialEtapasTallerGrafico ordenId={ordenIdView} />
              </section>
              <section className="task-view-panel task-view-panel--wide" aria-label="Historial etapas instalaciones">
                <h3 className="task-view-panel-title">Trazado de etapas · Instalaciones</h3>
                <HistorialEtapasInstalaciones ordenId={ordenIdView} />
              </section>
              <section className="task-view-panel task-view-panel--wide" aria-label="Historial etapas taller imprenta">
                <h3 className="task-view-panel-title">Trazado de etapas · Taller Imprenta</h3>
                <HistorialEtapasTallerImprenta ordenId={ordenIdView} />
              </section>
              <section className="task-view-panel task-view-panel--wide" aria-label="Historial etapas metalurgica">
                <h3 className="task-view-panel-title">Trazado de etapas · Metalúrgica</h3>
                <HistorialEtapasMetalurgica ordenId={ordenIdView} />
              </section>
            </>
          )}

          {ordenIdView != null && (
            <section className="task-view-panel task-view-panel--wide task-view-historial" aria-label="Historial de cambios">
              <h3 className="task-view-panel-title">Historial de cambios</h3>
              {exhaustiveDetail && (
                <p className="task-view-muted task-view-historial-cap-hint">
                  Hasta {HISTORIAL_LIMIT_BIBLIOTECA} movimientos recientes (detalle biblioteca).
                </p>
              )}
              {!exhaustiveDetail && (
                <p className="task-view-muted task-view-historial-cap-hint">
                  Mostrando hasta los últimos {HISTORIAL_LIMIT_VISTA_RAPIDA} movimientos (vista rápida).
                </p>
              )}
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
                  {historial.map((m) => (
                    <li key={m.id} className="task-view-historial-item">
                      <div className="task-view-historial-meta">
                        <time className="task-view-historial-time" dateTime={m.timestamp}>
                          {formatDisplayDate(m.timestamp) ?? m.timestamp}
                        </time>
                        <span className="task-view-historial-user">
                          {m.nombre_usuario?.trim() || `Usuario #${m.id_usuario}`}
                        </span>
                        {m.accion_tipo ? (
                          <span className="task-view-historial-accion">{m.accion_tipo}</span>
                        ) : null}
                      </div>
                      <p className="task-view-historial-body">{describeHistorialMovimiento(m)}</p>
                      {exhaustiveDetail && m.cambios_detallados ? (
                        <pre className="task-view-historial-json">{formatCambiosJson(m.cambios_detallados)}</pre>
                      ) : null}
                    </li>
                  ))}
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
