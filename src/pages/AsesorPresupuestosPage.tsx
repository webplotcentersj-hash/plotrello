import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import Board from '../components/Board'
import Header from '../components/Header'
import FiltersBar from '../components/FiltersBar'
import TaskEditModal from '../components/TaskEditModal'
import FichaNoOPModal from '../components/FichaNoOPModal'
import VisitaACoordinarModal from '../components/VisitaACoordinarModal'
import AgendaAsesorTecnico from '../components/AgendaAsesorTecnico'
import HistorialFichasAsesorPanel from '../components/HistorialFichasAsesorPanel'
import { ASESOR_PRESUPUESTOS_COLUMNS } from '../data/asesorPresupuestosColumns'
import type { ActivityEvent, Priority, Task, TaskStatus, TeamMember } from '../types/board'
import type { MaterialRecord, OrdenTrabajo, SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import { usePhoneBoardLayout } from '../hooks/usePhoneBoardLayout'
import apiService from '../services/api'
import {
  isTaskHiddenFromKanban,
  mapStatusToEstado,
  parseTaskIdToOrdenId,
  taskToOrdenPayload
} from '../utils/dataMappers'
import { notifyOrdenChangedLocally } from '../utils/ordenLocalSync'
import { subscribeOrdenesBroadcast } from '../utils/ordenesBroadcast'
import './AsesorPresupuestosPage.css'

/**
 * Tablero Asesor / Presupuestos: las tarjetas son fichas (No OP, ej. FICHA-…).
 * Solo al pasar por este flujo y cerrar en Finalizado se convierten en OP y van al Kanban general.
 */
/** Columnas del Kanban asesor: el Board agrupa solo por `task.status`. */
const ASESOR_KANBAN_STATUSES: TaskStatus[] = [
  'visitas-a-coordinar',
  'asesor-tecnico',
  'presupuestos',
  'armados-enviados-asesor-presupuestos',
  'no-aprobados-asesor-presupuestos',
  'finalizado-asesor-presupuestos'
]

function sectorToAsesorKanbanStatus(sector?: string | null): TaskStatus | null {
  switch (sector) {
    case 'Visitas a coordinar':
      return 'visitas-a-coordinar'
    case 'Asesor Técnico':
      return 'asesor-tecnico'
    case 'Presupuestos':
      return 'presupuestos'
    case 'Armados/Enviados':
      return 'armados-enviados-asesor-presupuestos'
    case 'No Aprobados':
      return 'no-aprobados-asesor-presupuestos'
    default:
      return null
  }
}

/**
 * Si la ficha entra al filtro por sector/sectores pero el estado mapeado sigue siendo de otro
 * tablero (p. ej. En espera), sin esto la tarjeta no cae en ninguna columna.
 * El sector actual gana sobre `status` obsoleto tras drag, fusión o realtime tardío.
 */
function normalizeTaskForAsesorKanban(task: Task): Task {
  const sector = task.assignedSector || task.sectorInicial
  const fromSector = sectorToAsesorKanbanStatus(sector)
  const terminalStatuses = new Set<TaskStatus>([
    'finalizado-asesor-presupuestos',
    'no-aprobados-asesor-presupuestos'
  ])

  if (fromSector && task.status !== fromSector && !terminalStatuses.has(task.status)) {
    return { ...task, status: fromSector }
  }

  if (ASESOR_KANBAN_STATUSES.includes(task.status)) {
    return task
  }
  if (sector === 'Visitas a coordinar') {
    return { ...task, status: 'visitas-a-coordinar' }
  }
  if (sector === 'Asesor Técnico') {
    return { ...task, status: 'asesor-tecnico' }
  }
  if (sector === 'Presupuestos') {
    return { ...task, status: 'presupuestos' }
  }
  if (sector === 'Armados/Enviados') {
    return { ...task, status: 'armados-enviados-asesor-presupuestos' }
  }
  if (sector === 'No Aprobados') {
    return { ...task, status: 'no-aprobados-asesor-presupuestos' }
  }
  const inVisitas = task.sectores?.includes('Visitas a coordinar')
  const inAt = task.sectores?.includes('Asesor Técnico')
  const inPr = task.sectores?.includes('Presupuestos')
  if (inVisitas && !inAt && !inPr) {
    return { ...task, status: 'visitas-a-coordinar' }
  }
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
  if (task.sectores?.includes('Armados/Enviados')) {
    return { ...task, status: 'armados-enviados-asesor-presupuestos' }
  }
  return { ...task, status: 'asesor-tecnico' }
}

type AsesorPresupuestosPageProps = {
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
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
  setTasks,
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
  const [visitaModalOpen, setVisitaModalOpen] = useState(false)
  const [visitaModalEditTask, setVisitaModalEditTask] = useState<Task | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'kanban' | 'agenda' | 'historial'>('kanban')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isPhoneBoard = usePhoneBoardLayout()

  const openFichaNoOP = (task: Task | null) => {
    setVisitaModalOpen(false)
    setVisitaModalEditTask(null)
    setFichaModalEditTask(task)
    setFichaModalOpen(true)
  }

  const openVisitaModal = (task: Task | null) => {
    setFichaModalOpen(false)
    setFichaModalEditTask(null)
    setVisitaModalEditTask(task)
    setVisitaModalOpen(true)
  }

  const openAsesorFicha = (task: Task) => {
    if (!task.esFichaNoOP) {
      setTaskToEdit(task)
      return
    }
    const status = normalizeTaskForAsesorKanban(task).status
    if (status === 'visitas-a-coordinar') {
      openVisitaModal(task)
    } else {
      openFichaNoOP(task)
    }
  }

  const canAccess = isAdmin || isAsesorTecnico || isPresupuestos

  // Para la agenda: asesor técnico ve la suya; admin y presupuestos ven la del primer asesor técnico
  const idAsesorParaAgenda = useMemo(() => {
    if (!usuario) return null
    if (isAsesorTecnico) return usuario.id
    const asesor = teamMembers.find((m) => m.role === 'asesor-tecnico')
    return asesor ? parseInt(asesor.id, 10) : null
  }, [usuario, isAsesorTecnico, teamMembers])

  // Filtrar fichas del flujo Asesor Técnico y Presupuestos (no es el tablero general de OPs)
  const filteredTasks = useMemo(() => {
    if (!canAccess) return []
    
    let filtered = tasks.filter((task) => {
      if (isTaskHiddenFromKanban(task)) return false
      const sector = task.assignedSector || task.sectorInicial
      return (
        sector === 'Visitas a coordinar' ||
        sector === 'Asesor Técnico' ||
        sector === 'Presupuestos' ||
        sector === 'Armados/Enviados' ||
        sector === 'No Aprobados' ||
        task.status === 'visitas-a-coordinar' ||
        task.status === 'asesor-tecnico' ||
        task.status === 'presupuestos' ||
        task.status === 'armados-enviados-asesor-presupuestos' ||
        task.status === 'no-aprobados-asesor-presupuestos' ||
        task.status === 'finalizado-asesor-presupuestos' ||
        (task.sectores && (
          task.sectores.includes('Visitas a coordinar') ||
          task.sectores.includes('Asesor Técnico') ||
          task.sectores.includes('Presupuestos') ||
          task.sectores.includes('Armados/Enviados') ||
          task.sectores.includes('No Aprobados')
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
    () =>
      filteredTasks
        .filter((task) => !isTaskHiddenFromKanban(task))
        .map(normalizeTaskForAsesorKanban),
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

  /**
   * Flujo acordado (ficha No OP):
   * Asesor crea la ficha → la pasa a Presupuestos → desde Presupuestos a Finalizado se convierte en OP y entra al tablero general.
   */
  const handleTaskMove = async (
    taskId: string,
    destination: TaskStatus,
    sourceColumn?: TaskStatus
  ) => {
    const taskSnapshot = tasks.find((t) => t.id === taskId)
    if (!taskSnapshot) {
      setActionError('Ficha no encontrada')
      return
    }

    try {
      const ordenId = parseTaskIdToOrdenId(taskId)
      if (!ordenId) {
        setActionError('No se pudo identificar la ficha')
        return
      }

      const destinationColumn = ASESOR_PRESUPUESTOS_COLUMNS.find((column) => column.id === destination)
      if (!destinationColumn) {
        setActionError('Columna de destino inválida')
        return
      }

      if (taskSnapshot.opBloqueada && !isAdmin) {
        setActionError(
          'Esta ficha/OP está trabada: no se puede mover ni editar hasta que el operario asignado la destabe (administración/gerencia puede hacerlo).'
        )
        return
      }

      const destinationSector = destinationColumn.label
      const nuevoEstado = mapStatusToEstado(destination)
      const movedAt = Date.now()

      const revertOptimistic = () => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? taskSnapshot : task)))
      }

      const applyFusionState = (fusionadaId: string, conservadaId: string) => {
        const apply = () => {
          setTasks((prev) => {
            const movedTask = prev.find((task) => task.id === taskId) ?? taskSnapshot
            const hadConservada = prev.some((task) => task.id === conservadaId)
            const next = prev
              .map((task) => {
                if (task.id !== conservadaId) return task
                return {
                  ...task,
                  status: destination,
                  assignedSector: destinationSector,
                  updatedAt: new Date().toISOString(),
                  uiMovedAt: movedAt
                }
              })
              .filter((task) => task.id !== fusionadaId)

            if (!hadConservada && movedTask && conservadaId) {
              next.push({
                ...movedTask,
                id: conservadaId,
                status: destination,
                assignedSector: destinationSector,
                updatedAt: new Date().toISOString(),
                uiMovedAt: movedAt
              })
            }
            return next.filter((task) => !isTaskHiddenFromKanban(task))
          })
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(apply)
        })
      }

      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task
          return {
            ...task,
            status: destination,
            assignedSector: destinationSector,
            updatedAt: new Date().toISOString(),
            uiMovedAt: movedAt
          }
        })
      )

      window.dispatchEvent(
        new CustomEvent('user-moved-task', {
          detail: { taskId, estado: nuevoEstado, timestamp: Date.now() }
        })
      )

      // Ficha No OP → OP: solo desde Presupuestos o Armados/Enviados
      if (destination === 'finalizado-asesor-presupuestos' && taskSnapshot.esFichaNoOP) {
        const effectiveSource =
          sourceColumn ?? normalizeTaskForAsesorKanban(taskSnapshot).status
        if (
          effectiveSource !== 'presupuestos' &&
          effectiveSource !== 'armados-enviados-asesor-presupuestos'
        ) {
          revertOptimistic()
          setActionError(
            'Flujo: Visitas → Asesor → Presupuestos → Finalizado. Desde Presupuestos o Armados/Enviados, al finalizar, la ficha pasa a OP en el tablero general.'
          )
          return
        }
        const sectorActual =
          taskSnapshot.assignedSector ||
          taskSnapshot.sectorInicial ||
          (taskSnapshot.sectores && taskSnapshot.sectores[0]) ||
          'Asesor Técnico'

        const updatedTask = {
          ...taskSnapshot,
          status: destination,
          assignedSector: sectorActual
        }
        const payload = taskToOrdenPayload(updatedTask)
        payload.estado = 'Finalizado'
        payload.sector = sectorActual

        const updateResponse = await apiService.updateOrden(ordenId, payload)
        if (!updateResponse.success) {
          revertOptimistic()
          setActionError(updateResponse.error || 'Error al finalizar la ficha')
          return
        }

        const transformResponse = await apiService.transformarFichaNoOPAOP(ordenId)
        if (!transformResponse.success) {
          revertOptimistic()
          setActionError(transformResponse.error || 'Error al transformar la ficha')
          return
        }

        setTasks((prev) => prev.filter((task) => task.id !== taskId))
        notifyOrdenChangedLocally({
          id: ordenId,
          estado: 'Finalizado',
          sector: sectorActual,
          visible_en_tablero: false
        } as OrdenTrabajo)

        setActionSuccess(
          `Ficha convertida en OP: ${transformResponse.data?.nuevo_numero_op || 'N/A'}. Ya está en el tablero general.`
        )
      } else if (
        destination === 'visitas-a-coordinar' ||
        destination === 'asesor-tecnico' ||
        destination === 'presupuestos' ||
        destination === 'armados-enviados-asesor-presupuestos' ||
        destination === 'no-aprobados-asesor-presupuestos'
      ) {
        const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
        const response = await apiService.moveOrden(ordenId, nuevoEstado, usuarioId)
        if (!response.success) {
          revertOptimistic()
          setActionError(response.error || 'Error al mover la ficha')
          return
        }

        const fusionData = response.data as {
          fusionada?: boolean
          fusionadaId?: number
          id?: number
        }

        if (fusionData?.fusionada && fusionData.fusionadaId != null) {
          const fusionadaId = String(fusionData.fusionadaId)
          const conservadaId = String(fusionData.id ?? ordenId)
          applyFusionState(fusionadaId, conservadaId)
          notifyOrdenChangedLocally({
            id: fusionData.fusionadaId,
            visible_en_tablero: false
          } as OrdenTrabajo)
          setActionSuccess(
            'Ficha unificada en el sector destino (la otra instancia queda oculta del tablero, sin borrarla).'
          )
        } else {
          notifyOrdenChangedLocally({
            id: ordenId,
            estado: nuevoEstado,
            sector: destinationSector
          } as OrdenTrabajo)
          setActionSuccess('Ficha movida correctamente')
        }
      } else {
        const sectorActual =
          taskSnapshot.assignedSector ||
          taskSnapshot.sectorInicial ||
          (taskSnapshot.sectores && taskSnapshot.sectores[0]) ||
          'Asesor Técnico'

        const updatedTask = {
          ...taskSnapshot,
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
          revertOptimistic()
          setActionError(response.error || 'Error al mover la ficha')
          return
        }

        notifyOrdenChangedLocally({
          id: ordenId,
          estado: payload.estado,
          sector: payload.sector ?? sectorActual
        } as OrdenTrabajo)
        setActionSuccess('Ficha movida correctamente')
      }

      void onReloadData?.({ silent: true })
    } catch (error) {
      console.error('Error moviendo ficha:', error)
      setTasks((prev) => prev.map((task) => (task.id === taskId ? taskSnapshot : task)))
      setActionError('Error al mover la ficha')
    }
  }

  const handleTaskEdit = async (updatedTask: Task) => {
    try {
      const ordenId = parseTaskIdToOrdenId(updatedTask.id)
      if (!ordenId) {
        setActionError('No se pudo identificar la ficha')
        return
      }

      const taskOriginal = tasks.find((t) => t.id === updatedTask.id)
      const payload = taskToOrdenPayload(updatedTask)

      const response = await apiService.updateOrden(ordenId, payload)
      if (!response.success) {
        setActionError(response.error || 'Error al actualizar la ficha')
        return
      }

      const sectoresAnt = JSON.stringify(taskOriginal?.sectores ?? [])
      const sectoresNue = JSON.stringify(updatedTask.sectores ?? [])
      if (sectoresAnt !== sectoresNue) {
        const syncRes = await apiService.syncOpGrupoSectoresYFichas(ordenId)
        if (!syncRes.success) {
          console.warn('Sincronización sectores OP:', syncRes.error)
        }
      }

      setActionSuccess('Ficha actualizada correctamente')
      setTaskToEdit(null)
      if (onReloadData) {
        await onReloadData()
      }
    } catch (error) {
      console.error('Error actualizando ficha:', error)
      setActionError('Error al actualizar la ficha')
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
        compactPhone={isPhoneBoard}
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
              Empezá por Visitas a coordinar; seguí en Asesor Técnico / Presupuestos. Al cerrar en
              Finalizado la ficha pasa a OP en el tablero general.
            </p>
            {activeTab === 'kanban' && (
              <div className="asesor-presupuestos-stats">
                <div className="asesor-presupuestos-stat">
                  <span className="asesor-presupuestos-stat-value">{filteredTasks.length}</span>
                  <span className="asesor-presupuestos-stat-label">Fichas visibles</span>
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
              compactPhone={isPhoneBoard}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchInputRef={searchInputRef}
              searchPlaceholder="Buscar: FICHA-, cliente, descripción, etiquetas…"
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
              onAddNewOrder={() => openVisitaModal(null)}
            />

            <div className="asesor-presupuestos-board-wrap">
              <Board
                tasks={kanbanTasksForBoard}
                excludeHiddenFromKanban
                disableDrag={isPhoneBoard}
                onMoveTask={handleTaskMove}
                members={teamMembers}
                onEditTask={openAsesorFicha}
                columns={ASESOR_PRESUPUESTOS_COLUMNS}
                sectores={sectores}
                activity={activity}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                hideReclamoUI
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
            onEditTask={openAsesorFicha}
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
            showImpresionOpFields={false}
          />
        )}

        {visitaModalOpen && (
          <VisitaACoordinarModal
            editTask={visitaModalEditTask}
            onClose={() => {
              setVisitaModalOpen(false)
              setVisitaModalEditTask(null)
            }}
            onSuccess={() => {
              void onReloadData?.({ silent: true })
              setVisitaModalOpen(false)
              setVisitaModalEditTask(null)
            }}
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
              void onReloadData?.({ silent: true })
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

