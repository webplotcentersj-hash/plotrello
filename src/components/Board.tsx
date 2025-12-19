import { useMemo, useRef } from 'react'
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
  activity
}: BoardProps) => {
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
    return columns.reduce<Record<string, Task[]>>((acc, column) => {
      acc[column.id] = tasks.filter((task) => task.status === column.id)
      return acc
    }, {})
  }, [tasks, columns])

  // Calcular el máximo de tareas en cualquier columna para normalizar la barra
  const maxTasksInColumn = useMemo(() => {
    return Math.max(...Object.values(groupedByStatus).map((tasks) => tasks.length), 1)
  }, [groupedByStatus])

  const handleDragEnd = (result: DropResult) => {
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
    <div className="board-wrapper">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="columns-grid">
          {columns.map((column) => (
            <Droppable droppableId={column.id} key={column.id}>
              {(provided, snapshot) => (
                <Column
                  column={column}
                  tasks={groupedByStatus[column.id] ?? []}
                  members={members}
                  totalColumnTasks={allTasks.filter((task) => task.status === column.id).length}
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

