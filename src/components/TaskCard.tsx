import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import clsx from 'clsx'
import type { ActivityEvent, Task, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import QRPrintView from './QRPrintView'
import './TaskCard.css'
import Subtasks from './Subtasks'

const stringToColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = hash % 360
  return `hsl(${h}, 70%, 60%)`
}

type TaskCardProps = {
  task: Task
  index: number
  owner?: TeamMember
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  sectores?: SectorRecord[]
  isDraggable?: boolean
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
  activity?: ActivityEvent[]
  members?: TeamMember[]
}

const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(new Date(value))

const formatFullDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))

const formatCompactDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))

const stripEmailDomain = (value?: string | null) => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const atIndex = trimmed.indexOf('@')
  return atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed
}

const TaskCard = ({
  task,
  index,
  owner,
  onEdit,
  onDelete,
  sectores = [],
  isDraggable = true,
  onMarkDelivered,
  activity = [],
  members = []
}: TaskCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLink, setQrLink] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [showAsignarImpresora, setShowAsignarImpresora] = useState(false)
  const [impresorasDisponibles, setImpresorasDisponibles] = useState<any[]>([])
  const [impresoraSeleccionada, setImpresoraSeleccionada] = useState<number | null>(null)
  const [asignandoImpresora, setAsignandoImpresora] = useState(false)
  const [metrosManuales, setMetrosManuales] = useState<string>('')
  const [showQRPrint, setShowQRPrint] = useState(false)
  const [qrPrintData, setQrPrintData] = useState<{ opNumber: string; cliente: string } | null>(null)
  const { usuario, canManageImpresoras } = useAuth()
  const ordenId = Number(task.id)
  const hasOrdenId = !Number.isNaN(ordenId)
  const isTallerGrafico = task.assignedSector === 'Taller Gráfico' || task.status === 'taller-grafico'
  const workerName =
    stripEmailDomain(task.workingUser) ?? stripEmailDomain(owner?.name) ?? owner?.name
  const workerDisplay = workerName ?? 'Sin asignar'
  const isWorkerAssigned = Boolean(workerName)
  const creatorDisplay = stripEmailDomain(task.createdBy) ?? task.createdBy ?? 'Sistema'
  
  // Detectar si hay modificaciones (updatedAt es más reciente que createdAt)
  const hasModifications = new Date(task.updatedAt).getTime() > new Date(task.createdAt).getTime() + 1000 // +1 segundo para evitar falsos positivos
  
  // Obtener el color del sector asignado
  const sectorInfo = sectores.find((s) => s.nombre === task.assignedSector)
  const sectorColor = sectorInfo?.color || '#6B7280'

  const auditEvents = activity.filter((event) => event.taskId === task.id)

  const handleShowQr = async () => {
    setShowQr(true)
    setQrError(null)
    setQrLoading(true)
    try {
      const { toDataURL } = await import('qrcode')
      const baseUrl =
        typeof window !== 'undefined' ? window.location.origin : 'https://trello.plotcenter.com.ar'
      const targetUrl = `${baseUrl}/op/${encodeURIComponent(task.opNumber || task.id)}`
      const value = targetUrl
      const dataUrl = await toDataURL(value, { width: 320, margin: 1 })
      setQrDataUrl(dataUrl)
      setQrError(null)
      setQrLink(targetUrl)
    } catch (error) {
      console.error('QR generation error', error)
      setQrError('No se pudo generar el QR')
    } finally {
      setQrLoading(false)
    }
  }

  const renderCardContent = (draggableProps?: { ref?: any; className?: string; [key: string]: any }) => {
    const { ref, className: extraClassName, ...restProps } = draggableProps || {}
    return (
      <>
        <article
          className={clsx('task-card', `priority-${task.priority}`, {
            'is-collapsed': !isExpanded
          }, extraClassName)}
          ref={ref}
          {...restProps}
        >
          {task.priority === 'alta' && (
            <div className="priority-led-indicator" title="Prioridad Alta"></div>
          )}
          {/* Marquita del sector en esquina superior derecha */}
          {task.assignedSector && (
            <div 
              className="sector-corner-marker" 
              style={{ backgroundColor: sectorColor }}
              title={task.assignedSector}
            ></div>
          )}
          {/* Indicador de ficha duplicada */}
          {task.esDuplicado && (
            <div 
              className="duplicate-indicator" 
              title={`Ficha duplicada de OP #${task.opNumber}`}
            >
              📋
            </div>
          )}
          <div className="task-actions">
            {onEdit && (
              <button
                type="button"
                className="task-action-btn task-edit"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(task)
                }}
                title="Editar"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="task-action-btn task-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('¿Estás seguro de eliminar esta tarea?')) {
                    onDelete(task.id)
                  }
                }}
                title="Eliminar"
              >
                🗑️
              </button>
            )}
            <button
              type="button"
              className="task-action-btn"
              onClick={(e) => {
                e.stopPropagation()
                void handleShowQr()
              }}
              title="QR rápido"
            >
              🔳
            </button>
            <button
              type="button"
              className="task-action-btn"
              onClick={(e) => {
                e.stopPropagation()
                setShowAudit(true)
              }}
              title="Auditoría"
            >
              📜
            </button>
            {task.opNumber && (
              <button
                type="button"
                className="task-action-btn"
                onClick={async (e) => {
                  e.stopPropagation()
                  // Obtener los datos correctos de la orden
                  try {
                    const response = await apiService.getOrdenByOpNumber(task.opNumber!)
                    if (response.success && response.data) {
                      setQrPrintData({
                        opNumber: response.data.numero_op,
                        cliente: response.data.cliente
                      })
                      setShowQRPrint(true)
                    } else {
                      console.error('Error al obtener orden:', response.error)
                      // Fallback: usar datos de la tarea
                      setQrPrintData({
                        opNumber: task.opNumber,
                        cliente: task.title
                      })
                      setShowQRPrint(true)
                    }
                  } catch (error) {
                    console.error('Error al obtener orden:', error)
                    // Fallback: usar datos de la tarea
                    setQrPrintData({
                      opNumber: task.opNumber,
                      cliente: task.title
                    })
                    setShowQRPrint(true)
                  }
                }}
                title="Imprimir QR para Cliente"
              >
                🖨️
              </button>
            )}
          </div>
          {task.photoUrl && (
            <div className="task-photo">
              <img src={task.photoUrl} alt={`Trabajo ${task.title}`} loading="lazy" />
            </div>
          )}

          <div className="task-meta">
            {/* Sector asignado al principio */}
            {task.assignedSector && (
              <div className="task-sector-header">
                <span 
                  className="sector-pill-header" 
                  style={{ 
                    backgroundColor: `${sectorColor}20`,
                    borderColor: `${sectorColor}60`,
                    color: sectorColor
                  }}
                >
                  {task.assignedSector}
                </span>
              </div>
            )}
            {/* Ubicación física cuando está finalizado */}
            {task.status === 'finalizado-taller' && task.finalLocation && (
              <div className="task-location-pill">
                <span className="location-dot">📍</span>
                <span className="location-text">Ubicación: {task.finalLocation}</span>
              </div>
            )}
            <div className="task-op-line">
              <span className="task-op">#{task.opNumber}</span>
              <span className="task-date">{formatShortDate(task.dueDate)}</span>
              {hasModifications && (
                <span className="task-notification-bell" title="Hay modificaciones recientes">🔔</span>
              )}
            </div>
            <h4>{task.title}</h4>
            {task.dniCuit && (
              <div className="task-dni-cuit">
                <span className="dni-cuit-label">DNI/CUIT:</span>
                <span className="dni-cuit-value">{task.dniCuit}</span>
              </div>
            )}
            {task.clientPhone && (
              <div className="task-contact-info-compact">
                <span className="contact-info-label">Tel:</span>
                <span className="contact-info-value">{task.clientPhone}</span>
                {task.whatsappUrl && (
                  <a
                    href={task.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-link-compact"
                    title="Abrir WhatsApp"
                  >
                    🟢
                  </a>
                )}
              </div>
            )}
            {task.locationUrl && (
              <div className="task-contact-info-compact">
                <span className="contact-info-label">Ubicación:</span>
                <a
                  href={task.locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-info-link"
                  title="Abrir en Google Maps"
                >
                  📍 Ver mapa
                </a>
              </div>
            )}
            <div className="task-people">
              <div className="people-chip creator-chip">
                <span className="people-label">Creó:</span>
                <strong className="people-name">{creatorDisplay}</strong>
              </div>
              <div className={clsx('people-chip', 'worker-chip', { 'is-unassigned': !isWorkerAssigned })}>
                <span className="people-label">Trabaja:</span>
                <strong className="people-name">{workerDisplay}</strong>
              </div>
            </div>
            {/* Checkbox Entregado cuando está en Almacén de Entrega */}
            {task.status === 'almacen-entrega' && onMarkDelivered && (
              <div className="task-delivered-checkbox">
                <label className="delivered-label">
                  <input
                    type="checkbox"
                    checked={task.entregado ?? false}
                    onChange={async (e) => {
                      e.stopPropagation()
                      await onMarkDelivered(task.id, e.target.checked)
                    }}
                  />
                  <span>✓ Entregado (Archivar)</span>
                </label>
              </div>
            )}
          </div>

          <div className="task-body">
            <p className="task-description">{task.summary}</p>

            {(task.clientPhone ||
              task.clientEmail ||
              task.clientAddress ||
              task.whatsappUrl ||
              task.locationUrl ||
              task.driveUrl) && (
              <div className="task-contact">
                <span className="section-label">Contacto cliente:</span>
                <div className="task-contact-links">
                  {task.clientPhone && (
                    <div className="contact-item">
                      <span className="contact-label">Teléfono</span>
                      <span className="contact-value">{task.clientPhone}</span>
                    </div>
                  )}
                  {(task.whatsappUrl || task.clientPhone) && (
                    <a
                      className="contact-pill whatsapp"
                      href={
                        task.whatsappUrl ||
                        `https://wa.me/${encodeURIComponent(
                          task.clientPhone!.replace(/[^0-9]/g, '')
                        )}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🟢 WhatsApp
                    </a>
                  )}
                  {task.clientEmail && (
                    <a
                      className="contact-pill email"
                      href={`mailto:${task.clientEmail}`}
                    >
                      ✉️ Mail
                    </a>
                  )}
                  {task.clientAddress && (
                    <div className="contact-item">
                      <span className="contact-label">Dirección</span>
                      <span className="contact-value">{task.clientAddress}</span>
                    </div>
                  )}
                  {task.locationUrl && (
                    <a
                      className="contact-pill location"
                      href={task.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📍 Ubicación
                    </a>
                  )}
                  {task.driveUrl && (
                    <a
                      className="contact-pill drive"
                      href={task.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📂 Drive
                    </a>
                  )}
                </div>
              </div>
            )}

            {task.materials.length > 0 && (
              <div className="task-materials">
                <span className="section-label">Materiales:</span>
                <ul>
                  {task.materials.map((material) => (
                    <li key={material}>{material}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="task-sector">
              <span className="section-label">Sector asignado:</span>
              <span 
                className="sector-pill" 
                style={{ 
                  backgroundColor: `${sectorColor}20`,
                  borderColor: `${sectorColor}60`,
                  color: sectorColor
                }}
              >
                {task.assignedSector}
              </span>
            </div>

            {task.tags.length > 0 && (
              <div className="task-tags">
                {task.tags.map((tag) => {
                  const color = stringToColor(tag)
                  return (
                    <span
                      key={tag}
                      style={{
                        background: `${color}22`,
                        border: `1px solid ${color}55`,
                        color
                      }}
                    >
                      {tag}
                    </span>
                  )
                })}
              </div>
            )}

            <div className="task-progress">
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${task.progress}%` }} />
              </div>
              <span>{task.progress}%</span>
            </div>

            {hasOrdenId && (
              <div className="task-subtasks">
                {((task.subtasks && task.subtasks.length > 0) || (task.subtaskProgress ?? 0) > 0) && (
                  <span className="checklist-badge" title="Tiene subtareas pendientes">
                    ●
                  </span>
                )}
                <button
                  type="button"
                  className="pill checklist-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(true)
                    setShowChecklist(true)
                  }}
                >
                  ☑ Checklist
                </button>
              </div>
            )}

            {/* Botón para asignar impresora cuando está en Taller Gráfico */}
            {isTallerGrafico && canManageImpresoras && hasOrdenId && (
              <div className="task-impresora-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                {task.metrosCuadrados !== undefined && task.metrosCuadrados !== null && (
                  <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
                    Metros²: <strong style={{ color: '#10b981' }}>{task.metrosCuadrados.toFixed(2)} m²</strong>
                  </div>
                )}
                <button
                  type="button"
                  className="pill"
                  style={{ 
                    background: 'rgba(16, 185, 129, 0.2)', 
                    borderColor: 'rgba(16, 185, 129, 0.5)', 
                    color: '#10b981',
                    fontSize: '12px',
                    padding: '6px 12px'
                  }}
                  onClick={async (e) => {
                    e.stopPropagation()
                    setShowAsignarImpresora(true)
                    setMetrosManuales(task.metrosCuadrados?.toString() || '')
                    // Cargar impresoras disponibles
                    const response = await apiService.getImpresoras()
                    if (response.success && response.data) {
                      setImpresorasDisponibles(response.data.filter((imp: any) => 
                        imp.estado !== 'Mantenimiento' && imp.estado !== 'Fuera de Servicio' && imp.activa
                      ))
                    }
                  }}
                >
                  🖨️ Asignar Impresora
                </button>
              </div>
            )}

            <div className="task-timings">
              <div>
                <span>Creado</span>
                <strong>{formatFullDateTime(task.createdAt)}</strong>
              </div>
              <div>
                <span>Entrega</span>
                <strong>{formatShortDate(task.dueDate)}</strong>
              </div>
            </div>

            <footer>
              <div className="owner-chip">
                <div className="owner-avatar">{owner?.avatar ?? 'TP'}</div>
                <div>
                  <strong>{owner?.name ?? 'Sin asignar'}</strong>
                  <small>{owner?.role ?? 'Trabajador no asignado'}</small>
                </div>
              </div>
              <div className="footer-right">
                <div className="due-date">
                  <span>Último movimiento</span>
                  <strong>{formatCompactDateTime(task.updatedAt)}</strong>
                </div>
              </div>
            </footer>
          </div>

          <button
            type="button"
            className="task-toggle"
            onClick={(event) => {
              event.stopPropagation()
              setIsExpanded((prev) => !prev)
            }}
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          </button>
        </article>
        {showChecklist && hasOrdenId && (
          <div
            className="modal-overlay subtasks-modal"
            onClick={(e) => {
              e.stopPropagation()
              setShowChecklist(false)
            }}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="modal-header">
                <h3>Checklist de OP {task.opNumber}</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowChecklist(false)}
                >
                  ×
                </button>
              </header>
              <div className="modal-body">
                <Subtasks ordenId={ordenId} />
              </div>
            </div>
          </div>
        )}
        {showQr && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              e.stopPropagation()
              setShowQr(false)
            }}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <h3>QR OP {task.opNumber}</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowQr(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </header>
              <div className="modal-body qr-body">
                {qrLoading && <p>Generando QR...</p>}
                {qrError && <p className="qr-error">{qrError}</p>}
                {!qrLoading && !qrError && qrDataUrl && (
                  <div className="qr-preview">
                    <img src={qrDataUrl} alt={`QR OP ${task.opNumber}`} />
                    {qrLink && (
                      <>
                        <p className="qr-link">{qrLink}</p>
                        <a className="qr-open" href={qrLink} target="_blank" rel="noopener noreferrer">
                          Abrir enlace
                        </a>
                      </>
                    )}
                    <p className="qr-label">Escaneá para abrir la OP</p>
                    <a className="qr-download" href={qrDataUrl} download={`op-${task.opNumber}.png`}>
                      Descargar PNG
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {showAudit && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              e.stopPropagation()
              setShowAudit(false)
            }}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <h3>Auditoría OP {task.opNumber}</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowAudit(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </header>
              <div className="modal-body audit-body">
                {auditEvents.length === 0 && <p className="muted">Sin eventos registrados.</p>}
                {auditEvents.length > 0 && (
                  <div className="audit-list">
                    {auditEvents.map((event) => (
                      <div key={event.id} className="audit-item">
                        <div className="audit-main">
                          <strong>{event.from} → {event.to}</strong>
                          <span className="audit-note">{event.note}</span>
                        </div>
                        <div className="audit-meta">
                          <span>{formatCompactDateTime(event.timestamp)}</span>
                          <span className="audit-actor">
                            Actor:{' '}
                            {members.find((m) => m.id === event.actorId)?.name ?? event.actorId}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {showAsignarImpresora && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              e.stopPropagation()
              setShowAsignarImpresora(false)
            }}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <header className="modal-header">
                <h3>Asignar Impresora - OP {task.opNumber}</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowAsignarImpresora(false)}
                >
                  ×
                </button>
              </header>
              <div className="modal-body">
                <label style={{ display: 'block', marginBottom: '15px', color: '#fff' }}>
                  Metros Cuadrados (m²) a Imprimir *:
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={metrosManuales}
                    onChange={(e) => setMetrosManuales(e.target.value)}
                    placeholder={task.metrosCuadrados ? `Sugerido: ${task.metrosCuadrados.toFixed(2)}` : 'Ej: 6.24'}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: '5px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                  {task.metrosCuadrados !== undefined && task.metrosCuadrados !== null && (
                    <small style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                      Metros² registrados en la ficha: {task.metrosCuadrados.toFixed(2)} m²
                    </small>
                  )}
                </label>
                <label style={{ display: 'block', marginBottom: '10px', color: '#fff' }}>
                  Seleccionar Impresora *:
                  <select
                    value={impresoraSeleccionada || ''}
                    onChange={(e) => setImpresoraSeleccionada(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: '5px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Seleccione una impresora...</option>
                    {impresorasDisponibles.map((imp) => (
                      <option key={imp.id} value={imp.id} style={{ background: '#1a1d2e', color: '#fff' }}>
                        {imp.nombre} {imp.modelo ? `(${imp.modelo})` : ''} - {imp.estado}
                      </option>
                    ))}
                  </select>
                </label>
                {impresorasDisponibles.length === 0 && (
                  <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '10px' }}>
                    No hay impresoras disponibles en este momento.
                  </p>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowAsignarImpresora(false)}
                  className="cancel-button"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!impresoraSeleccionada) {
                      alert('Por favor seleccione una impresora')
                      return
                    }
                    if (!metrosManuales || parseFloat(metrosManuales) <= 0) {
                      alert('Por favor ingrese los metros cuadrados a imprimir')
                      return
                    }
                    setAsignandoImpresora(true)
                    try {
                      const metros = parseFloat(metrosManuales)
                      const response = await apiService.asignarOrdenAImpresora(
                        impresoraSeleccionada,
                        ordenId,
                        usuario?.nombre,
                        metros
                      )
                      if (response.success) {
                        alert('✅ Impresora asignada correctamente. Estado cambiado a "En Uso".')
                        setShowAsignarImpresora(false)
                        setImpresoraSeleccionada(null)
                        setMetrosManuales('')
                        // Recargar la página o actualizar el estado
                        window.location.reload()
                      } else {
                        alert(`Error: ${response.error}`)
                      }
                    } catch (error) {
                      alert(`Error al asignar impresora: ${error}`)
                    } finally {
                      setAsignandoImpresora(false)
                    }
                  }}
                  className="confirm-button"
                  disabled={asignandoImpresora || !impresoraSeleccionada || !metrosManuales || parseFloat(metrosManuales) <= 0}
                >
                  {asignandoImpresora ? 'Asignando...' : 'Asignar Impresora'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  const cardContent = isDraggable ? (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) =>
        renderCardContent({
          ref: provided.innerRef,
          className: clsx({
            'is-dragging': snapshot.isDragging
          }),
          ...provided.draggableProps,
          ...provided.dragHandleProps
        })
      }
    </Draggable>
  ) : (
    renderCardContent()
  )

  return (
    <>
      {cardContent}
      {showQRPrint && qrPrintData && (
        <QRPrintView
          opNumber={qrPrintData.opNumber}
          cliente={qrPrintData.cliente}
          onClose={() => {
            setShowQRPrint(false)
            setQrPrintData(null)
          }}
        />
      )}
    </>
  )
}

export default TaskCard

