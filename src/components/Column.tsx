import { memo, useMemo, useState, type CSSProperties, type Ref } from 'react'
import { Draggable, type DroppableProvided } from '@hello-pangea/dnd'
import type { ColumnConfig, Task, TaskStatus, TeamMember, ActivityEvent } from '../types/board'
import type { SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import BoardTaskCardRow from './BoardTaskCardRow'

/** Referencia estable para memo(TaskCard); `?? []` en cada render rompe la igualdad superficial */
const EMPTY_ACTIVITY: ActivityEvent[] = []

type ColumnProps = {
  column: ColumnConfig
  tasks: Task[]
  members: TeamMember[]
  maxTasksInColumn: number
  droppableProvided: DroppableProvided
  isActive: boolean
  containerRef: Ref<HTMLDivElement>
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  sectores?: SectorRecord[]
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
  activity?: ActivityEvent[]
  onMoveTask?: (taskId: string, destination: TaskStatus, sourceColumn?: TaskStatus) => void
  columns?: ColumnConfig[]
  selectedTaskId?: string | null
  onSelectTask?: (taskId: string | null) => void
  onViewTask?: (task: Task) => void
  hideReclamoUI?: boolean
  /** True mientras se arrastra en el tablero: filas no arrastradas usan shell ligero (sin TaskCard completo). */
  isBoardDragging?: boolean
  /** Teléfono: sin arrastre de fichas. */
  disableDrag?: boolean
}

const Column = ({
  column,
  tasks,
  members,
  maxTasksInColumn,
  droppableProvided,
  isActive,
  containerRef,
  onEditTask,
  onDeleteTask,
  sectores,
  onMarkDelivered,
  activity,
  onMoveTask,
  columns = [],
  selectedTaskId,
  onSelectTask,
  onViewTask,
  hideReclamoUI,
  isBoardDragging = false,
  disableDrag = false
}: ColumnProps) => {
  const { isAdmin } = useAuth()
  const INITIAL_VISIBLE_TASKS = 5
  const [showAllTasks, setShowAllTasks] = useState(false)

  // Calcular el porcentaje de carga de la columna
  const loadPercentage = maxTasksInColumn > 0 ? (tasks.length / maxTasksInColumn) * 100 : 0
  const membersById = useMemo(() => {
    const map = new Map<string, TeamMember>()
    for (const member of members) map.set(member.id, member)
    return map
  }, [members])

  const activityByTaskId = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>()
    for (const event of activity ?? []) {
      const current = map.get(event.taskId)
      if (current) current.push(event)
      else map.set(event.taskId, [event])
    }
    return map
  }, [activity])

  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, INITIAL_VISIBLE_TASKS)
  const hiddenTasksCount = Math.max(0, tasks.length - visibleTasks.length)

  return (
    <div
      className={`board-column ${isActive ? 'column-active' : ''}`}
      ref={containerRef}
      style={{ '--column-accent': column.accent } as CSSProperties}
    >
      <div className="column-load-indicator" style={{ height: `${loadPercentage}%` }} />
      <header>
        <div>
          <p className="column-eyebrow">{column.label}</p>
          <h3>{column.description}</h3>
        </div>
        <span className="column-pill" style={{ background: column.accent }}>
          {tasks.length}
        </span>
      </header>

      <div className="column-body" ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
        {visibleTasks.map((task, index) => (
          <Draggable
            key={task.id}
            draggableId={task.id}
            index={index}
            isDragDisabled={disableDrag || (Boolean(task.opBloqueada) && !isAdmin)}
          >
            {(provided, snapshot) => (
              <BoardTaskCardRow
                isBoardDragging={isBoardDragging}
                provided={provided}
                snapshot={snapshot}
                task={task}
                index={index}
                owner={membersById.get(task.ownerId)}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                sectores={sectores}
                onMarkDelivered={onMarkDelivered}
                activity={activityByTaskId.get(task.id) ?? EMPTY_ACTIVITY}
                members={members}
                onMoveTask={onMoveTask}
                columns={columns}
                isSelected={selectedTaskId === task.id}
                onSelect={onSelectTask}
                onViewTask={onViewTask}
                hideReclamoUI={hideReclamoUI}
                touchColumnMove={disableDrag}
              />
            )}
          </Draggable>
        ))}
        {droppableProvided.placeholder}

        {tasks.length === 0 && <div className="column-empty">Aún no hay tarjetas aquí</div>}
        {tasks.length > INITIAL_VISIBLE_TASKS && (
          <button
            type="button"
            className="column-show-more-btn"
            onClick={() => setShowAllTasks((prev) => !prev)}
          >
            {showAllTasks ? 'Ver menos' : `Ver más (${hiddenTasksCount})`}
          </button>
        )}
      </div>
    </div>
  )
}

export default memo(Column)

