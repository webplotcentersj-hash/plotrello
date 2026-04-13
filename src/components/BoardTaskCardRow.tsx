import clsx from 'clsx'
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import type { ActivityEvent, ColumnConfig, Task, TaskStatus, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import TaskCard from './TaskCard'

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
}

/**
 * Mientras hay drag en el tablero, las fichas que no se arrastran se pintan en modo mínimo
 * (sin montar TaskCard: evita decenas de hooks y efectos en cada frame de hello-pangea/dnd).
 */
export default function BoardTaskCardRow(props: BoardTaskCardRowProps) {
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
    hideReclamoUI
  } = props

  const lite = isBoardDragging && !snapshot.isDragging

  if (lite) {
    const isNewMove = typeof task.uiMovedAt === 'number' && Date.now() - task.uiMovedAt < NEW_MOVE_MS
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
            'is-drag-surface': true,
            'is-new-move': isNewMove,
            'is-selected': isSelected
          }
        )}
      >
        <div className="task-minimized-label" title={`#${task.opNumber} — ${task.title}`}>
          <span className="task-min-op">#{task.opNumber}</span>
          <span className="task-min-sep">·</span>
          <span className="task-min-client">{task.title}</span>
        </div>
      </article>
    )
  }

  return (
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
    />
  )
}
