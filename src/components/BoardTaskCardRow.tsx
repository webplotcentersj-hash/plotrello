import { lazy, memo, Suspense, useMemo, type MouseEvent } from 'react'
import clsx from 'clsx'
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import type { ActivityEvent, ColumnConfig, Task, TaskStatus, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import { activityEventsEqual, draggableInlineStylesEqual } from './boardRbdMemo'

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
  isDragSurface = false
}: LiteShellProps) {
  const isNewMove = typeof task.uiMovedAt === 'number' && Date.now() - task.uiMovedAt < NEW_MOVE_MS

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

  return (
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
      title="Clic para expandir · doble clic para ver detalle"
    >
      <div className="task-minimized-label" title={`#${task.opNumber} — ${task.title}`}>
        {task.photoUrl ? (
          <span className="task-min-thumb" aria-hidden="true">
            <img src={task.photoUrl} alt="" loading="lazy" decoding="async" />
          </span>
        ) : null}
        <span className="task-min-op">#{task.opNumber}</span>
        <span className="task-min-sep">·</span>
        <span className="task-min-client">{task.title}</span>
      </div>
    </article>
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
      'presupuestoEnEspera'
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

  return true
}

export default memo(BoardTaskCardRowInner, boardTaskCardRowPropsAreEqual)
