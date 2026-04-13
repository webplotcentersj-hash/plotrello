import { memo, useMemo, useState } from 'react'
import { DragDropContext, Droppable, type DroppableProvided, type DropResult } from '@hello-pangea/dnd'
import type { Task, TeamMember, ActivityEvent } from '../types/board'
import type { SectorRecord } from '../types/api'
import TaskCard from './TaskCard'
import { SIN_ETAPA_COLUMN_ID } from '../data/sectorEtapaKanban'
import './Board.css'

const EMPTY_ACTIVITY: ActivityEvent[] = []

export type EtapaKanbanColumnModel = {
  id: string
  label: string
  description?: string
  accent: string
}

type EtapaKanbanBoardProps = {
  columns: EtapaKanbanColumnModel[]
  groupedByColumnId: Record<string, Task[]>
  members: TeamMember[]
  activity?: ActivityEvent[]
  sectores?: SectorRecord[]
  onEtapaMove: (taskId: string, destinationColumnId: string) => Promise<void>
  /** Si se define, clic en tarjeta abre vista (solo lectura) */
  onViewTask?: (task: Task) => void
}

const EtapaColumn = memo(function EtapaColumn({
  column,
  tasks,
  members,
  maxInBoard,
  droppableProvided,
  isActive,
  activityByTaskId,
  membersById,
  sectores,
  onViewTask
}: {
  column: EtapaKanbanColumnModel
  tasks: Task[]
  members: TeamMember[]
  maxInBoard: number
  droppableProvided: DroppableProvided
  isActive: boolean
  activityByTaskId: Map<string, ActivityEvent[]>
  membersById: Map<string, TeamMember>
  sectores?: SectorRecord[]
  onViewTask?: (task: Task) => void
}) {
  const INITIAL_VISIBLE = 8
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? tasks : tasks.slice(0, INITIAL_VISIBLE)
  const hidden = Math.max(0, tasks.length - visible.length)
  const loadPct = maxInBoard > 0 ? (tasks.length / maxInBoard) * 100 : 0

  return (
    <div className={`board-column ${isActive ? 'column-active' : ''}`}>
      <div className="column-load-indicator" style={{ height: `${loadPct}%` }} />
      <header>
        <div>
          <p className="column-eyebrow">{column.label}</p>
          <h3>{column.description ?? '\u00a0'}</h3>
        </div>
        <span className="column-pill" style={{ background: column.accent }}>
          {tasks.length}
        </span>
      </header>
      <div
        className="column-body"
        ref={droppableProvided.innerRef}
        {...droppableProvided.droppableProps}
        style={{ minHeight: 120 }}
      >
        {visible.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            index={index}
            owner={membersById.get(task.ownerId)}
            sectores={sectores}
            activity={activityByTaskId.get(task.id) ?? EMPTY_ACTIVITY}
            members={members}
            columns={[]}
            onViewTask={onViewTask}
          />
        ))}
        {droppableProvided.placeholder}
        {tasks.length === 0 && <div className="column-empty">Sin fichas</div>}
        {tasks.length > INITIAL_VISIBLE && (
          <button type="button" className="column-show-more-btn" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Ver menos' : `Ver más (${hidden})`}
          </button>
        )}
      </div>
    </div>
  )
})

const EtapaKanbanBoard = ({
  columns,
  groupedByColumnId,
  members,
  activity = [],
  sectores,
  onEtapaMove,
  onViewTask
}: EtapaKanbanBoardProps) => {
  const [isDragging, setIsDragging] = useState(false)

  const membersById = useMemo(() => {
    const map = new Map<string, TeamMember>()
    for (const m of members) map.set(m.id, m)
    return map
  }, [members])

  const activityByTaskId = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>()
    for (const ev of activity) {
      const cur = map.get(ev.taskId)
      if (cur) cur.push(ev)
      else map.set(ev.taskId, [ev])
    }
    return map
  }, [activity])

  const maxInColumn = useMemo(() => {
    let m = 1
    for (const c of columns) {
      const n = groupedByColumnId[c.id]?.length ?? 0
      if (n > m) m = n
    }
    return m
  }, [columns, groupedByColumnId])

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false)
    window.dispatchEvent(new CustomEvent('board-dragging-changed', { detail: { dragging: false } }))
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    if (destination.droppableId === SIN_ETAPA_COLUMN_ID) return
    await onEtapaMove(draggableId, destination.droppableId)
  }

  return (
    <div className={`board-wrapper ${isDragging ? 'is-dragging' : ''}`}>
      <DragDropContext
        onDragStart={() => {
          setIsDragging(true)
          window.dispatchEvent(new CustomEvent('board-dragging-changed', { detail: { dragging: true } }))
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="columns-grid">
          {columns.map((column) => (
            <Droppable
              key={column.id}
              droppableId={column.id}
              isDropDisabled={column.id === SIN_ETAPA_COLUMN_ID}
            >
              {(provided, snapshot) => (
                <EtapaColumn
                  column={column}
                  tasks={groupedByColumnId[column.id] ?? []}
                  members={members}
                  maxInBoard={maxInColumn}
                  droppableProvided={provided}
                  isActive={snapshot.isDraggingOver}
                  activityByTaskId={activityByTaskId}
                  membersById={membersById}
                  sectores={sectores}
                  onViewTask={onViewTask}
                />
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}

export default EtapaKanbanBoard
