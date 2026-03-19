import { memo, useMemo, type Ref } from 'react'
import { type DroppableProvided } from '@hello-pangea/dnd'
import type { ColumnConfig, Task, TaskStatus, TeamMember, ActivityEvent } from '../types/board'
import type { SectorRecord } from '../types/api'
import TaskCard from './TaskCard'

type ColumnProps = {
  column: ColumnConfig
  tasks: Task[]
  members: TeamMember[]
  totalColumnTasks: number
  maxTasksInColumn: number
  droppableProvided: DroppableProvided
  isActive: boolean
  containerRef: Ref<HTMLDivElement>
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  sectores?: SectorRecord[]
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
  activity?: ActivityEvent[]
  onMoveTask?: (taskId: string, destination: TaskStatus) => void
  columns?: ColumnConfig[]
  selectedTaskId?: string | null
  onSelectTask?: (taskId: string | null) => void
}

const Column = ({
  column,
  tasks,
  members,
  totalColumnTasks,
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
  onSelectTask
}: ColumnProps) => {
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

  return (
    <div className={`board-column ${isActive ? 'column-active' : ''}`} ref={containerRef}>
      <div className="column-load-indicator" style={{ height: `${loadPercentage}%` }} />
      <header>
        <div>
          <p className="column-eyebrow">{column.label}</p>
          <h3>{column.description}</h3>
        </div>
        <span className="column-pill" style={{ background: column.accent }}>
          {totalColumnTasks}
        </span>
      </header>

      <div className="column-body" ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
        {tasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            index={index}
            owner={membersById.get(task.ownerId)}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            sectores={sectores}
            onMarkDelivered={onMarkDelivered}
            activity={activityByTaskId.get(task.id) ?? []}
            members={members}
            onMoveTask={onMoveTask}
            columns={columns}
            isSelected={selectedTaskId === task.id}
            onSelect={onSelectTask}
          />
        ))}
        {droppableProvided.placeholder}

        {tasks.length === 0 && <div className="column-empty">Aún no hay tarjetas aquí</div>}
      </div>
    </div>
  )
}

export default memo(Column)

