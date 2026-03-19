import { memo, useState, useEffect } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import clsx from 'clsx'
import type { ActivityEvent, Task, TaskStatus, TeamMember, ColumnConfig } from '../types/board'
import type { SectorRecord } from '../types/api'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useTagColors } from '../hooks/useTagColors'
import QRPrintView from './QRPrintView'
import EtapaTallerGraficoSelector from './EtapaTallerGraficoSelector'
import HistorialEtapasTallerGrafico from './HistorialEtapasTallerGrafico'
import EtapaInstalacionesSelector from './EtapaInstalacionesSelector'
import HistorialEtapasInstalaciones from './HistorialEtapasInstalaciones'
import EtapaTallerImprentaSelector from './EtapaTallerImprentaSelector'
import HistorialEtapasTallerImprenta from './HistorialEtapasTallerImprenta'
import EtapaImpresionDigitalSelector from './EtapaImpresionDigitalSelector'
import EtapaMetalurgicaSelector from './EtapaMetalurgicaSelector'
import HistorialEtapasMetalurgica from './HistorialEtapasMetalurgica'
import './TaskCard.css'
import Subtasks from './Subtasks'

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
  onMoveTask?: (taskId: string, destination: TaskStatus) => void
  columns?: ColumnConfig[]
  isSelected?: boolean
  onSelect?: (taskId: string | null) => void
  isBoardDragging?: boolean
}

const formatShortDate = (value: string) => {
  // Si viene date-only (YYYY-MM-DD), evitar el corrimiento por UTC interpretándolo en horario AR
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Mediodía UTC = mañana en AR, evita caer en el día anterior
    const safe = new Date(`${value}T12:00:00Z`)
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    }).format(safe)
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(new Date(value))
}

const formatFullDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(new Date(value))

const formatCompactDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
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
  members = [],
  onMoveTask,
  columns = [],
  isSelected = false,
  onSelect,
  isBoardDragging = false
}: TaskCardProps) => {
  const { getTagColor, loadTagColor } = useTagColors()
  const [tagColorsCache, setTagColorsCache] = useState<Map<string, string>>(new Map())
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [showAsignarImpresora, setShowAsignarImpresora] = useState(false)
  const [impresorasDisponibles, setImpresorasDisponibles] = useState<any[]>([])
  const [impresoraSeleccionada, setImpresoraSeleccionada] = useState<number | null>(null)
  const [asignandoImpresora, setAsignandoImpresora] = useState(false)
  const [metrosManuales, setMetrosManuales] = useState<string>('')
  const [showQRPrint, setShowQRPrint] = useState(false)
  const [qrPrintData, setQrPrintData] = useState<{ opNumber: string; cliente: string } | null>(null)
  const [showHistorialTallerModal, setShowHistorialTallerModal] = useState(false)
  const [showHistorialInstalacionesModal, setShowHistorialInstalacionesModal] = useState(false)
  const [showHistorialTallerImprentaModal, setShowHistorialTallerImprentaModal] = useState(false)
  const [showHistorialMetalurgicaModal, setShowHistorialMetalurgicaModal] = useState(false)
  const [showEtapasTallerModal, setShowEtapasTallerModal] = useState(false)
  const [showEtapasInstalacionesModal, setShowEtapasInstalacionesModal] = useState(false)
  const [showEtapasTallerImprentaModal, setShowEtapasTallerImprentaModal] = useState(false)
  const [showEtapasImpresionDigitalModal, setShowEtapasImpresionDigitalModal] = useState(false)
  const [showEtapasMetalurgicaModal, setShowEtapasMetalurgicaModal] = useState(false)
  const [marcandoEntregado, setMarcandoEntregado] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const { usuario, canManageImpresoras, isAdmin, canManageInstalaciones, canManageTallerImprenta, canManageMetalurgica } = useAuth()
  const etiquetaOrden = task.esFichaNoOP ? 'Ficha' : 'OP'
  const displayNumeroOrden = (() => {
    const raw = (task.opNumber || '').trim()
    if (!raw) return raw
    if (etiquetaOrden !== 'Ficha') return raw
    const stripped = raw.replace(/^FICHA[\s-_#:]*/i, '')
    return stripped || raw
  })()

  useEffect(() => {
    // Persistir minimizado por ficha/OP
    try {
      const key = `taskcard:minimized:${task.id}`
      const raw = localStorage.getItem(key)
      // Por defecto: minimizado (si no hay preferencia guardada)
      if (raw === null) setIsMinimized(true)
      else setIsMinimized(raw === '1')
    } catch {
      // Fallback: si no se puede leer storage, arrancar minimizado
      setIsMinimized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  const toggleMinimized = () => {
    setIsMinimized((prev) => {
      const next = !prev
      try {
        const key = `taskcard:minimized:${task.id}`
        if (next) localStorage.setItem(key, '1')
        else localStorage.removeItem(key)
      } catch {
        // ignore
      }
      // Si minimiza, colapsar detalles también
      if (next) setIsExpanded(false)
      return next
    })
  }

  // Cerrar menú contextual al hacer clic fuera
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', close)
    }
  }, [contextMenu])
  const ordenId = Number(task.id)
  const hasOrdenId = !Number.isNaN(ordenId)
  const isTallerGrafico = task.assignedSector === 'Taller Gráfico' || task.status === 'taller-grafico'
  const isInstalaciones = task.assignedSector === 'Instalaciones' || task.status === 'instalaciones'
  const isTallerImprenta = task.assignedSector === 'Taller de Imprenta' || task.status === 'taller-imprenta'
  const isImprentaArea = task.assignedSector === 'Imprenta (Área de Impresión)' || task.status === 'imprenta'
  const isMetalurgica = task.assignedSector === 'Metalúrgica' || task.status === 'metalurgica'

  // Helper para obtener color e icono de etapa por sector
  const getEtapaInfo = (sector: string, etapa: string | null | undefined): { color: string; icon: string } | null => {
    if (!etapa) return null
    
    // Taller Gráfico
    if (sector === 'Taller Gráfico') {
      const colores: Record<string, string> = {
        'Falta Material para Impresión o archivo': '#ef4444',
        'En Proceso': '#3b82f6',
        'Para Cortar o Pegar': '#f59e0b',
        'Para Rotular': '#8b5cf6',
        'Instalaciones/Ploteo': '#10b981',
        'Metalurgica Instalacion': '#ec4899',
        'laminas': '#06b6d4'
      }
      const iconos: Record<string, string> = {
        'Falta Material para Impresión o archivo': '⚠️',
        'En Proceso': '⚙️',
        'Para Cortar o Pegar': '✂️',
        'Para Rotular': '🏷️',
        'Instalaciones/Ploteo': '🚚',
        'Metalurgica Instalacion': '🔧',
        'laminas': '📄'
      }
      return { color: colores[etapa] || '#6b7280', icon: iconos[etapa] || '📍' }
    }
    
    // Instalaciones
    if (sector === 'Instalaciones') {
      const colores: Record<string, string> = {
        'Falta Info o Material': '#ef4444',
        'Coordinados para Instalaciones': '#3b82f6',
        'Listos para instalar': '#10b981',
        'Pausados': '#f59e0b',
        'Rehacer': '#ec4899'
      }
      const iconos: Record<string, string> = {
        'Falta Info o Material': '⚠️',
        'Coordinados para Instalaciones': '📅',
        'Listos para instalar': '✅',
        'Pausados': '⏸️',
        'Rehacer': '🔄'
      }
      return { color: colores[etapa] || '#6b7280', icon: iconos[etapa] || '📍' }
    }
    
    // Taller de Imprenta
    if (sector === 'Taller de Imprenta') {
      const colores: Record<string, string> = {
        'Proceso': '#3b82f6',
        'Finalizado/máquina con Precorte': '#10b981',
        'Almacén': '#f59e0b',
        'Entregado/ Derivado': '#8b5cf6',
        'Sin Realizar Por faltantes': '#ef4444',
        'En Revisión': '#ec4899'
      }
      const iconos: Record<string, string> = {
        'Proceso': '⚙️',
        'Finalizado/máquina con Precorte': '✅',
        'Almacén': '📦',
        'Entregado/ Derivado': '🚚',
        'Sin Realizar Por faltantes': '⚠️',
        'En Revisión': '🔍'
      }
      return { color: colores[etapa] || '#6b7280', icon: iconos[etapa] || '📍' }
    }
    
    // Imprenta (Área de Impresión) - Impresión Digital
    if (sector === 'Imprenta (Área de Impresión)') {
      const colores: Record<string, string> = {
        'En Proceso': '#3b82f6',
        'Pausa': '#f59e0b',
        'Fichas técnicas': '#8b5cf6',
        'Delivery': '#06b6d4',
        'Taller de Imprenta': '#22c55e',
        'Para Embalar': '#eab308',
        'Embalado': '#10b981'
      }
      const iconos: Record<string, string> = {
        'En Proceso': '⚙️',
        'Pausa': '⏸️',
        'Fichas técnicas': '📋',
        'Delivery': '🚚',
        'Taller de Imprenta': '🖨️',
        'Para Embalar': '📦',
        'Embalado': '✅'
      }
      return { color: colores[etapa] || '#6b7280', icon: iconos[etapa] || '📍' }
    }
    
    // Metalúrgica
    if (sector === 'Metalúrgica') {
      const colores: Record<string, string> = {
        'En Proceso': '#3b82f6',
        'Corte': '#ef4444',
        'Soldadura': '#f59e0b',
        'Pintura/Tratamiento': '#8b5cf6',
        'Montaje': '#06b6d4',
        'Listo para Instalar': '#10b981',
        'Finalizado': '#6366f1'
      }
      const iconos: Record<string, string> = {
        'En Proceso': '⚙️',
        'Corte': '✂️',
        'Soldadura': '🔥',
        'Pintura/Tratamiento': '🎨',
        'Montaje': '🔧',
        'Listo para Instalar': '✅',
        'Finalizado': '🏁'
      }
      return { color: colores[etapa] || '#6b7280', icon: iconos[etapa] || '📍' }
    }
    
    return null
  }

  // Obtener información de la etapa actual según el sector
  const getEtapaActual = () => {
    if (isTallerGrafico && task.etapaTallerGrafico) {
      return {
        etapa: task.etapaTallerGrafico,
        fechaInicio: task.etapaTallerGraficoFechaInicio,
        info: getEtapaInfo('Taller Gráfico', task.etapaTallerGrafico)
      }
    }
    if (isInstalaciones && task.etapaInstalaciones) {
      return {
        etapa: task.etapaInstalaciones,
        fechaInicio: task.etapaInstalacionesFechaInicio,
        info: getEtapaInfo('Instalaciones', task.etapaInstalaciones)
      }
    }
    if (isTallerImprenta && task.etapaTallerImprenta) {
      return {
        etapa: task.etapaTallerImprenta,
        fechaInicio: task.etapaTallerImprentaFechaInicio,
        info: getEtapaInfo('Taller de Imprenta', task.etapaTallerImprenta)
      }
    }
    if (isImprentaArea && task.etapaImpresionDigital) {
      return {
        etapa: task.etapaImpresionDigital,
        fechaInicio: task.etapaImpresionDigitalFechaInicio,
        info: getEtapaInfo('Imprenta (Área de Impresión)', task.etapaImpresionDigital)
      }
    }
    if (isMetalurgica && task.etapaMetalurgica) {
      return {
        etapa: task.etapaMetalurgica,
        fechaInicio: task.etapaMetalurgicaFechaInicio,
        info: getEtapaInfo('Metalúrgica', task.etapaMetalurgica)
      }
    }
    return null
  }
  const workerName =
    stripEmailDomain(task.workingUser) ?? stripEmailDomain(owner?.name) ?? owner?.name
  const workerDisplay = workerName ?? 'Sin asignar'
  const isWorkerAssigned = Boolean(workerName)
  const creatorDisplay = stripEmailDomain(task.createdBy) ?? task.createdBy ?? 'Sistema'

  // Fuerza rerender al expirar el "NEW"
  const [, setNowTick] = useState(0)
  const [effectiveMovedAt, setEffectiveMovedAt] = useState<number | null>(null)
  const NEW_MOVE_MS = 60 * 60 * 1000 // 1 hora
  const isNewMove = typeof effectiveMovedAt === 'number' && Date.now() - effectiveMovedAt < NEW_MOVE_MS

  useEffect(() => {
    try {
      const key = `taskcard:new-move:${task.id}`
      if (typeof task.uiMovedAt === 'number') {
        setEffectiveMovedAt(task.uiMovedAt)
        localStorage.setItem(key, String(task.uiMovedAt))
        return
      }
      const raw = localStorage.getItem(key)
      const parsed = raw ? Number(raw) : NaN
      if (!Number.isNaN(parsed)) {
        const stillNew = Date.now() - parsed < NEW_MOVE_MS
        if (stillNew) {
          setEffectiveMovedAt(parsed)
        } else {
          setEffectiveMovedAt(null)
          localStorage.removeItem(key)
        }
      } else {
        setEffectiveMovedAt(null)
      }
    } catch {
      setEffectiveMovedAt(typeof task.uiMovedAt === 'number' ? task.uiMovedAt : null)
    }
  }, [task.id, task.uiMovedAt])

  useEffect(() => {
    if (!isNewMove) return
    const movedAt = effectiveMovedAt as number
    const remainingMs = Math.max(0, NEW_MOVE_MS - (Date.now() - movedAt))
    const t = window.setTimeout(() => {
      try {
        localStorage.removeItem(`taskcard:new-move:${task.id}`)
      } catch {
        // ignore storage failures
      }
      setNowTick((x) => x + 1)
      setEffectiveMovedAt(null)
    }, remainingMs + 50)
    return () => window.clearTimeout(t)
  }, [isNewMove, effectiveMovedAt, task.id])
  
  // Detectar si hay modificaciones (updatedAt es más reciente que createdAt)
  const hasModifications = new Date(task.updatedAt).getTime() > new Date(task.createdAt).getTime() + 1000 // +1 segundo para evitar falsos positivos
  
  // Obtener el color del sector asignado
  const sectorInfo = sectores.find((s) => s.nombre === task.assignedSector)
  const sectorColor = sectorInfo?.color || '#6B7280'

  const auditEvents = activity.filter((event) => event.taskId === task.id)

  const renderCardContent = (draggableProps?: { ref?: any; className?: string; [key: string]: any }) => {
    const { ref, className: extraClassName, ...restProps } = draggableProps || {}
    const isDragLightMode = Boolean(isBoardDragging || (extraClassName && String(extraClassName).includes('is-dragging')))
    return (
      <>
        <article
          className={clsx('task-card', `priority-${task.priority}`, {
            'planilla-preliminar': task.planillaPreliminar,
            'ficha-tecnica-cargada': task.fichaTecnicaCargada,
            'presupuesto-enviado': task.presupuestoEnviadoCliente,
            'is-collapsed': !isExpanded,
            'is-minimized': isMinimized,
            'is-new-move': isNewMove,
            'is-selected': isSelected
          }, extraClassName)}
          ref={ref}
          onClick={() => {
            if (isMinimized) {
              toggleMinimized()
              return
            }
            onSelect?.(task.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            if (onMoveTask && columns.length) setContextMenu({ x: e.clientX, y: e.clientY })
          }}
          {...restProps}
        >
          {(isMinimized || isDragLightMode) && (
            <div className="task-minimized-label" title={`#${task.opNumber} — ${task.title}`}>
              {task.photoUrl && (
                <span className="task-min-thumb" aria-hidden="true">
                  <img src={task.photoUrl} alt="" loading="lazy" />
                </span>
              )}
              <span className="task-min-op">#{task.opNumber}</span>
              <span className="task-min-sep">·</span>
              <span className="task-min-client">{task.title}</span>
              {isNewMove && <span className="task-new-pill">NEW</span>}
            </div>
          )}
          {/* Durante drag: el resto del DOM pesado queda deshabilitado por condiciones abajo */}
          {!isMinimized && (
            <button
              type="button"
              className="task-minimize-btn"
              onClick={(e) => {
                e.stopPropagation()
                toggleMinimized()
              }}
              title="Minimizar"
              aria-label="Minimizar"
            >
              ⊟
            </button>
          )}
          {!isMinimized && isNewMove && <span className="task-new-pill task-new-pill-floating">NEW</span>}
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
              title={`Ficha duplicada de ${etiquetaOrden} #${task.opNumber}`}
            >
              📋
            </div>
          )}
          {/* Flechas para mover entre columnas */}
          {onMoveTask && columns.length > 0 && (() => {
            const idx = columns.findIndex((c) => c.id === task.status)
            const prevCol = idx > 0 ? columns[idx - 1] : null
            const nextCol = idx >= 0 && idx < columns.length - 1 ? columns[idx + 1] : null
            return (prevCol || nextCol) ? (
              <div className="task-move-arrows">
                {prevCol && (
                  <button
                    type="button"
                    className="task-action-btn task-move-arrow"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveTask(task.id, prevCol.id)
                    }}
                    title={`Mover a ${prevCol.label}`}
                  >
                    ←
                  </button>
                )}
                {nextCol && (
                  <button
                    type="button"
                    className="task-action-btn task-move-arrow"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveTask(task.id, nextCol.id)
                    }}
                    title={`Mover a ${nextCol.label}`}
                  >
                    →
                  </button>
                )}
              </div>
            ) : null
          })()}
          {!isMinimized && !isDragLightMode && <div className="task-actions">
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
                  onDelete(task.id)
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
          </div>}
          {!isMinimized && !isDragLightMode && task.photoUrl && (
            <div className="task-photo">
              <img src={task.photoUrl} alt={`Trabajo ${task.title}`} loading="lazy" />
            </div>
          )}

          {!isMinimized && !isDragLightMode && <div className="task-meta">
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
                {/* Mostrar etapa actual para todos los sectores */}
                {(() => {
                  const etapaActual = getEtapaActual()
                  if (!etapaActual || !etapaActual.info) return null
                  
                  const { etapa, fechaInicio, info } = etapaActual
                  const tiempoEnEtapa = fechaInicio 
                    ? Math.floor((new Date().getTime() - new Date(fechaInicio).getTime()) / 1000)
                    : null
                  const tiempoFormateado = tiempoEnEtapa 
                    ? tiempoEnEtapa < 60 
                      ? `${tiempoEnEtapa} seg`
                      : tiempoEnEtapa < 3600
                      ? `${Math.floor(tiempoEnEtapa / 60)} min`
                      : `${Math.floor(tiempoEnEtapa / 3600)} horas`
                    : null
                  
                  return (
                    <span 
                      className="etapa-pill-header" 
                      style={{ 
                        backgroundColor: `${info.color}20`,
                        borderColor: `${info.color}60`,
                        color: info.color,
                        fontSize: '0.75rem',
                        marginLeft: '8px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: '600'
                      }}
                      title={`Etapa actual: ${etapa}${tiempoFormateado ? ` (${tiempoFormateado})` : ''}`}
                    >
                      <span>{info.icon}</span>
                      <span>{etapa}</span>
                      {tiempoFormateado && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({tiempoFormateado})</span>
                      )}
                    </span>
                  )
                })()}
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
              <span className="task-date">
                {task.dueDate ? formatShortDate(task.dueDate) : formatShortDate(task.createdAt)}
              </span>
              {hasModifications && (
                <span className="task-notification-bell" title="Hay modificaciones recientes">🔔</span>
              )}
            </div>
            {(isTallerGrafico || task.metrosCuadrados !== undefined) && (
              <div
                className={`task-metros-pill ${
                  task.metrosCuadrados === undefined || task.metrosCuadrados === null ? 'is-empty' : ''
                }`}
                title="Metros cuadrados"
              >
                📏 m²:{' '}
                {task.metrosCuadrados === undefined || task.metrosCuadrados === null
                  ? '—'
                  : `${task.metrosCuadrados.toFixed(2)}`}
              </div>
            )}
            <h4>{task.title}</h4>
            {task.tags.length > 0 && (
              <div className="task-tags">
                {task.tags.map((tag) => {
                  const color = tagColorsCache.get(tag.toLowerCase()) || getTagColor(tag)
                  // Cargar color si no está en cache
                  if (!tagColorsCache.has(tag.toLowerCase())) {
                    loadTagColor(tag).then(loadedColor => {
                      setTagColorsCache(prev => {
                        const newMap = new Map(prev)
                        newMap.set(tag.toLowerCase(), loadedColor)
                        return newMap
                      })
                    })
                  }
                  return (
                    <span
                      key={tag}
                      className="task-tag"
                      style={{
                        background: color,
                        border: `2px solid ${color}`,
                        color: '#ffffff',
                        fontWeight: '600',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      {tag}
                    </span>
                  )
                })}
              </div>
            )}
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
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
                <label className="delivered-label" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={task.entregado ?? false}
                    disabled={marcandoEntregado}
                    onChange={async (e) => {
                      e.stopPropagation()
                      
                      if (marcandoEntregado) {
                        e.preventDefault()
                        return
                      }
                      
                      const nuevoValor = e.target.checked
                      setMarcandoEntregado(true)
                      
                      try {
                        await onMarkDelivered(task.id, nuevoValor)
                      } catch (error) {
                        console.error('Error marcando como entregado:', error)
                        // El estado se revertirá automáticamente si falla la actualización
                      } finally {
                        setMarcandoEntregado(false)
                      }
                    }}
                  />
                  <span>{marcandoEntregado ? '⏳ Guardando...' : '✓ Entregado (Archivar)'}</span>
                </label>
              </div>
            )}
          </div>}

          {!isMinimized && !isDragLightMode && <div className="task-body">
            <p className="task-description">{task.summary}</p>

            {/* Brief Público */}
            {task.briefPublico && (
              <div className="task-brief">
                <span className="section-label">📋 Brief Público:</span>
                <p className="brief-content">{task.briefPublico}</p>
                {(task.objetivoProyecto || task.publicoObjetivo || task.estiloDiseno || task.referencias) && (
                  <div className="brief-details">
                    {task.objetivoProyecto && (
                      <div className="brief-item">
                        <strong>Objetivo:</strong> {task.objetivoProyecto}
                      </div>
                    )}
                    {task.publicoObjetivo && (
                      <div className="brief-item">
                        <strong>Público:</strong> {task.publicoObjetivo}
                      </div>
                    )}
                    {task.estiloDiseno && (
                      <div className="brief-item">
                        <strong>Estilo:</strong> {task.estiloDiseno}
                      </div>
                    )}
                    {task.referencias && (
                      <div className="brief-item">
                        <strong>Referencias:</strong> 
                        {task.referencias.includes('http') ? (
                          <a href={task.referencias} target="_blank" rel="noopener noreferrer" className="brief-link">
                            {task.referencias}
                          </a>
                        ) : (
                          <span>{task.referencias}</span>
                        )}
                      </div>
                    )}
                    {task.deadlineBrief && (
                      <div className="brief-item">
                        <strong>Deadline Brief:</strong> {new Date(task.deadlineBrief).toLocaleDateString('es-AR')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(task.clientPhone ||
              task.clientEmail ||
              task.clientAddress ||
              task.whatsappUrl ||
              task.locationUrl ||
              task.driveUrl) && (
              <div className="task-contact">
                <span className="section-label">Contacto cliente:</span>
                <div className="task-contact-links">
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      {task.clientPhone ? task.clientPhone : 'WhatsApp'}
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
                  const color = tagColorsCache.get(tag.toLowerCase()) || getTagColor(tag)
                  // Cargar color si no está en cache
                  if (!tagColorsCache.has(tag.toLowerCase())) {
                    loadTagColor(tag).then(loadedColor => {
                      setTagColorsCache(prev => {
                        const newMap = new Map(prev)
                        newMap.set(tag.toLowerCase(), loadedColor)
                        return newMap
                      })
                    })
                  }
                  return (
                    <span
                      key={tag}
                      className="task-tag"
                      style={{
                        background: color,
                        border: `2px solid ${color}`,
                        color: '#ffffff',
                        fontWeight: '600',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)'
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

            {/* Sección específica de Taller Gráfico - Visible para taller-grafico y admin */}
            {isTallerGrafico && hasOrdenId && (isAdmin || canManageImpresoras) && (
              <div className="task-taller-grafico-section">
                {/* Botón para cambiar etapa */}
                <button
                  type="button"
                  className="btn-view-etapas"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEtapasTallerModal(true)
                  }}
                  title="Cambiar etapa"
                >
                  {task.etapaTallerGrafico ? `📍 ${task.etapaTallerGrafico}` : '⚙️ Seleccionar Etapa'}
                </button>

                {/* Botón para ver historial */}
                <button
                  type="button"
                  className="btn-view-historial"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHistorialTallerModal(true)
                  }}
                  title="Ver historial de etapas"
                >
                  📋 Ver Historial de Etapas
                </button>

                {/* Botón para asignar impresora (solo para usuarios con permisos) */}
                {canManageImpresoras && (
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
              </div>
            )}

            {/* Sección específica de Instalaciones - Visible para instalaciones y admin */}
            {isInstalaciones && hasOrdenId && (isAdmin || canManageInstalaciones) && (
              <div className="task-instalaciones-section">
                {/* Botón para cambiar etapa */}
                <button
                  type="button"
                  className="btn-view-etapas"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEtapasInstalacionesModal(true)
                  }}
                  title="Cambiar etapa"
                >
                  {task.etapaInstalaciones ? `📍 ${task.etapaInstalaciones}` : '⚙️ Seleccionar Etapa'}
                </button>

                {/* Botón para ver historial */}
                <button
                  type="button"
                  className="btn-view-historial"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHistorialInstalacionesModal(true)
                  }}
                  title="Ver historial de etapas"
                >
                  📋 Ver Historial de Etapas
                </button>
              </div>
            )}

            {/* Sección Imprenta (Área de Impresión) - Modal IMPRESIÓN DIGITAL */}
            {isImprentaArea && hasOrdenId && (
              <div className="task-impresion-digital-section">
                <button
                  type="button"
                  className="btn-view-etapas"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEtapasImpresionDigitalModal(true)
                  }}
                  title="Abrir Impresión Digital"
                >
                  {task.etapaImpresionDigital ? `📍 ${task.etapaImpresionDigital}` : '🖨️ IMPRESIÓN DIGITAL'}
                </button>
              </div>
            )}

            {/* Sección específica de Taller de Imprenta - Visible para imprenta y admin */}
            {isTallerImprenta && hasOrdenId && (isAdmin || canManageTallerImprenta) && (
              <div className="task-taller-imprenta-section">
                {/* Botón para cambiar etapa */}
                <button
                  type="button"
                  className="btn-view-etapas"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEtapasTallerImprentaModal(true)
                  }}
                  title="Cambiar etapa"
                >
                  {task.etapaTallerImprenta ? `📍 ${task.etapaTallerImprenta}` : '⚙️ Seleccionar Etapa'}
                </button>

                {/* Botón para ver historial */}
                <button
                  type="button"
                  className="btn-view-historial"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHistorialTallerImprentaModal(true)
                  }}
                  title="Ver historial de etapas"
                >
                  📋 Ver Historial de Etapas
                </button>
              </div>
            )}

            {/* Sección específica de Metalúrgica - Visible para metalurgica y admin */}
            {isMetalurgica && hasOrdenId && (isAdmin || canManageMetalurgica) && (
              <div className="task-metalurgica-section">
                {/* Botón para cambiar etapa */}
                <button
                  type="button"
                  className="btn-view-etapas"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEtapasMetalurgicaModal(true)
                  }}
                  title="Cambiar etapa"
                >
                  {task.etapaMetalurgica ? `📍 ${task.etapaMetalurgica}` : '⚙️ Seleccionar Etapa'}
                </button>

                {/* Botón para ver historial */}
                <button
                  type="button"
                  className="btn-view-historial"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHistorialMetalurgicaModal(true)
                  }}
                  title="Ver historial de etapas"
                >
                  📋 Ver Historial de Etapas
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
          </div>}

          {!isMinimized && !isDragLightMode && <button
            type="button"
            className="task-toggle"
            onClick={(event) => {
              event.stopPropagation()
              setIsExpanded((prev) => !prev)
            }}
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          </button>}
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
                <h3>Checklist de {etiquetaOrden} {displayNumeroOrden}</h3>
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
        {showAudit && (
          <div
            className="modal-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowAudit(false)
            }}
            onTouchStart={(e) => {
              if (e.target === e.currentTarget) setShowAudit(false)
            }}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <h3>Auditoría {etiquetaOrden} {displayNumeroOrden}</h3>
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
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowAsignarImpresora(false)
            }}
            onTouchStart={(e) => {
              if (e.target === e.currentTarget) setShowAsignarImpresora(false)
            }}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <header className="modal-header">
                <h3>Asignar Impresora - {etiquetaOrden} {displayNumeroOrden}</h3>
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
                      // Corroborar metros en la ficha (ordenes_trabajo) antes de asignar impresora
                      await apiService.actualizarMetrosOrden(ordenId, metros, {
                        motivo: 'Taller Gráfico corroboró/ajustó los m² antes de asignar impresora.'
                      })
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
      {contextMenu && onMoveTask && columns.length > 0 && (
        <div
          className="task-card-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-title">Mover a →</div>
          {columns
            .filter((c) => c.id !== task.status)
            .map((col) => (
              <button
                key={col.id}
                type="button"
                className="context-menu-item"
                onClick={() => {
                  onMoveTask(task.id, col.id)
                  setContextMenu(null)
                }}
              >
                {col.label}
              </button>
            ))}
        </div>
      )}
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
      {/* Modal de Selector de Etapas Taller Gráfico */}
      {showEtapasTallerModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowEtapasTallerModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <header className="modal-header">
              <h3>Cambiar Etapa - Taller Gráfico - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowEtapasTallerModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <EtapaTallerGraficoSelector
                ordenId={ordenId}
                etapaActual={task.etapaTallerGrafico}
                onEtapaChange={() => {
                  setShowEtapasTallerModal(false)
                  // La actualización se maneja mediante el evento 'update-task-etapa'
                  // No es necesario recargar todas las tareas
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Modal de Selector de Etapas Instalaciones */}
      {showEtapasInstalacionesModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowEtapasInstalacionesModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <header className="modal-header">
              <h3>Cambiar Etapa - Instalaciones - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowEtapasInstalacionesModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <EtapaInstalacionesSelector
                ordenId={ordenId}
                etapaActual={task.etapaInstalaciones}
                onEtapaChange={() => {
                  setShowEtapasInstalacionesModal(false)
                  // La actualización se maneja mediante el evento 'update-task-etapa'
                  // No es necesario recargar todas las tareas
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Modal de Historial Taller Gráfico */}
      {showHistorialTallerModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowHistorialTallerModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '800px' }}
          >
            <header className="modal-header">
              <h3>Historial de Etapas - Taller Gráfico - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowHistorialTallerModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <HistorialEtapasTallerGrafico ordenId={ordenId} />
            </div>
          </div>
        </div>
      )}
      {/* Modal de Historial Instalaciones */}
      {showHistorialInstalacionesModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowHistorialInstalacionesModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '800px' }}
          >
            <header className="modal-header">
              <h3>Historial de Etapas - Instalaciones - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowHistorialInstalacionesModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <HistorialEtapasInstalaciones ordenId={ordenId} />
            </div>
          </div>
        </div>
      )}
      {/* Modal de Selector de Etapas Taller de Imprenta */}
      {showEtapasTallerImprentaModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowEtapasTallerImprentaModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <header className="modal-header">
              <h3>Cambiar Etapa - Taller de Imprenta - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowEtapasTallerImprentaModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <EtapaTallerImprentaSelector
                ordenId={ordenId}
                etapaActual={task.etapaTallerImprenta}
                onEtapaChange={() => {
                  setShowEtapasTallerImprentaModal(false)
                  // La actualización se maneja mediante el evento 'update-task-etapa'
                  // No es necesario recargar todas las tareas
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Modal IMPRESIÓN DIGITAL - Columna Imprenta (Área de Impresión) */}
      {showEtapasImpresionDigitalModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowEtapasImpresionDigitalModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <header className="modal-header">
              <h3>IMPRESIÓN DIGITAL - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowEtapasImpresionDigitalModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <EtapaImpresionDigitalSelector
                ordenId={ordenId}
                etapaActual={task.etapaImpresionDigital}
                onEtapaChange={() => setShowEtapasImpresionDigitalModal(false)}
              />
            </div>
          </div>
        </div>
      )}
      {/* Modal de Historial Taller de Imprenta */}
      {showHistorialTallerImprentaModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowHistorialTallerImprentaModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '800px' }}
          >
            <header className="modal-header">
              <h3>Historial de Etapas - Taller de Imprenta - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowHistorialTallerImprentaModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <HistorialEtapasTallerImprenta ordenId={ordenId} />
            </div>
          </div>
        </div>
      )}
      {/* Modal de Selector de Etapas Metalúrgica */}
      {showEtapasMetalurgicaModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowEtapasMetalurgicaModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <header className="modal-header">
              <h3>Cambiar Etapa - Metalúrgica - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowEtapasMetalurgicaModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <EtapaMetalurgicaSelector
                ordenId={ordenId}
                etapaActual={task.etapaMetalurgica}
                onEtapaChange={() => {
                  setShowEtapasMetalurgicaModal(false)
                  // La actualización se maneja mediante el evento 'update-task-etapa'
                  // No es necesario recargar todas las tareas
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Modal de Historial Metalúrgica */}
      {showHistorialMetalurgicaModal && hasOrdenId && (
        <div
          className="modal-overlay subtasks-modal"
          onClick={(e) => {
            e.stopPropagation()
            setShowHistorialMetalurgicaModal(false)
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '800px' }}
          >
            <header className="modal-header">
              <h3>Historial de Etapas - Metalúrgica - {etiquetaOrden} {displayNumeroOrden}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowHistorialMetalurgicaModal(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <HistorialEtapasMetalurgica ordenId={ordenId} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default memo(TaskCard)

