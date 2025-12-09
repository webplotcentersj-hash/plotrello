import type { Ref } from 'react'
import { type DroppableProvided } from '@hello-pangea/dnd'
import type { ColumnConfig, Task, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import TaskCard from './TaskCard'

type ColumnProps = {
  column: ColumnConfig
  tasks: Task[]
  members: TeamMember[]
  totalColumnTasks: number
  droppableProvided: DroppableProvided
  isActive: boolean
  containerRef: Ref<HTMLDivElement>
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  sectores?: SectorRecord[]
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
}

const Column = ({
  column,
  tasks,
  members,
  totalColumnTasks,
  droppableProvided,
  isActive,
  containerRef,
  onEditTask,
  onDeleteTask,
  sectores,
  onMarkDelivered
}: ColumnProps) => {
  return (
    <div className={`board-column ${isActive ? 'column-active' : ''}`} ref={containerRef}>
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
            owner={members.find((member) => member.id === task.ownerId)}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            sectores={sectores}
            onMarkDelivered={onMarkDelivered}
          />
        ))}
        {droppableProvided.placeholder}

        {tasks.length === 0 && <div className="column-empty">Aún no hay tarjetas aquí</div>}
      </div>
    </div>
  )
}

export default Column

