import { useMemo, useRef, useState } from 'react'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import type { ColumnConfig, Task, TaskStatus, TeamMember, ActivityEvent } from '../types/board'
import type { SectorRecord } from '../types/api'
import Column from './Column'
import './Board.css'

type BoardProps = {
  columns: ColumnConfig[]
  tasks: Task[]
  allTasks: Task[]
  onMoveTask: (taskId: string, destination: TaskStatus) => void
  members: TeamMember[]
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  sectores?: SectorRecord[]
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
  activity?: ActivityEvent[]
  selectedTaskId?: string | null
  onSelectTask?: (taskId: string | null) => void
}

const Board = ({
  columns,
  tasks,
  allTasks,
  onMoveTask,
  members,
  onEditTask,
  onDeleteTask,
  sectores,
  onMarkDelivered,
  activity,
  selectedTaskId,
  onSelectTask
}: BoardProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const columnRefs = useRef<Record<TaskStatus, HTMLDivElement | null>>({
    'diseno-grafico': null,
    'diseno-proceso': null,
    'en-espera': null,
    imprenta: null,
    'taller-imprenta': null,
    'taller-grafico': null,
    instalaciones: null,
    metalurgica: null,
    'finalizado-taller': null,
    'almacen-entrega': null,
    'asesor-tecnico': null,
    presupuestos: null,
    'finalizado-asesor-presupuestos': null
  })

  const groupedByStatus = useMemo(() => {
    const emptyGroups = columns.reduce<Record<string, Task[]>>((acc, column) => {
      acc[column.id] = []
      return acc
    }, {})

    for (const task of tasks) {
      if (emptyGroups[task.status]) {
        emptyGroups[task.status].push(task)
      }
    }

    return emptyGroups
  }, [tasks, columns])

  const totalByStatus = useMemo(() => {
    const counts = columns.reduce<Record<string, number>>((acc, column) => {
      acc[column.id] = 0
      return acc
    }, {})
    for (const task of allTasks) {
      if (typeof counts[task.status] === 'number') {
        counts[task.status] += 1
      }
    }
    return counts
  }, [allTasks, columns])

  // Calcular el máximo de tareas en cualquier columna para normalizar la barra
  const maxTasksInColumn = useMemo(() => {
    return Math.max(...Object.values(groupedByStatus).map((tasks) => tasks.length), 1)
  }, [groupedByStatus])

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false)
    const { destination, source, draggableId } = result
    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }
    onMoveTask(draggableId, destination.droppableId as TaskStatus)
  }

  return (
    <div className={`board-wrapper ${isDragging ? 'is-dragging' : ''}`}>
      <DragDropContext
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
      >
        <div className="columns-grid">
          {columns.map((column) => (
            <Droppable droppableId={column.id} key={column.id}>
              {(provided, snapshot) => (
                <Column
                  column={column}
                  tasks={groupedByStatus[column.id] ?? []}
                  members={members}
                  totalColumnTasks={totalByStatus[column.id] ?? 0}
                  maxTasksInColumn={maxTasksInColumn}
                  droppableProvided={provided}
                  isActive={snapshot.isDraggingOver}
                  containerRef={(node) => {
                    columnRefs.current[column.id as TaskStatus] = node
                  }}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  sectores={sectores}
                  onMarkDelivered={onMarkDelivered}
                  activity={activity}
                  onMoveTask={onMoveTask}
                  columns={columns}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={onSelectTask}
                />
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}

export default Board

