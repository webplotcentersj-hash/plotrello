import { lazy, memo, Suspense, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import type { ActivityEvent, ColumnConfig, Task, TaskStatus, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import { activityEventsEqual, draggableInlineStylesEqual } from './boardRbdMemo'
/* Estilos de ficha: el shell liviano los necesita aunque TaskCard aún no se haya cargado (lazy). */
import './TaskCard.css'
import OpCobroPill from './OpCobroPill'

const TaskCard = lazy(() => import('./TaskCard'))

const NEW_MOVE_MS = 60 * 60 * 1000

export type BoardTaskCardRowProps = {
  isBoardDragging: boolean
  provided: DraggableProvided
  snapshot: DraggableStateSnapshot
  task: Task
  index: number
  owner?: TeamMember
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  sectores?: SectorRecord[]
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
  activity?: ActivityEvent[]
  members?: TeamMember[]
  onMoveTask?: (taskId: string, destination: TaskStatus, sourceColumn?: TaskStatus) => void
  columns?: ColumnConfig[]
  isSelected?: boolean
  onSelect?: (taskId: string | null) => void
  onViewTask?: (task: Task) => void
  hideReclamoUI?: boolean
  onAgendarVisita?: (task: Task) => void
  /** Tablero en teléfono: panel «Mover a…» en la ficha. */
  touchColumnMove?: boolean
}

type LiteShellProps = {
  task: Task
  provided: DraggableProvided
  snapshot: DraggableStateSnapshot
  isSelected?: boolean
  hideReclamoUI?: boolean
  onSelect?: (taskId: string | null) => void
  onViewTask?: (task: Task) => void
  onAgendarVisita?: (task: Task) => void
  onMoveTask?: (taskId: string, destination: TaskStatus, sourceColumn?: TaskStatus) => void
  columns?: ColumnConfig[]
  isDragSurface?: boolean
}

function BoardTaskCardLiteShell({
  task,
  provided,
  snapshot,
  isSelected,
  hideReclamoUI,
  onSelect,
  onViewTask,
  onAgendarVisita,
  onMoveTask,
  columns = [],
  isDragSurface = false
}: LiteShellProps) {
  const [, setTick] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ left: number; top: number } | null>(null)
  const isNewMove = typeof task.uiMovedAt === 'number' && Date.now() - task.uiMovedAt < NEW_MOVE_MS

  useEffect(() => {
    if (!isNewMove || typeof task.uiMovedAt !== 'number') return
    const remaining = Math.max(0, NEW_MOVE_MS - (Date.now() - task.uiMovedAt))
    const t = window.setTimeout(() => setTick((x) => x + 1), remaining + 50)
    return () => window.clearTimeout(t)
  }, [isNewMove, task.uiMovedAt])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const t = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', close)
    }
  }, [contextMenu])

  const handleClick = (e: MouseEvent) => {
    if (snapshot.isDragging) return
    onSelect?.(task.id)
    e.stopPropagation()
  }

  const handleDoubleClick = (e: MouseEvent) => {
    if (snapshot.isDragging) return
    onViewTask?.(task)
    e.stopPropagation()
  }

  const moveTargets = columns.filter((c) => c.id !== task.status)
  const canAgendar = Boolean(onAgendarVisita)
  const canMove = Boolean(onMoveTask && moveTargets.length > 0)

  return (
    <>
    <article
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...(provided.dragHandleProps ?? {})}
      className={clsx(
        (provided.draggableProps as { className?: string }).className,
        (provided.dragHandleProps as { className?: string } | undefined)?.className,
        'task-card',
        `priority-${task.priority}`,
        {
          'planilla-preliminar': task.planillaPreliminar,
          'ficha-tecnica-incompleta': task.fichaTecnicaIncompleta,
          'ficha-tecnica-cargada': task.fichaTecnicaCargada,
          'presupuesto-enviado': task.presupuestoEnviadoCliente,
          'presupuesto-armado': task.presupuestoArmado,
          'presupuesto-en-espera': task.presupuestoEnEspera,
          'en-reclamo': task.enReclamo && !hideReclamoUI,
          'is-minimized': true,
          'is-collapsed': true,
          'is-drag-surface': isDragSurface,
          'is-new-move': isNewMove,
          'is-selected': isSelected
        }
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        if (!canAgendar && !canMove) return
        e.preventDefault()
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        const itemCount = (canAgendar ? 1 : 0) + moveTargets.length
        const estHeight = 40 + itemCount * 44 + 16
        let left = rect.right + 8
        let top = Math.max(8, Math.min(e.clientY - 12, window.innerHeight - estHeight - 8))
        if (left + 220 > window.innerWidth - 8) left = Math.max(8, rect.left - 228)
        setContextMenu({ left, top })
      }}
      title="Clic para expandir · doble clic para ver detalle"
    >
      <div className="task-minimized-label" title={`#${task.opNumber} — ${task.title}`}>
        {task.photoUrl ? (
          <span className="task-min-thumb" aria-hidden="true">
            <img src={task.photoUrl} alt="" loading="lazy" decoding="async" />
          </span>
        ) : null}
        <span className="task-min-op">#{task.opNumber}</span>
        <OpCobroPill
          marcadaPagada={task.marcadaPagada}
          sinPago={task.sinPago}
          pagoCuentaCorriente={task.pagoCuentaCorriente}
          montoPagoParcial={task.montoPagoParcial}
        />
        <span className="task-min-sep">·</span>
        <span className="task-min-client">{task.title}</span>
        {onAgendarVisita && (
          <button
            type="button"
            className="task-min-agendar"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onAgendarVisita(task)
            }}
            title="Agendar visita"
            aria-label="Agendar visita"
          >
            Agenda
          </button>
        )}
      </div>
      {(task.fichaTecnicaCargada ||
        task.presupuestoArmado ||
        task.presupuestoEnviadoCliente ||
        task.presupuestoEnEspera) && (
        <div className="task-min-checklist" aria-label="Estado presupuesto">
          {task.fichaTecnicaCargada ? (
            <span className="task-min-chip task-min-chip--ficha">Ficha</span>
          ) : null}
          {task.presupuestoArmado ? (
            <span className="task-min-chip task-min-chip--armado">Armado</span>
          ) : null}
          {task.presupuestoEnviadoCliente ? (
            <span className="task-min-chip task-min-chip--enviado">Enviado</span>
          ) : null}
          {task.presupuestoEnEspera ? (
            <span className="task-min-chip task-min-chip--espera">En espera</span>
          ) : null}
        </div>
      )}
    </article>
    {contextMenu &&
      createPortal(
        <div
          className="task-card-context-menu"
          style={{ left: contextMenu.left, top: contextMenu.top }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {onAgendarVisita && (
            <button
              type="button"
              className="context-menu-item context-menu-item--agenda"
              role="menuitem"
              onClick={() => {
                onAgendarVisita(task)
                setContextMenu(null)
              }}
            >
              Agendar visita
            </button>
          )}
          {canMove && onMoveTask && (
            <>
              <div className="context-menu-title">Mover a →</div>
              {moveTargets.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  className="context-menu-item"
                  role="menuitem"
                  onClick={() => {
                    onMoveTask(task.id, col.id, task.status)
                    setContextMenu(null)
                  }}
                >
                  {col.label}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

/**
 * Por defecto solo la ficha seleccionada (o la que se arrastra) monta TaskCard completo.
 * El resto usa shell liviano: evita cientos de hooks/efectos al cargar el tablero.
 */
function BoardTaskCardRowInner(props: BoardTaskCardRowProps) {
  const {
    isBoardDragging,
    provided,
    snapshot,
    task,
    index,
    owner,
    onEdit,
    onDelete,
    sectores,
    onMarkDelivered,
    activity,
    members,
    onMoveTask,
    columns,
    isSelected,
    onSelect,
    onViewTask,
    hideReclamoUI,
    onAgendarVisita,
    touchColumnMove = false
  } = props

  const explicitMoveSheet = useMemo(() => {
    if (!touchColumnMove || !onMoveTask || !columns?.length) return undefined
    const targets = columns.filter((c) => c.id !== task.status).map((c) => ({ id: c.id, label: c.label }))
    if (targets.length === 0) return undefined
    return {
      targets,
      onPick: (destinationId: string) => onMoveTask(task.id, destinationId as TaskStatus, task.status)
    }
  }, [touchColumnMove, onMoveTask, columns, task.id, task.status])

  const useLiteShell =
    (!isSelected && !snapshot.isDragging) || (isBoardDragging && !snapshot.isDragging)

  if (useLiteShell) {
    return (
      <BoardTaskCardLiteShell
        task={task}
        provided={provided}
        snapshot={snapshot}
        isSelected={isSelected}
        hideReclamoUI={hideReclamoUI}
        onSelect={onSelect}
        onViewTask={onViewTask}
        onAgendarVisita={onAgendarVisita}
        onMoveTask={onMoveTask}
        columns={columns}
        isDragSurface={isBoardDragging}
      />
    )
  }

  const liteFallback = (
    <BoardTaskCardLiteShell
      task={task}
      provided={provided}
      snapshot={snapshot}
      isSelected={isSelected}
      hideReclamoUI={hideReclamoUI}
      onSelect={onSelect}
      onViewTask={onViewTask}
      onAgendarVisita={onAgendarVisita}
      onMoveTask={onMoveTask}
      columns={columns}
    />
  )

  return (
    <Suspense fallback={liteFallback}>
      <TaskCard
        task={task}
        index={index}
        owner={owner}
        onEdit={onEdit}
        onDelete={onDelete}
        sectores={sectores}
        onMarkDelivered={onMarkDelivered}
        activity={activity}
        members={members}
        onMoveTask={onMoveTask}
        columns={columns}
        isSelected={isSelected}
        onSelect={onSelect}
        onViewTask={onViewTask}
        isDraggable={false}
        boardDnD={{ provided, snapshot }}
        hideReclamoUI={hideReclamoUI}
        onAgendarVisita={onAgendarVisita}
        explicitMoveSheet={explicitMoveSheet}
      />
    </Suspense>
  )
}

function boardTaskCardRowPropsAreEqual(
  prev: BoardTaskCardRowProps,
  next: BoardTaskCardRowProps
): boolean {
  if (prev.isBoardDragging !== next.isBoardDragging) return false
  if (prev.touchColumnMove !== next.touchColumnMove) return false

  const ps = prev.snapshot
  const ns = next.snapshot
  if (ps.isDragging || ns.isDragging) return false
  if (
    ps.isDropAnimating !== ns.isDropAnimating ||
    ps.combineWith !== ns.combineWith ||
    ps.combineTargetFor !== ns.combineTargetFor ||
    ps.mode !== ns.mode ||
    ps.isClone !== ns.isClone
  ) {
    return false
  }

  if (!draggableInlineStylesEqual(prev.provided.draggableProps.style, next.provided.draggableProps.style)) {
    return false
  }

  if (prev.task !== next.task) {
    if (prev.task.id !== next.task.id) return false
    const keys = [
      'status',
      'title',
      'opNumber',
      'priority',
      'updatedAt',
      'workingUser',
      'entregado',
      'assignedSector',
      'uiMovedAt',
      'panolSlot',
      'summary',
      'photoUrl',
      'opBloqueada',
      'enReclamo',
      'reclamoMotivo',
      'planillaPreliminar',
      'fichaTecnicaIncompleta',
      'fichaTecnicaCargada',
      'presupuestoEnviadoCliente',
      'presupuestoArmado',
      'presupuestoEnEspera',
      'marcadaPagada',
      'sinPago',
      'pagoCuentaCorriente',
      'montoPagoParcial',
      'estimatedTime'
    ] as const
    for (const k of keys) {
      if (prev.task[k] !== next.task[k]) return false
    }
  }

  if (prev.index !== next.index) return false
  if (prev.isSelected !== next.isSelected) return false
  if (prev.owner !== next.owner) return false
  if (!activityEventsEqual(prev.activity, next.activity)) return false
  if (prev.members !== next.members) return false
  if (prev.sectores !== next.sectores) return false
  if (prev.columns !== next.columns) return false
  if (prev.onEdit !== next.onEdit) return false
  if (prev.onDelete !== next.onDelete) return false
  if (prev.onMarkDelivered !== next.onMarkDelivered) return false
  if (prev.onMoveTask !== next.onMoveTask) return false
  if (prev.onSelect !== next.onSelect) return false
  if (prev.onViewTask !== next.onViewTask) return false
  if (prev.hideReclamoUI !== next.hideReclamoUI) return false
  if (prev.onAgendarVisita !== next.onAgendarVisita) return false

  return true
}

export default memo(BoardTaskCardRowInner, boardTaskCardRowPropsAreEqual)
