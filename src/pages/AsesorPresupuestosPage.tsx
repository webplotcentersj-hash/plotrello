import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Board from '../components/Board'
import Header from '../components/Header'
import FiltersBar from '../components/FiltersBar'
import TaskEditModal from '../components/TaskEditModal'
import FichaNoOPModal from '../components/FichaNoOPModal'
import AgendaAsesorTecnico from '../components/AgendaAsesorTecnico'
import HistorialFichasAsesorPanel from '../components/HistorialFichasAsesorPanel'
import { ASESOR_PRESUPUESTOS_COLUMNS } from '../data/asesorPresupuestosColumns'
import type { ActivityEvent, Priority, Task, TaskStatus, TeamMember } from '../types/board'
import type { MaterialRecord, SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  mapStatusToEstado,
  parseTaskIdToOrdenId,
  taskToOrdenPayload
} from '../utils/dataMappers'
import { subscribeOrdenesBroadcast } from '../utils/ordenesBroadcast'
import './AsesorPresupuestosPage.css'

/** Columnas del Kanban asesor: el Board agrupa solo por `task.status`. */
const ASESOR_KANBAN_STATUSES: TaskStatus[] = [
  'asesor-tecnico',
  'presupuestos',
  'finalizado-asesor-presupuestos'
]

/**
 * Si la orden entra al filtro por sector/sectores pero el estado mapeado sigue siendo de otro
 * tablero (p. ej. En espera), sin esto la tarjeta no cae en ninguna columna.
 */
function normalizeTaskForAsesorKanban(task: Task): Task {
  if (ASESOR_KANBAN_STATUSES.includes(task.status)) {
    return task
  }
  const sector = task.assignedSector || task.sectorInicial
  if (sector === 'Asesor Técnico') {
    return { ...task, status: 'asesor-tecnico' }
  }
  if (sector === 'Presupuestos') {
    return { ...task, status: 'presupuestos' }
  }
  const inAt = task.sectores?.includes('Asesor Técnico')
  const inPr = task.sectores?.includes('Presupuestos')
  if (inAt && !inPr) {
    return { ...task, status: 'asesor-tecnico' }
  }
  if (inPr && !inAt) {
    return { ...task, status: 'presupuestos' }
  }
  if (inAt && inPr) {
    return task.assignedSector === 'Presupuestos'
      ? { ...task, status: 'presupuestos' }
      : { ...task, status: 'asesor-tecnico' }
  }
  return { ...task, status: 'asesor-tecnico' }
}

type AsesorPresupuestosPageProps = {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  materialesCatalog: MaterialRecord[]
  onNavigateToStats?: () => void
  onNavigateToUsuarios?: () => void
  onNavigateToChat?: () => void
  onLogout?: () => void
  onReloadData?: (options?: { silent?: boolean }) => Promise<void>
}

const AsesorPresupuestosPage = ({
  tasks,
  activity,
  teamMembers,
  sectores,
  materialesCatalog,
  onNavigateToStats,
  onNavigateToUsuarios,
  onNavigateToChat,
  onLogout,
  onReloadData
}: AsesorPresupuestosPageProps) => {
  const navigate = useNavigate()
  const { isAdmin, isAsesorTecnico, isPresupuestos, usuario } = useAuth()
  const [statusFocus, setStatusFocus] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  /** Modal de ficha No OP: null = crear, Task = editar (misma UI que al crear). */
  const [fichaModalOpen, setFichaModalOpen] = useState(false)
  const [fichaModalEditTask, setFichaModalEditTask] = useState<Task | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'kanban' | 'agenda' | 'historial'>('kanban')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Verificar permisos
  const canAccess = isAdmin || isAsesorTecnico || isPresupuestos

  // Para la agenda: asesor técnico ve la suya; admin y presupuestos ven la del primer asesor técnico
  const idAsesorParaAgenda = useMemo(() => {
    if (!usuario) return null
    if (isAsesorTecnico) return usuario.id
    const asesor = teamMembers.find((m) => m.role === 'asesor-tecnico')
    return asesor ? parseInt(asesor.id, 10) : null
  }, [usuario, isAsesorTecnico, teamMembers])

  // Filtrar tareas solo de Asesor Técnico y Presupuestos
  const filteredTasks = useMemo(() => {
    if (!canAccess) return []
    
    let filtered = tasks.filter((task) => {
      const sector = task.assignedSector || task.sectorInicial
      return (
        sector === 'Asesor Técnico' ||
        sector === 'Presupuestos' ||
        task.status === 'asesor-tecnico' ||
        task.status === 'presupuestos' ||
        task.status === 'finalizado-asesor-presupuestos' ||
        (task.sectores && (
          task.sectores.includes('Asesor Técnico') ||
          task.sectores.includes('Presupuestos')
        ))
      )
    })

    // Aplicar filtros
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((task) => {
        const tags = task.tags ?? []
        return (
          String(task.opNumber ?? '')
            .toLowerCase()
            .includes(query) ||
          String(task.title ?? '')
            .toLowerCase()
            .includes(query) ||
          String(task.summary ?? '')
            .toLowerCase()
            .includes(query) ||
          tags.some((tag) => String(tag).toLowerCase().includes(query))
        )
      })
    }

    if (priorityFilter !== 'todas') {
      filtered = filtered.filter((task) => task.priority === priorityFilter)
    }

    if (statusFocus.length > 0) {
      filtered = filtered.filter((task) =>
        statusFocus.includes(normalizeTaskForAsesorKanban(task).status)
      )
    }

    return filtered
  }, [tasks, searchQuery, priorityFilter, statusFocus, canAccess])

  const kanbanTasksForBoard = useMemo(
    () => filteredTasks.map(normalizeTaskForAsesorKanban),
    [filteredTasks]
  )

  useEffect(() => {
    if (actionError || actionSuccess) {
      const timer = setTimeout(() => {
        setActionError(null)
        setActionSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [actionError, actionSuccess])

  // Otras pestañas / usuarios: realtime puede no entregar el INSERT; mantener lista al día
  useEffect(() => {
    if (!canAccess || !onReloadData) return
    const silentReload = () => {
      if (document.visibilityState !== 'visible') return
      void onReloadData({ silent: true })
    }
    const unsubBroadcast = subscribeOrdenesBroadcast(silentReload)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') silentReload()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const intervalId = window.setInterval(silentReload, 40000)
    return () => {
      unsubBroadcast()
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(intervalId)
    }
  }, [canAccess, onReloadData])

  const toggleStatusFocus = (status: TaskStatus) => {
    setStatusFocus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  const handleTaskMove = async (taskId: string, destination: TaskStatus) => {
    try {
      const ordenId = parseTaskIdToOrdenId(taskId)
      if (!ordenId) {
        setActionError('No se pudo identificar la orden')
        return
      }

      const destinationColumn = ASESOR_PRESUPUESTOS_COLUMNS.find((column) => column.id === destination)
      if (!destinationColumn) {
        setActionError('Columna de destino inválida')
        return
      }

      const taskToUpdate = tasks.find((t) => t.id === taskId)
      if (!taskToUpdate) {
        setActionError('Tarea no encontrada')
        return
      }

      // Si se mueve a Finalizado y es una ficha, transformarla a orden general
      if (destination === 'finalizado-asesor-presupuestos' && taskToUpdate.esFichaNoOP) {
        const sectorActual =
          taskToUpdate.assignedSector ||
          taskToUpdate.sectorInicial ||
          (taskToUpdate.sectores && taskToUpdate.sectores[0]) ||
          'Asesor Técnico'

        const updatedTask = {
          ...taskToUpdate,
          status: destination,
          assignedSector: sectorActual
        }
        const payload = taskToOrdenPayload(updatedTask)
        payload.estado = 'Finalizado'
        payload.sector = sectorActual

        const updateResponse = await apiService.updateOrden(ordenId, payload)
        if (!updateResponse.success) {
          setActionError(updateResponse.error || 'Error al mover la orden')
          return
        }

        const transformResponse = await apiService.transformarFichaNoOPAOP(ordenId)
        if (!transformResponse.success) {
          setActionError(transformResponse.error || 'Error al transformar la ficha')
          return
        }

        setActionSuccess(
          `Ficha convertida a orden: ${transformResponse.data?.nuevo_numero_op || 'N/A'}. Ahora aparecerá en el Kanban general.`
        )
      } else if (destination === 'asesor-tecnico' || destination === 'presupuestos') {
        // Misma lógica que tablero general: fusiona instancias duplicadas (mismo OP en otro sector) sin violar ux_ordenes_op_sector
        const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
        const nuevoEstado = mapStatusToEstado(destination)
        const response = await apiService.moveOrden(ordenId, nuevoEstado, usuarioId)
        if (!response.success) {
          setActionError(response.error || 'Error al mover la orden')
          return
        }
        if ((response.data as { fusionada?: boolean })?.fusionada) {
          setActionSuccess(
            'Ficha unificada en el sector destino (la otra instancia queda oculta del tablero, sin borrarla).'
          )
        } else {
          setActionSuccess('Orden movida correctamente')
        }
      } else {
        // Finalizado sin ser ficha No OP: estado Finalizado, sector sigue Asesor o Presupuestos
        const sectorActual =
          taskToUpdate.assignedSector ||
          taskToUpdate.sectorInicial ||
          (taskToUpdate.sectores && taskToUpdate.sectores[0]) ||
          'Asesor Técnico'

        const updatedTask = {
          ...taskToUpdate,
          status: destination,
          assignedSector: sectorActual
        }
        const payload = taskToOrdenPayload(updatedTask)
        if (destination === 'finalizado-asesor-presupuestos') {
          payload.estado = 'Finalizado'
          payload.sector = sectorActual
        }

        const response = await apiService.updateOrden(ordenId, payload)
        if (!response.success) {
          setActionError(response.error || 'Error al mover la orden')
          return
        }

        setActionSuccess('Orden movida correctamente')
      }

      if (onReloadData) {
        await onReloadData()
      }
    } catch (error) {
      console.error('Error moviendo tarea:', error)
      setActionError('Error al mover la orden')
    }
  }

  const handleTaskEdit = async (updatedTask: Task) => {
    try {
      const ordenId = parseTaskIdToOrdenId(updatedTask.id)
      if (!ordenId) {
        setActionError('No se pudo identificar la orden')
        return
      }

      const payload = taskToOrdenPayload(updatedTask)

      const response = await apiService.updateOrden(ordenId, payload)
      if (!response.success) {
        setActionError(response.error || 'Error al actualizar la orden')
        return
      }

      setActionSuccess('Orden actualizada correctamente')
      setTaskToEdit(null)
      if (onReloadData) {
        await onReloadData()
      }
    } catch (error) {
      console.error('Error actualizando tarea:', error)
      setActionError('Error al actualizar la orden')
    }
  }

  if (!canAccess) {
    return (
      <div className="asesor-presupuestos-page">
        <div className="asesor-presupuestos-ambient" aria-hidden />
        <div className="asesor-presupuestos-inner">
          <div className="asesor-presupuestos-denied-card">
            <div className="asesor-presupuestos-denied-icon" aria-hidden>
              🔒
            </div>
            <h2>Acceso restringido</h2>
            <p>Tu usuario no tiene permiso para esta vista. Si creés que es un error, consultá con administración.</p>
            <button type="button" className="asesor-p-btn asesor-p-btn-primary" onClick={() => navigate('/')}>
              Ir al tablero
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="asesor-presupuestos-page">
      <div className="asesor-presupuestos-ambient" aria-hidden />
      <Header
        teamMembers={teamMembers}
        activity={activity}
        onNavigateToStats={onNavigateToStats}
        onNavigateToUsuarios={onNavigateToUsuarios}
        onNavigateToChat={onNavigateToChat}
        onLogout={onLogout}
      />

      <div className="asesor-presupuestos-content">
        <div className="asesor-presupuestos-inner">
          <header className="asesor-presupuestos-hero">
            <button type="button" className="asesor-presupuestos-back" onClick={() => navigate('/')}>
              <span aria-hidden>←</span> Tablero general
            </button>
            <div className="asesor-presupuestos-hero-badge">Flujo asesoría</div>
            <h1 className="asesor-presupuestos-title">Asesor técnico y presupuestos</h1>
            <p className="asesor-presupuestos-lead">
              Mediciones, factibilidad y armado de presupuestos en un tablero dedicado.
            </p>
            {activeTab === 'kanban' && (
              <div className="asesor-presupuestos-stats">
                <div className="asesor-presupuestos-stat">
                  <span className="asesor-presupuestos-stat-value">{filteredTasks.length}</span>
                  <span className="asesor-presupuestos-stat-label">Órdenes visibles</span>
                </div>
                <div className="asesor-presupuestos-stat">
                  <span className="asesor-presupuestos-stat-value">{ASESOR_PRESUPUESTOS_COLUMNS.length}</span>
                  <span className="asesor-presupuestos-stat-label">Etapas</span>
                </div>
              </div>
            )}
          </header>

          <div className="asesor-presupuestos-segment" role="tablist" aria-label="Vista">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'kanban'}
              className={`asesor-presupuestos-segment-btn ${activeTab === 'kanban' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('kanban')}
            >
              <span className="asesor-presupuestos-segment-ico" aria-hidden>
                ▦
              </span>
              Kanban
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'agenda'}
              className={`asesor-presupuestos-segment-btn ${activeTab === 'agenda' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('agenda')}
            >
              <span className="asesor-presupuestos-segment-ico" aria-hidden>
                ◷
              </span>
              Agenda
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'historial'}
              className={`asesor-presupuestos-segment-btn ${activeTab === 'historial' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('historial')}
            >
              <span className="asesor-presupuestos-segment-ico" aria-hidden>
                ☰
              </span>
              Historial fichas
            </button>
          </div>

        {actionError && (
          <div className="asesor-presupuestos-toast asesor-presupuestos-toast--error" role="alert">
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="asesor-presupuestos-toast asesor-presupuestos-toast--ok" role="status">
            {actionSuccess}
          </div>
        )}

        {activeTab === 'kanban' ? (
          <>
            <FiltersBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchInputRef={searchInputRef}
              statusFocus={statusFocus}
              onStatusToggle={toggleStatusFocus}
              onStatusReset={() => setStatusFocus([])}
              columns={ASESOR_PRESUPUESTOS_COLUMNS}
              priorityFilter={priorityFilter}
              priorityFilters={[
                { id: 'todas', label: 'Todas' },
                { id: 'alta', label: 'Alta' },
                { id: 'media', label: 'Media' },
                { id: 'baja', label: 'Baja' }
              ]}
              onPriorityChange={setPriorityFilter}
              onAddNewOrder={() => {
                setFichaModalEditTask(null)
                setFichaModalOpen(true)
              }}
            />

            <div className="asesor-presupuestos-board-wrap">
              <Board
                tasks={kanbanTasksForBoard}
                allTasks={kanbanTasksForBoard}
                onMoveTask={handleTaskMove}
                members={teamMembers}
                onEditTask={(task) => {
                  if (task.esFichaNoOP) {
                    setFichaModalEditTask(task)
                    setFichaModalOpen(true)
                  } else {
                    setTaskToEdit(task)
                  }
                }}
                columns={ASESOR_PRESUPUESTOS_COLUMNS}
                sectores={sectores}
                activity={activity}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
              />
            </div>
          </>
        ) : activeTab === 'agenda' ? (
          idAsesorParaAgenda != null ? (
            <AgendaAsesorTecnico idAsesor={idAsesorParaAgenda} />
          ) : (
            <div className="asesor-presupuestos-empty-agenda">
              <div className="asesor-presupuestos-empty-agenda-icon" aria-hidden>
                ◷
              </div>
              <p className="asesor-presupuestos-empty-agenda-title">Sin asesor para la agenda</p>
              <p className="asesor-presupuestos-empty-agenda-text">
                No hay usuarios con rol asesor técnico cargados. La agenda muestra citas de mediciones y visitas.
              </p>
            </div>
          )
        ) : (
          <HistorialFichasAsesorPanel
            tasks={tasks}
            onEditTask={(task) => {
              if (task.esFichaNoOP) {
                setFichaModalEditTask(task)
                setFichaModalOpen(true)
              } else {
                setTaskToEdit(task)
              }
            }}
            onRefrescarTablero={onReloadData}
          />
        )}

        {taskToEdit && (
          <TaskEditModal
            task={taskToEdit}
            teamMembers={teamMembers}
            onClose={() => setTaskToEdit(null)}
            onSave={handleTaskEdit}
            sectores={sectores}
            materiales={materialesCatalog}
            activity={activity}
          />
        )}

        {fichaModalOpen && (
          <FichaNoOPModal
            editTask={fichaModalEditTask}
            onClose={() => {
              setFichaModalOpen(false)
              setFichaModalEditTask(null)
            }}
            onSuccess={() => {
              if (onReloadData) {
                onReloadData()
              }
              setFichaModalOpen(false)
              setFichaModalEditTask(null)
            }}
          />
        )}
        </div>
      </div>
    </div>
  )
}

export default AsesorPresupuestosPage

