import { useEffect, useMemo, type ReactNode } from 'react'
import type { Task, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import { BOARD_COLUMNS } from '../data/mockData'
import './TaskEditModal.css'
import './TaskViewModal.css'

type TaskViewModalProps = {
  task: Task
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  onClose: () => void
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

export default function TaskViewModal({ task, teamMembers, sectores, onClose }: TaskViewModalProps) {
  const owner = teamMembers.find((m) => m.id === task.ownerId)
  const createdByMember = teamMembers.find((m) => m.id === task.createdBy)
  const columnCfg = BOARD_COLUMNS.find((c) => c.id === task.status)
  const sectorColor = sectores.find((s) => s.nombre === task.assignedSector)?.color ?? '#eb671b'

  const impactLabel = useMemo(() => {
    const i = task.impact
    if (i === 'alta') return 'Alta'
    if (i === 'media') return 'Media'
    return 'Baja'
  }, [task.impact])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const opLabel = task.esFichaNoOP ? 'Ficha' : 'OP'
  const progress = Math.min(100, Math.max(0, task.progress))

  return (
    <div className="modal-overlay task-view-overlay" role="presentation" onClick={() => onClose()}>
      <div
        className="modal-content task-view-modal"
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
                <span className="task-view-op-num">#{task.opNumber}</span>
              </p>
              <h2 className="task-view-main-title">{task.title}</h2>
              {columnCfg && (
                <p className="task-view-column-line">
                  Columna actual: <strong>{columnCfg.label}</strong>
                  {columnCfg.description ? ` · ${columnCfg.description}` : ''}
                </p>
              )}
            </div>
            <button type="button" className="task-view-close" onClick={onClose} aria-label="Cerrar">
              Cerrar
            </button>
          </div>
        </header>

        <div className="modal-body task-view-body">
          <div className="task-view-banner">
            <span className="task-view-banner-icon" aria-hidden="true">
              👁
            </span>
            <div>
              <strong>Vista expandida · solo lectura</strong>
              <p>Para editar usá el botón ✏️ en la tarjeta del tablero.</p>
            </div>
          </div>

          <section className="task-view-hero-card">
            <div className="task-view-hero-main">
              <div className="task-view-chip-row">
                <span className={`task-view-chip task-view-chip--priority task-view-chip--${task.priority}`}>
                  Prioridad {task.priority}
                </span>
                <span className="task-view-chip task-view-chip--impact">Impacto {impactLabel}</span>
                {task.assignedSector && (
                  <span
                    className="task-view-chip task-view-chip--sector"
                    style={{
                      borderColor: sectorColor,
                      background: `${sectorColor}24`,
                      color: '#fff'
                    }}
                  >
                    {task.assignedSector}
                  </span>
                )}
                {task.entregado && <span className="task-view-chip task-view-chip--ok">Entregado</span>}
                {task.esDuplicado && <span className="task-view-chip">Duplicado</span>}
                {task.esSubTarea && <span className="task-view-chip">Subtarea</span>}
                {task.origenPedidoWeb && <span className="task-view-chip task-view-chip--web">Pedido web</span>}
                {task.esUrgencia && <span className="task-view-chip task-view-chip--urgent">Urgencia</span>}
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
                  <span>{task.storyPoints} pts historia</span>
                  {task.subtaskProgress != null && <span>Subtareas: {task.subtaskProgress}%</span>}
                  {task.subtaskTimeSpentSec != null && task.subtaskTimeSpentSec > 0 && (
                    <span>Tiempo en subtareas: {formatSeconds(task.subtaskTimeSpentSec)}</span>
                  )}
                </div>
              </div>

              <div className="task-view-dates-row">
                <div className="task-view-date-card">
                  <span className="task-view-date-label">Alta</span>
                  <span className="task-view-date-value">{formatDisplayDate(task.createdAt) ?? task.createdAt}</span>
                </div>
                <div className="task-view-date-card">
                  <span className="task-view-date-label">Vencimiento</span>
                  <span className="task-view-date-value">{formatDisplayDate(task.dueDate) ?? task.dueDate}</span>
                </div>
                <div className="task-view-date-card">
                  <span className="task-view-date-label">Última actividad</span>
                  <span className="task-view-date-value">{formatDisplayDate(task.updatedAt) ?? task.updatedAt}</span>
                </div>
              </div>
            </div>

            {task.photoUrl ? (
              <div className="task-view-hero-photo">
                <img src={task.photoUrl} alt="Referencia del trabajo" loading="lazy" />
              </div>
            ) : (
              <div className="task-view-hero-photo task-view-hero-photo--empty">Sin imagen</div>
            )}
          </section>

          <KvBlock label="Descripción / resumen" value={task.summary} />

          <div className="task-view-mega-grid">
            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Equipo</h3>
              <dl className="task-view-kv">
                <Kv label="Responsable">{owner?.name ?? task.ownerId}</Kv>
                <Kv label="Creado por">{createdByMember?.name ?? task.createdBy}</Kv>
                <Kv label="Trabajando ahora">{task.workingUser}</Kv>
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Cliente & contacto</h3>
              <dl className="task-view-kv">
                <Kv label="Nombre completo">{task.clienteNombreCompleto}</Kv>
                <Kv label="Empresa">{task.clienteEmpresa}</Kv>
                <Kv label="Teléfono">{task.clientPhone}</Kv>
                <Kv label="Email">{task.clientEmail}</Kv>
                <Kv label="DNI / CUIT">{task.dniCuit}</Kv>
                <Kv label="Dirección">{task.clientAddress}</Kv>
                {task.whatsappUrl && (
                  <Kv label="WhatsApp">
                    <a href={task.whatsappUrl} target="_blank" rel="noreferrer">
                      Abrir conversación
                    </a>
                  </Kv>
                )}
                {task.driveUrl && (
                  <Kv label="Google Drive">
                    <a href={task.driveUrl} target="_blank" rel="noreferrer">
                      Abrir carpeta / archivo
                    </a>
                  </Kv>
                )}
                {task.locationUrl && (
                  <Kv label="Ubicación">
                    <a href={task.locationUrl} target="_blank" rel="noreferrer">
                      Ver en mapa
                    </a>
                  </Kv>
                )}
                {task.fichaTecnicaPdfUrl && (
                  <Kv label="Ficha técnica (PDF)">
                    <a href={task.fichaTecnicaPdfUrl} target="_blank" rel="noreferrer">
                      Descargar / ver PDF
                    </a>
                  </Kv>
                )}
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Sectores & recorrido</h3>
              <dl className="task-view-kv">
                <Kv label="Sector asignado">{task.assignedSector}</Kv>
                <Kv label="Sectores requeridos">{task.sectores?.length ? task.sectores.join(' · ') : null}</Kv>
                <Kv label="Sector inicial">{task.sectorInicial}</Kv>
                <Kv label="Ubicación en taller (final)">{task.finalLocation}</Kv>
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Checklist & pedido</h3>
              <dl className="task-view-kv">
                <Kv label="Planilla preliminar">{YesNo(task.planillaPreliminar)}</Kv>
                <Kv label="Ficha técnica cargada">{YesNo(task.fichaTecnicaCargada)}</Kv>
                <Kv label="Presupuesto enviado al cliente">{YesNo(task.presupuestoEnviadoCliente)}</Kv>
                <Kv label="Estado revisión">{task.estadoRevision}</Kv>
                <Kv label="ID pedido cliente">{task.idPedidoCliente != null ? String(task.idPedidoCliente) : null}</Kv>
                {task.esDuplicado && <Kv label="ID orden original">{task.idOrdenOriginal != null ? String(task.idOrdenOriginal) : null}</Kv>}
                {task.esSubTarea && <Kv label="ID ficha principal">{task.idFichaPrincipal}</Kv>}
              </dl>
            </section>

            <section className="task-view-panel task-view-panel--wide">
              <h3 className="task-view-panel-title">Etapas por área</h3>
              <dl className="task-view-kv task-view-kv--dense">
                <Kv label="Taller gráfico">
                  {task.etapaTallerGrafico}
                  {task.etapaTallerGraficoFechaInicio
                    ? ` · desde ${formatDisplayDate(task.etapaTallerGraficoFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Instalaciones">
                  {task.etapaInstalaciones}
                  {task.etapaInstalacionesFechaInicio
                    ? ` · desde ${formatDisplayDate(task.etapaInstalacionesFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Taller imprenta">
                  {task.etapaTallerImprenta}
                  {task.etapaTallerImprentaFechaInicio
                    ? ` · desde ${formatDisplayDate(task.etapaTallerImprentaFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Impresión digital">
                  {task.etapaImpresionDigital}
                  {task.etapaImpresionDigitalFechaInicio
                    ? ` · desde ${formatDisplayDate(task.etapaImpresionDigitalFechaInicio)}`
                    : null}
                </Kv>
                <Kv label="Metalúrgica">
                  {task.etapaMetalurgica}
                  {task.etapaMetalurgicaFechaInicio
                    ? ` · desde ${formatDisplayDate(task.etapaMetalurgicaFechaInicio)}`
                    : null}
                </Kv>
              </dl>
            </section>

            <section className="task-view-panel task-view-panel--wide">
              <h3 className="task-view-panel-title">Brief público / proyecto</h3>
              <dl className="task-view-kv">
                <Kv label="Brief (texto)">{task.briefPublico}</Kv>
                <Kv label="Objetivo del proyecto">{task.objetivoProyecto}</Kv>
                <Kv label="Público objetivo">{task.publicoObjetivo}</Kv>
                <Kv label="Estilo de diseño">{task.estiloDiseno}</Kv>
                <Kv label="Referencias">{task.referencias}</Kv>
                <Kv label="Deadline brief">{formatDisplayDate(task.deadlineBrief ?? task.fechaLimiteBrief)}</Kv>
                <Kv label="Tipo producto / servicio">{task.tipoProductoServicio?.join(', ')}</Kv>
                <Kv label="Tipo (otro)">{task.tipoProductoOtro}</Kv>
                <Kv label="Necesita asesoramiento">{YesNo(task.necesitaAsesoramiento)}</Kv>
                <Kv label="Dónde colocados">{task.dondeColocados}</Kv>
                <Kv label="Digital o impresión">{task.digitalOImpresion}</Kv>
                <Kv label="Cantidades">{task.cantidades}</Kv>
                <Kv label="Material: logo">{task.materialLogo}</Kv>
                <Kv label="Material: textos">{task.materialTextos}</Kv>
                <Kv label="Material: imágenes">{task.materialImagenes}</Kv>
                <Kv label="Tiene referencias">{YesNo(task.tieneReferencias)}</Kv>
                <Kv label="Links de referencias">{task.referenciasLinks}</Kv>
              </dl>
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Etiquetas</h3>
              {task.tags?.length ? (
                <ul className="task-view-tag-list">
                  {task.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="task-view-empty">Sin etiquetas</p>
              )}
            </section>

            <section className="task-view-panel">
              <h3 className="task-view-panel-title">Materiales & m²</h3>
              <dl className="task-view-kv">
                <Kv label="Lista">{task.materials?.length ? task.materials.join(' · ') : null}</Kv>
                <Kv label="Metros cuadrados">{task.metrosCuadrados != null ? `${task.metrosCuadrados} m²` : null}</Kv>
              </dl>
            </section>
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
            <section className="task-view-panel task-view-panel--subtasks">
              <h3 className="task-view-panel-title">Subtareas ({task.subtasks.length})</h3>
              <ul className="task-view-subtasks">
                {task.subtasks.map((s) => (
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

          <footer className="task-view-footer">
            <span>ID interno: {task.id}</span>
            {task.briefToken && <span>Brief token: configurado</span>}
          </footer>
        </div>
      </div>
    </div>
  )
}
