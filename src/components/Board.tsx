import { startTransition, useCallback, useMemo, useRef, useState, memo, type ReactNode } from 'react'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import type { ColumnConfig, Task, TaskStatus, TeamMember, ActivityEvent } from '../types/board'
import type { SectorRecord } from '../types/api'
import { isTaskHiddenFromKanban } from '../utils/dataMappers'
import Column from './Column'
import './Board.css'

type BoardProps = {
  columns: ColumnConfig[]
  tasks: Task[]
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
  /** Enviar ficha a la agenda del asesor. */
  onAgendarVisita?: (task: Task) => void
  /** Teléfono: desactiva arrastre (las fichas no se mueven con el dedo). */
  disableDrag?: boolean
  /** Excluir fichas eliminadas u ocultas del tablero (asesor/presupuestos). */
  excludeHiddenFromKanban?: boolean
  /** Panel extra al final de la grilla, en el hueco que dejan las columnas de la última fila. */
  sidePanel?: ReactNode
}

const Board = ({
  columns,
  tasks,
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
  hideReclamoUI,
  onAgendarVisita,
  disableDrag = false,
  excludeHiddenFromKanban = false,
  sidePanel
}: BoardProps) => {
  const [isDragging, setIsDragging] = useState(false)
  /** Evita que un endDragUi diferido pise un drag nuevo (setTimeout tras soltar). */
  const dragSessionRef = useRef(0)
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
    'visitas-a-coordinar': null,
    'asesor-tecnico': null,
    presupuestos: null,
    'armados-enviados-asesor-presupuestos': null,
    'no-aprobados-asesor-presupuestos': null,
    'finalizado-asesor-presupuestos': null
  })

  const boardTasks = useMemo(() => {
    if (!excludeHiddenFromKanban) return tasks
    return tasks.filter((task) => !isTaskHiddenFromKanban(task))
  }, [tasks, excludeHiddenFromKanban])

  const groupedByStatus = useMemo(() => {
    const emptyGroups = columns.reduce<Record<string, Task[]>>((acc, column) => {
      acc[column.id] = []
      return acc
    }, {})

    for (const task of boardTasks) {
      if (emptyGroups[task.status]) {
        emptyGroups[task.status].push(task)
      }
    }

    return emptyGroups
  }, [boardTasks, columns])

  // Calcular el máximo de tareas en cualquier columna para normalizar la barra
  const maxTasksInColumn = useMemo(() => {
    return Math.max(...Object.values(groupedByStatus).map((tasks) => tasks.length), 1)
  }, [groupedByStatus])

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result

      const endDragUi = () => {
        startTransition(() => {
          setIsDragging(false)
          window.dispatchEvent(new CustomEvent('board-dragging-changed', { detail: { dragging: false } }))
        })
      }

      // Canceló fuera del tablero o no hubo destino: solo quitar modo drag.
      if (!destination) {
        endDragUi()
        return
      }
      // Soltó en el mismo lugar: sin onMoveTask.
      if (destination.droppableId === source.droppableId && destination.index === source.index) {
        endDragUi()
        return
      }

      const dest = destination.droppableId as TaskStatus
      const src = source.droppableId as TaskStatus
      const sessionAtDrop = dragSessionRef.current

      /*
       * Evitar dos renders pesados seguidos al soltar:
       * antes: setIsDragging(false) → remontaba todas las TaskCard; al frame siguiente setTasks en onMoveTask.
       * Ahora: dos rAF dejan cerrar el drop en hello-pangea; luego onMoveTask y, en el siguiente macrotask,
       * endDragUi (startTransition) para alinear con el update optimista. sessionAtDrop evita pisar un drag nuevo.
       */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void onMoveTask(draggableId, dest, src)
          setTimeout(() => {
            if (dragSessionRef.current !== sessionAtDrop) return
            endDragUi()
          }, 0)
        })
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
    <div
      className={`board-wrapper ${isDragging ? 'is-dragging' : ''}${disableDrag ? ' board-wrapper--no-drag' : ''}`}
    >
      <DragDropContext
        onDragStart={() => {
          dragSessionRef.current += 1
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
                  maxTasksInColumn={maxTasksInColumn}
                  droppableProvided={provided}
                  isActive={snapshot.isDraggingOver}
                  isBoardDragging={isDragging}
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
                  onAgendarVisita={onAgendarVisita}
                  disableDrag={disableDrag}
                />
              )}
            </Droppable>
          ))}
          {sidePanel}
        </div>
      </DragDropContext>
    </div>
  )
}

export default memo(Board)

