import { useCallback, useMemo, useRef, useState } from 'react'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import type { ColumnConfig, Task, TaskStatus, TeamMember, ActivityEvent } from '../types/board'
import type { SectorRecord } from '../types/api'
import Column from './Column'
import './Board.css'

type BoardProps = {
  columns: ColumnConfig[]
  tasks: Task[]
  allTasks: Task[]
  /** `sourceColumn` = columna de origen (drag); útil en tableros con reglas por flujo (ej. asesor-presupuestos). */
  onMoveTask: (taskId: string, destination: TaskStatus, sourceColumn?: TaskStatus) => void
  members: TeamMember[]
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  sectores?: SectorRecord[]
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
  activity?: ActivityEvent[]
  selectedTaskId?: string | null
  onSelectTask?: (taskId: string | null) => void
  onViewTask?: (task: Task) => void
  /** Ocultar UI de reclamo en tarjetas (tablero asesor/presupuestos) */
  hideReclamoUI?: boolean
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
  onSelectTask,
  onViewTask,
  hideReclamoUI
}: BoardProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const columnContainerRefCallbacks = useRef<
    Partial<Record<TaskStatus, (node: HTMLDivElement | null) => void>>
  >({})

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
    'armados-enviados-asesor-presupuestos': null,
    'no-aprobados-asesor-presupuestos': null,
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

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setIsDragging(false)
      window.dispatchEvent(new CustomEvent('board-dragging-changed', { detail: { dragging: false } }))
      const { destination, source, draggableId } = result
      if (!destination) return
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return
      }
      const dest = destination.droppableId as TaskStatus
      const src = source.droppableId as TaskStatus
      // Deja terminar el frame del DnD antes de actualizar estado React (menos tirón al soltar)
      requestAnimationFrame(() => {
        onMoveTask(draggableId, dest, src)
      })
    },
    [onMoveTask]
  )

  const getColumnContainerRef = useCallback((columnId: TaskStatus) => {
    let cb = columnContainerRefCallbacks.current[columnId]
    if (!cb) {
      cb = (node: HTMLDivElement | null) => {
        columnRefs.current[columnId] = node
      }
      columnContainerRefCallbacks.current[columnId] = cb
    }
    return cb
  }, [])

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
                  containerRef={getColumnContainerRef(column.id as TaskStatus)}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  sectores={sectores}
                  onMarkDelivered={onMarkDelivered}
                  activity={activity}
                  onMoveTask={onMoveTask}
                  columns={columns}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={onSelectTask}
                  onViewTask={onViewTask}
                  hideReclamoUI={hideReclamoUI}
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

