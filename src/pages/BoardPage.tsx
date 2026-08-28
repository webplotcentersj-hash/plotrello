import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Board from '../components/Board'
import Header from '../components/Header'
import FiltersBar from '../components/FiltersBar'
import StatsPanel from '../components/StatsPanel'
import ActivityFeed from '../components/ActivityFeed'
const TaskEditModal = lazy(() => import('../components/TaskEditModal'))
const TaskViewModal = lazy(() => import('../components/TaskViewModal'))
const TaskCreateModal = lazy(() => import('../components/TaskCreateModal'))
const SprintOptimizerModal = lazy(() => import('../components/SprintOptimizerModal'))
const PlotAIChat = lazy(() => import('../components/PlotAIChat'))
import PlotAIFloatingButton from '../components/PlotAIFloatingButton'
import WorkPoolOperarioNotasFab from '../features/work-pool/WorkPoolOperarioNotasFab'
import { registrarActividadTableroAutomatica } from '../features/work-pool/workPoolOperarioNotas'
import InsightsToolsMenu from '../components/InsightsToolsMenu'
import EntregasCobroPanel from '../components/EntregasCobroPanel'
import EntregasSinRetiroPanel from '../components/EntregasSinRetiroPanel'
const TaskLibraryModal = lazy(() => import('../components/TaskLibraryModal'))
import QRPrintView from '../components/QRPrintView'
import SolicitarProductosModal from '../components/SolicitarProductosModal'
import SolicitudPermisoModal from '../components/SolicitudPermisoModal'
import { BOARD_COLUMNS } from '../data/mockData'
import type { ActivityEvent, Priority, Task, TaskStatus, TeamMember } from '../types/board'
import type { MaterialRecord, SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import { usePhoneBoardLayout } from '../hooks/usePhoneBoardLayout'
import { buildAgenticContext } from '../utils/agentInsights'
import { getApiService } from '../services/apiLoader'
import {
  ordenToTask,
  parseTaskIdToOrdenId,
  taskToOrdenPayload,
  mapStatusToEstado,
  mapEstadoToStatus
} from '../utils/dataMappers'
import { recordTiposImpresionUsados } from '../utils/opImpresionRecientes'
import { mergeEspejoSiblingTask } from '../utils/opEspejoSectores'
import Subtasks from '../components/Subtasks'
import {
  getSectorEtapaKanbanBySectorName,
  sectorNameSupportsEtapaKanban
} from '../data/sectorEtapaKanban'
import {
  archivosRowsHaveImage,
  taskPhotoUrlCountAsSitePhoto,
  taskStatusDestinoRequiereFotosLugar
} from '../utils/sectoresFotosLugar'

/** Igual que en fichas: quitar email y normalizar para comparar operario asignado vs nombre de sesión */
function normalizePersonNameKey(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const atIndex = trimmed.indexOf('@')
  const base = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed
  return base.toLowerCase().replace(/\s+/g, ' ').trim()
}

type BoardPageProps = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  activity: ActivityEvent[]
  setActivity: React.Dispatch<React.SetStateAction<ActivityEvent[]>>
  teamMembers: TeamMember[]
  onNavigateToStats: () => void
  onNavigateToCalendar?: () => void
  onNavigateToUsuarios?: () => void
  onNavigateToChat?: () => void
  onNavigateToMensajeria?: () => void
  onNavigateToMostrador?: () => void
  onNavigateToCompras?: () => void
  onNavigateToCaja?: () => void
  onNavigateToDiseno?: () => void
  onNavigateToRecursosHumanos?: () => void
  onNavigateToClientesWeb?: () => void
  onNavigateToAsesorPresupuestos?: () => void
  onNavigateToAtencionPublico?: () => void
  onNavigateToFlota?: () => void
  onNavigateToERP?: () => void
  onLogout?: () => void
  onReloadData?: (options?: { silent?: boolean }) => Promise<void>
  isSyncing?: boolean
  syncError?: string | null
  sectores: SectorRecord[]
  materialesCatalog: MaterialRecord[]
}

const BoardPage = ({
  tasks,
  setTasks,
  activity,
  setActivity,
  teamMembers,
  onNavigateToStats,
  onNavigateToCalendar,
  onNavigateToUsuarios,
  onNavigateToChat,
  onNavigateToMensajeria,
  onNavigateToMostrador,
  onNavigateToCompras,
  onNavigateToCaja,
  onNavigateToDiseno,
  onNavigateToRecursosHumanos,
  onNavigateToClientesWeb,
  onNavigateToAsesorPresupuestos,
  onNavigateToAtencionPublico,
  onNavigateToFlota,
  onNavigateToERP,
  onLogout,
  onReloadData,
  isSyncing,
  syncError,
  sectores,
  materialesCatalog
}: BoardPageProps) => {
  const { usuario, nombreVisible, isAdmin, isDiseno } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [statusFocus, setStatusFocus] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas')
  const [misTrabajosFilter, setMisTrabajosFilter] = useState(false)
  const [sectorFilter, setSectorFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [checklistTask, setChecklistTask] = useState<Task | null>(null)
  const [qrPrintTask, setQrPrintTask] = useState<{ opNumber: string; cliente: string } | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false)
  const [isChatAIOpen, setIsChatAIOpen] = useState(false)
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false)
  const [isSolicitarProductosOpen, setIsSolicitarProductosOpen] = useState(false)
  const [isPermisosOpen, setIsPermisosOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskViewId, setTaskViewId] = useState<string | null>(null)
  /** Estadísticas del tablero: ocultas por defecto; se abren con el botón del panel lateral */
  const [statsPanelOpen, setStatsPanelOpen] = useState(false)
  /** Movimientos recientes: ocultos por defecto para dar más ancho al tablero */
  const [activityFeedOpen, setActivityFeedOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isPhoneBoard = usePhoneBoardLayout()
  const plotAIAgentic = useMemo(
    () => buildAgenticContext(tasks, activity, teamMembers),
    [tasks, activity, teamMembers]
  )

  /** Usuario de sesión: la bitácora local debe mostrar quién hizo el cambio, no el operario asignado a la ficha. */
  const sessionActor = useMemo(
    () => ({
      id: usuario?.id != null ? String(usuario.id) : '',
      name: nombreVisible?.trim() || null
    }),
    [usuario?.id, nombreVisible]
  )

  const sidebarCompact =
    isAdmin ? !statsPanelOpen && !activityFeedOpen : !activityFeedOpen
  const tasksRef = useRef<Task[]>(tasks)
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    if (isPhoneBoard) setIsChatAIOpen(false)
  }, [isPhoneBoard])

  useEffect(() => {
    if (actionError || actionSuccess) {
      // Si falla la auditoría de eliminación, NO auto-limpiar (para que el usuario lo vea siempre)
      const isAuditDeleteError =
        typeof actionError === 'string' &&
        (actionError.toLowerCase().includes('auditor') ||
          actionError.toLowerCase().includes('no se eliminó la op') ||
          actionError.toLowerCase().includes('no se elimino la op') ||
          actionError.toLowerCase().includes('no se pudo registrar'))
      if (isAuditDeleteError) {
        return undefined
      }
      const timer = setTimeout(() => {
        setActionError(null)
        setActionSuccess(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [actionError, actionSuccess])

  // Abrir modal de crear OP con brief cuando se navega desde BriefsPendientesPage
  useEffect(() => {
    const state = location.state as { openCreateModalWithBrief?: string } | null
    if (state?.openCreateModalWithBrief) {
      localStorage.setItem('brief_token_seleccionado', state.openCreateModalWithBrief)
      setIsCreateModalOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  // Escuchar evento por si se dispara cuando ya estamos en el board
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ briefToken?: string }>
      const token = ev.detail?.briefToken
      if (token) {
        localStorage.setItem('brief_token_seleccionado', token)
        setIsCreateModalOpen(true)
      }
    }
    window.addEventListener('open-create-modal-with-brief', handler)
    return () => window.removeEventListener('open-create-modal-with-brief', handler)
  }, [])

  const sanitizeWorkerName = (value?: string | null) => {
    if (!value) return undefined
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const atIndex = trimmed.indexOf('@')
    return atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed
  }

  const isTaskAssignedToMe = useCallback(
    (task: Task) => {
      const me = normalizePersonNameKey(nombreVisible || usuario?.nombre)
      const myIdStr = usuario?.id != null ? String(usuario.id) : ''

      // operario_asignado suele guardarse como id de usuario (select en crear/editar ficha)
      if (
        myIdStr &&
        task.ownerId &&
        task.ownerId !== 'sin-asignar' &&
        task.ownerId.trim() === myIdStr
      ) {
        return true
      }
      // Compatibilidad: operario guardado como nombre (datos viejos o carga manual)
      if (
        me &&
        task.ownerId &&
        task.ownerId !== 'sin-asignar' &&
        normalizePersonNameKey(task.ownerId) === me
      ) {
        return true
      }
      if (me && task.workingUser && normalizePersonNameKey(task.workingUser) === me) {
        return true
      }
      return false
    },
    [usuario?.id, usuario?.nombre]
  )

  const isWorkingOnMyTask = useCallback(
    (task: Task) => {
      const me = normalizePersonNameKey(nombreVisible || usuario?.nombre)
      return Boolean(me && task.workingUser && normalizePersonNameKey(task.workingUser) === me)
    },
    [nombreVisible, usuario?.nombre]
  )

  const registrarOpTablero = useCallback(
    (task: Task, detalle: string) => {
      if (!usuario?.id || !task.opNumber?.trim()) return
      void registrarActividadTableroAutomatica({
        id_usuario: usuario.id,
        numero_op: task.opNumber.trim(),
        id_orden: parseTaskIdToOrdenId(task.id),
        detalle
      })
    },
    [usuario?.id]
  )

  const resolveCurrentUserName = () => {
    if (nombreVisible) return nombreVisible
    const preferred = sanitizeWorkerName(usuario?.nombre) ?? usuario?.nombre
    if (preferred) return preferred
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('usuario')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (parsed?.nombre) {
            return sanitizeWorkerName(parsed.nombre) ?? parsed.nombre
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return 'Operador'
  }

  const persistWorkingUser = useCallback(async (taskId: string, workingUser: string | null) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, workingUser: workingUser ?? undefined } : task
      )
    )

    const ordenId = parseTaskIdToOrdenId(taskId)
    if (!ordenId) return

    try {
      const response = await (await getApiService()).setOrdenWorkingUser(ordenId, workingUser)
      if (!response.success) {
        console.error('Error actualizando trabajador activo:', response.error)
      }
    } catch (error) {
      console.error('Error actualizando trabajador activo:', error)
    }
  }, [setTasks])

  // Obtener sectores únicos de las tareas
  const availableSectors = useMemo(() => {
    const sectorsSet = new Set<string>()
    tasks.forEach((task) => {
      if (task.assignedSector) {
        sectorsSet.add(task.assignedSector)
      }
      if (task.sectores && task.sectores.length > 0) {
        task.sectores.forEach((sector) => sectorsSet.add(sector))
      }
    })
    return Array.from(sectorsSet).sort()
  }, [tasks])

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matchesSearchText = (task: Task) => {
      if (!q) return true
      const hay = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(q)
      if (hay(task.id)) return true
      if (hay(task.opNumber)) return true
      if (hay(task.title)) return true
      if (hay(task.summary)) return true
      if (task.tags?.some((t) => t.toLowerCase().includes(q))) return true
      if (task.materials?.some((m) => m.toLowerCase().includes(q))) return true
      if (hay(task.clientPhone)) return true
      if (hay(task.clientEmail)) return true
      if (hay(task.dniCuit)) return true
      if (hay(task.workingUser)) return true
      if (hay(task.assignedSector)) return true
      return false
    }

    return tasks.filter((task) => {
      if (task.ordenEliminada) return false
      if (task.visibleEnTablero === false) return false
      // Entregadas sí se muestran (quedan en Almacén / buscador); solo se ocultan eliminadas u ocultas.

      const matchesStatus = statusFocus.length === 0 || statusFocus.includes(task.status)
      const matchesPriority = priorityFilter === 'todas' || task.priority === priorityFilter
      const matchesSector =
        sectorFilter === 'todos' ||
        task.assignedSector === sectorFilter ||
        (task.sectores && task.sectores.includes(sectorFilter))
      const matchesMisTrabajos = !misTrabajosFilter || isTaskAssignedToMe(task)
      return (
        matchesStatus && matchesPriority && matchesSector && matchesSearchText(task) && matchesMisTrabajos
      )
    })
  }, [
    tasks,
    statusFocus,
    priorityFilter,
    misTrabajosFilter,
    sectorFilter,
    searchQuery,
    isTaskAssignedToMe
  ])

  /** Si buscan un nº de OP que no está en memoria (tope del tablero), traerlo de la BD. */
  useEffect(() => {
    const q = searchQuery.trim()
    const digits = q.replace(/\D/g, '')
    if (!/^\d{4,}$/.test(digits)) return
    const already = tasks.some(
      (t) => String(t.opNumber ?? '').replace(/\D/g, '') === digits
    )
    if (already) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const api = await getApiService()
          const resp = await api.searchOrdenesBiblioteca(digits, { limit: 40 })
          if (cancelled || !resp.success || !resp.data?.length) return
          setTasks((prev) => {
            const byId = new Map(prev.map((t) => [t.id, t]))
            let changed = false
            for (const orden of resp.data!) {
              if (orden.id == null) continue
              if (orden.visible_en_tablero === false) continue
              if (orden.eliminada === true) continue
              if (orden.entregado === true) continue
              if (orden.estado === 'Entregado o Instalado') continue
              const id = String(orden.id)
              if (byId.has(id)) continue
              byId.set(id, ordenToTask(orden))
              changed = true
            }
            return changed ? [...byId.values()] : prev
          })
        } catch (e) {
          console.warn('Board: no se pudo cargar OP buscada desde BD', e)
        }
      })()
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, tasks, setTasks])

  const phoneFilterChips = useMemo(() => {
    const chips: { key: string; text: string }[] = []
    if (sectorFilter !== 'todos') chips.push({ key: 'sector', text: `Sector: ${sectorFilter}` })
    const q = searchQuery.trim()
    if (q) {
      const short = q.length > 36 ? `${q.slice(0, 34)}…` : q
      chips.push({ key: 'search', text: `Búsqueda: «${short}»` })
    }
    if (priorityFilter !== 'todas') chips.push({ key: 'prio', text: `Prioridad: ${priorityFilter}` })
    if (misTrabajosFilter) chips.push({ key: 'mis', text: 'Mis trabajos' })
    if (statusFocus.length > 0) {
      const labels = statusFocus
        .map((id) => BOARD_COLUMNS.find((c) => c.id === id)?.label ?? id)
        .join(', ')
      chips.push({ key: 'cols', text: `Columnas: ${labels}` })
    }
    return chips
  }, [sectorFilter, searchQuery, priorityFilter, misTrabajosFilter, statusFocus])

  const statusFocusKey = useMemo(() => [...statusFocus].sort().join('|'), [statusFocus])
  const filteredTasksRef = useRef(filteredTasks)
  filteredTasksRef.current = filteredTasks

  useLayoutEffect(() => {
    if (!isPhoneBoard) return
    const panel = document.getElementById('board-main-panel')
    const wrap = panel?.querySelector('.board-wrapper') as HTMLElement | null
    const grid = wrap?.querySelector('.columns-grid') as HTMLElement | null
    if (!wrap || !grid) return

    const noFilters =
      sectorFilter === 'todos' &&
      !searchQuery.trim() &&
      priorityFilter === 'todas' &&
      !misTrabajosFilter &&
      statusFocus.length === 0

    if (noFilters) {
      wrap.scrollLeft = 0
      return
    }

    const colDivs = grid.querySelectorAll('.board-column')
    if (!colDivs.length) return

    const ft = filteredTasksRef.current
    let targetIdx = -1

    if (sectorFilter !== 'todos') {
      const byLabel = BOARD_COLUMNS.findIndex(
        (c) => c.label.trim().toLowerCase() === sectorFilter.trim().toLowerCase()
      )
      if (byLabel >= 0) {
        const colId = BOARD_COLUMNS[byLabel].id
        const hasInThatCol = ft.some((t) => t.status === colId)
        targetIdx = hasInThatCol
          ? byLabel
          : BOARD_COLUMNS.findIndex((c) => ft.some((t) => t.status === c.id))
        if (targetIdx < 0) targetIdx = byLabel
      }
    }

    if (targetIdx < 0) {
      targetIdx = BOARD_COLUMNS.findIndex((c) => ft.some((t) => t.status === c.id))
    }

    if (targetIdx < 0 || targetIdx >= colDivs.length) {
      wrap.scrollLeft = 0
      return
    }

    ;(colDivs[targetIdx] as HTMLElement).scrollIntoView({
      inline: 'start',
      block: 'nearest',
      behavior: 'auto'
    })
  }, [
    isPhoneBoard,
    sectorFilter,
    searchQuery,
    priorityFilter,
    misTrabajosFilter,
    statusFocusKey
  ])

  const taskToView = useMemo(
    () => (taskViewId ? tasks.find((t) => t.id === taskViewId) ?? null : null),
    [tasks, taskViewId]
  )

  useEffect(() => {
    if (taskViewId && !tasks.some((t) => t.id === taskViewId)) setTaskViewId(null)
  }, [tasks, taskViewId])

  const handleViewTask = useCallback((task: Task) => {
    setSelectedTaskId(task.id)
    setTaskViewId(task.id)
  }, [])

  const toggleStatusFocus = (status: TaskStatus) => {
    setStatusFocus((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    )
  }

  const handleMoveTask = useCallback(async (
    taskId: string,
    destination: TaskStatus,
    _sourceColumn?: TaskStatus
  ) => {
    const destinationColumn = BOARD_COLUMNS.find((column) => column.id === destination)
    const taskBeforeMove = tasksRef.current.find((t) => t.id === taskId)
    if (!taskBeforeMove) return
    if (taskBeforeMove.status === destination) return
    if (taskBeforeMove.opBloqueada && !isAdmin) {
      setActionError(
        'Esta OP está trabada: no se puede mover hasta que el operario asignado la destabe (administración/gerencia puede hacerlo).'
      )
      return
    }

    const ordenId = parseTaskIdToOrdenId(taskId)

    if (taskStatusDestinoRequiereFotosLugar(destination)) {
      if (!ordenId) {
        setActionError('No se pudo validar la orden para mover a Instalaciones o Metalúrgica (foto real del lugar).')
        return
      }
      try {
        const archResp = await (await getApiService()).getArchivosOrden(ordenId)
        const rows =
          archResp.success && archResp.data
            ? (archResp.data as Array<{ titulo?: string; url?: string }>)
            : []
        const tieneFoto =
          taskPhotoUrlCountAsSitePhoto(taskBeforeMove.photoUrl) || archivosRowsHaveImage(rows)
        if (!tieneFoto) {
          setActionError(
            'Instalaciones / Metalúrgica: hace falta una FOTO REAL DEL LUGAR (sitio físico), no solo PDF u otro archivo. Abrí la ficha con ✏️ y subí una imagen en adjuntos o en la portada.'
          )
          return
        }
      } catch {
        setActionError('No se pudieron verificar los adjuntos. Intentá de nuevo.')
        return
      }
    }

    const movedAt = Date.now()

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task
        return {
          ...task,
          status: destination,
          assignedSector: destinationColumn?.label ?? task.assignedSector,
          updatedAt: new Date().toISOString(),
          uiMovedAt: movedAt,
          progress: destination === 'almacen-entrega' ? 100 : task.progress
        }
      })
    )

    const taskSnapshot = taskBeforeMove

    startTransition(() => {
      setActivity((prev) => [
        {
          id: `move-${Date.now()}`,
          taskId,
          from: taskSnapshot.status,
          to: destination,
          actorId: sessionActor.id || taskSnapshot.ownerId,
          actorName: sessionActor.name,
          timestamp: new Date().toISOString(),
          note: `Movimiento rápido hacia ${destination}`
        },
        ...prev
      ])
    })

    if (ordenId) {
      const nuevoEstado = mapStatusToEstado(destination)

      window.dispatchEvent(
        new CustomEvent('user-moved-task', {
          detail: { taskId: ordenId.toString(), estado: nuevoEstado, timestamp: Date.now() }
        })
      )

      const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
      try {
        const response = await (await getApiService()).moveOrden(ordenId, nuevoEstado, usuarioId)
        if (!response.success) {
          setActionError(response.error || 'No se pudo actualizar la orden en Supabase.')
          setTasks((prev) =>
            prev.map((task) => {
              if (task.id !== taskId) return task
              return taskSnapshot
            })
          )
        } else if ((response.data as any)?.fusionada && (response.data as any)?.fusionadaId) {
          const fusionadaId = String((response.data as any).fusionadaId)
          const conservadaId = String((response.data as any).id ?? '')
          // Defer hasta después del frame de soltar DnD (@hello-pangea) para evitar rebote visual al quitar un draggable.
          const applyFusionState = () => {
            // PlotAI / feed: el historial local seguía apuntando al id fusionado (ya no está en tasks)
            setActivity((prev) =>
              prev.map((ev) => (ev.taskId === fusionadaId ? { ...ev, taskId: conservadaId } : ev))
            )
            setTasks((prev) => {
              const movedTask = prev.find((task) => task.id === taskId)
              const hadConservada = prev.some((task) => task.id === conservadaId)
              const next = prev
                .map((task) => {
                  if (task.id !== conservadaId) return task
                  return {
                    ...task,
                    status: destination,
                    assignedSector: destinationColumn?.label ?? task.assignedSector,
                    updatedAt: new Date().toISOString(),
                    uiMovedAt: movedAt,
                    progress: destination === 'almacen-entrega' ? 100 : task.progress
                  }
                })
                .filter((task) => task.id !== fusionadaId)

              if (!hadConservada && movedTask && conservadaId) {
                next.push({
                  ...movedTask,
                  id: conservadaId,
                  status: destination,
                  assignedSector: destinationColumn?.label ?? movedTask.assignedSector,
                  updatedAt: new Date().toISOString(),
                  uiMovedAt: movedAt,
                  progress: destination === 'almacen-entrega' ? 100 : movedTask.progress
                })
              }

              return next
            })
            startTransition(() => {
              setActionSuccess('Fichas unificadas en el sector destino (la otra queda oculta del tablero, no eliminada).')
            })
            registrarOpTablero(
              taskSnapshot,
              `Movió a ${destinationColumn?.label ?? destination}`
            )
          }
          requestAnimationFrame(() => {
            requestAnimationFrame(applyFusionState)
          })
        } else {
          registrarOpTablero(
            taskSnapshot,
            `Movió a ${destinationColumn?.label ?? destination}`
          )
          startTransition(() => {
            setActionSuccess('Orden actualizada en Supabase.')
          })
        }
      } catch (err) {
        console.error('moveOrden inesperado:', err)
        setActionError(
          err instanceof Error
            ? `Error al mover la ficha: ${err.message}`
            : 'Error inesperado al mover la ficha. Reintentá o recargá la página.'
        )
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id !== taskId) return task
            return taskSnapshot
          })
        )
      }
    } else {
      setActionError(
        'No se pudo sincronizar el movimiento: ID de orden inválido. Recargá el tablero o abrí la ficha desde el listado.'
      )
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task
          return taskSnapshot
        })
      )
    }
  }, [setTasks, setActivity, setActionError, setActionSuccess, isAdmin, sessionActor, registrarOpTablero])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true')

      const key = event.key.toLowerCase()
      const isCmd = event.metaKey || event.ctrlKey

      // Cmd/Ctrl + K o "/" para enfocar búsqueda
      if (isCmd && key === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }
      if (!isCmd && key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (isTyping) return

      // Flechas para mover tarjeta seleccionada entre columnas
      if (selectedTaskId && (key === 'arrowleft' || key === 'arrowright')) {
        const task = filteredTasks.find((t) => t.id === selectedTaskId)
        if (task) {
          const idx = BOARD_COLUMNS.findIndex((c) => c.id === task.status)
          if (idx >= 0) {
            const nextIdx = key === 'arrowleft' ? idx - 1 : idx + 1
            if (nextIdx >= 0 && nextIdx < BOARD_COLUMNS.length) {
              event.preventDefault()
              handleMoveTask(selectedTaskId, BOARD_COLUMNS[nextIdx].id)
            }
          }
        }
        return
      }

      // Escape para deseleccionar
      if (selectedTaskId && key === 'escape') {
        event.preventDefault()
        setSelectedTaskId(null)
        return
      }

      // "c" para nueva orden
      if (key === 'c') {
        event.preventDefault()
        setIsCreateModalOpen(true)
        return
      }

      // "l" para abrir biblioteca
      if (key === 'l') {
        event.preventDefault()
        setIsLibraryModalOpen(true)
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedTaskId, filteredTasks, handleMoveTask])

  // Listener para actualizar solo la etapa de una tarea sin recargar todo
  useEffect(() => {
    const handleUpdateTaskEtapa = (event: Event) => {
      const customEvent = event as CustomEvent<{
        ordenId: number
        etapa: string
        fechaInicio?: string | null
        tipo: 'taller_grafico' | 'instalaciones' | 'taller_imprenta' | 'impresion_digital' | 'metalurgica'
      }>
      const { ordenId, etapa, fechaInicio, tipo } = customEvent.detail

      // Actualizar solo la tarea específica preservando su status actual
      setTasks((prev) =>
        prev.map((task) => {
          const taskOrdenId = parseTaskIdToOrdenId(task.id)
          if (taskOrdenId === ordenId) {
            // Preservar el status actual y solo actualizar la etapa correspondiente
            const updates: Partial<Task> = {}
            
            if (tipo === 'taller_grafico') {
              updates.etapaTallerGrafico = etapa
              updates.etapaTallerGraficoFechaInicio = fechaInicio || undefined
            } else if (tipo === 'instalaciones') {
              updates.etapaInstalaciones = etapa
              updates.etapaInstalacionesFechaInicio = fechaInicio || undefined
            } else if (tipo === 'taller_imprenta') {
              updates.etapaTallerImprenta = etapa
              updates.etapaTallerImprentaFechaInicio = fechaInicio || undefined
            } else if (tipo === 'impresion_digital') {
              updates.etapaImpresionDigital = etapa
              updates.etapaImpresionDigitalFechaInicio = fechaInicio || undefined
            } else if (tipo === 'metalurgica') {
              updates.etapaMetalurgica = etapa
              updates.etapaMetalurgicaFechaInicio = fechaInicio || undefined
            }
            
            // Notificar al realtime que esta tarea fue editada para preservar su status
            window.dispatchEvent(new CustomEvent('user-edited-task', {
              detail: { taskId: ordenId.toString(), status: task.status, timestamp: Date.now() }
            }))
            
            return {
              ...task,
              ...updates
            }
          }
          return task
        })
      )
    }

    window.addEventListener('update-task-etapa', handleUpdateTaskEtapa)
    return () => window.removeEventListener('update-task-etapa', handleUpdateTaskEtapa)
  }, [])

  useEffect(() => {
    const handleUpdateTaskPanol = (event: Event) => {
      const customEvent = event as CustomEvent<{ ordenId: number; panolSlot: string | null }>
      const { ordenId, panolSlot } = customEvent.detail
      setTasks((prev) =>
        prev.map((task) => {
          const taskOrdenId = parseTaskIdToOrdenId(task.id)
          if (taskOrdenId !== ordenId) return task
          window.dispatchEvent(
            new CustomEvent('user-edited-task', {
              detail: { taskId: ordenId.toString(), status: task.status, timestamp: Date.now() }
            })
          )
          return { ...task, panolSlot }
        })
      )
    }
    window.addEventListener('update-task-panol', handleUpdateTaskPanol)
    return () => window.removeEventListener('update-task-panol', handleUpdateTaskPanol)
  }, [])

  const handleEditTask = useCallback((task: Task) => {
    const editingUserName = resolveCurrentUserName()
    void persistWorkingUser(task.id, editingUserName)
    registrarOpTablero(task, 'Abrió la ficha para trabajar')
    setTaskToEdit({ ...task, workingUser: editingUserName })
  }, [usuario, persistWorkingUser, registrarOpTablero])

  const handleCloseEditModal = (taskId?: string) => {
    if (taskId) {
      void persistWorkingUser(taskId, null)
    }
    setTaskToEdit(null)
  }

  const handleEspejoSectoresOpSynced = useCallback((numeroOp: string, enabled: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.opNumber === numeroOp ? { ...t, espejoSectoresOp: enabled } : t))
    )
    setTaskToEdit((prev) =>
      prev && prev.opNumber === numeroOp ? { ...prev, espejoSectoresOp: enabled } : prev
    )
  }, [setTasks])

  const handleSaveTask = async (updatedTask: Task) => {
    const ordenId = parseTaskIdToOrdenId(updatedTask.id)
    
    // Obtener la tarea original para comparar el sector
    const taskOriginal = tasks.find(t => t.id === updatedTask.id)
    const sectorCambio = taskOriginal && taskOriginal.assignedSector !== updatedTask.assignedSector
    
    if (ordenId) {
      // Si cambió el sector, actualizar el status (columna) basado en el nuevo sector
      let taskConStatusActualizado = { ...updatedTask }
      
      if (sectorCambio && updatedTask.assignedSector) {
        // Mapear el sector a su columna correspondiente
        const nuevoStatus = mapEstadoToStatus(updatedTask.assignedSector)
        taskConStatusActualizado = {
          ...updatedTask,
          status: nuevoStatus // Actualizar el status para que aparezca en la columna correcta
        }
        console.log(`🔄 Sector cambiado de "${taskOriginal?.assignedSector}" a "${updatedTask.assignedSector}" -> Nueva columna: ${nuevoStatus}`)
      }
      
      // Preparar el payload para Supabase
      const payload = taskToOrdenPayload(taskConStatusActualizado)
      
      // Si cambió el sector, asegurar que el estado en la BD también se actualice
      if (sectorCambio && updatedTask.assignedSector) {
        // El estado debe coincidir con el sector para que aparezca en la columna correcta
        payload.estado = updatedTask.assignedSector
        console.log(`📝 Actualizando estado en BD a: ${payload.estado}`)
      } else {
        // Si NO cambió el sector, preservar el estado actual en la BD
        // Esto es crítico para que la ficha no se mueva cuando solo se cambia el operario
        if (taskOriginal) {
          const estadoOriginal = mapStatusToEstado(taskOriginal.status)
          payload.estado = estadoOriginal
          console.log(`🔒 Preservando estado en BD: ${estadoOriginal} (sector no cambió, solo operario)`)
        }
      }
      
      const response = await (await getApiService()).updateOrden(ordenId, payload)
      if (response.success && response.data) {
        const lineasRes = await (await getApiService()).replaceOrdenLineasM2(
          ordenId,
          updatedTask.lineasMetrosM2 ?? []
        )
        if (!lineasRes.success) {
          console.warn('No se pudieron guardar las líneas m²:', lineasRes.error)
        }
        recordTiposImpresionUsados(updatedTask.tipoImpresion, updatedTask.lineasMetrosM2)

        // IMPORTANTE: Actualizar el estado local con los datos que vienen de Supabase
        const ordenActualizada = response.data
        const taskActualizado = ordenToTask(ordenActualizada)
        
        // CRÍTICO: Preservar siempre el status de la tarea que se está editando
        // El status representa la columna donde está la ficha, y debe mantenerse
        // a menos que haya un cambio explícito de sector
        // Usamos el status de updatedTask porque es el que viene del modal de edición
        // y representa la columna actual donde el usuario está editando
        const statusFinal = sectorCambio 
          ? taskConStatusActualizado.status // Si cambió sector, usar el nuevo status
          : updatedTask.status // Si NO cambió sector, preservar el status actual (columna donde está)
        
        console.log(`📊 Status final: ${statusFinal} (sectorCambio: ${sectorCambio}, original: ${taskOriginal?.status}, updated: ${updatedTask.status})`)
        
        // Notificar al realtime que esta tarea fue editada para preservar su status
        window.dispatchEvent(new CustomEvent('user-edited-task', {
          detail: { taskId: ordenId.toString(), status: statusFinal, timestamp: Date.now() }
        }))
        
        const taskFinal: Task = {
          ...taskActualizado,
          status: statusFinal, // SIEMPRE usar el status preservado (columna actual)
          id: updatedTask.id, // Mantener el ID original
          lineasMetrosM2: updatedTask.lineasMetrosM2,
          tipoImpresion: updatedTask.tipoImpresion,
          espejoSectoresOp: updatedTask.espejoSectoresOp === true
        }

        const sectLenEspejo =
          (updatedTask.sectores?.length ?? 0) > 0
            ? (updatedTask.sectores?.length ?? 0)
            : (taskFinal.sectores?.length ?? 0)
        const espejoOn = updatedTask.espejoSectoresOp === true && sectLenEspejo >= 2
        let propagatedSiblingOrdenIds: number[] = []
        if (espejoOn) {
          const esp = await (await getApiService()).propagateEspejoGrupoOrden(ordenId, updatedTask.opNumber, payload)
          if (!esp.success && esp.error) {
            console.warn('Modo espejo:', esp.error)
          }
          propagatedSiblingOrdenIds = esp.propagatedIds
          for (const sid of propagatedSiblingOrdenIds) {
            const lrEspejo = await (await getApiService()).replaceOrdenLineasM2(sid, updatedTask.lineasMetrosM2 ?? [])
            if (!lrEspejo.success) {
              console.warn('No se pudieron guardar las líneas m² (espejo):', sid, lrEspejo.error)
            }
          }
        }

        setTasks((prev) =>
          prev.map((task) => {
            if (task.id === updatedTask.id) return taskFinal
            if (!espejoOn || propagatedSiblingOrdenIds.length === 0) return task
            const oid = parseTaskIdToOrdenId(task.id)
            if (oid != null && propagatedSiblingOrdenIds.includes(oid)) {
              return mergeEspejoSiblingTask(task, taskFinal)
            }
            return task
          })
        )
        setActivity((prev) => [
          {
            id: `edit-${Date.now()}`,
            taskId: updatedTask.id,
            from: taskOriginal?.status || updatedTask.status,
            to: statusFinal,
            actorId: sessionActor.id || updatedTask.ownerId,
            actorName: sessionActor.name,
            timestamp: new Date().toISOString(),
            note: sectorCambio ? `Sector cambiado a ${updatedTask.assignedSector}` : 'Tarea actualizada'
          },
          ...prev
        ])
        
        const sectoresAnt = JSON.stringify(taskOriginal?.sectores ?? [])
        const sectoresNue = JSON.stringify(updatedTask.sectores ?? [])
        if (sectoresAnt !== sectoresNue) {
          const syncRes = await (await getApiService()).syncOpGrupoSectoresYFichas(ordenId)
          if (!syncRes.success) {
            console.warn('Sincronización sectores OP:', syncRes.error)
          }
          if (onReloadData) await onReloadData()
        }

        setActionSuccess(sectorCambio 
          ? `Cambios guardados. Ficha movida a ${updatedTask.assignedSector}` 
          : 'Cambios guardados correctamente.')
      } else {
        setActionError(response.error || 'No se pudo guardar la orden en Supabase.')
        // Si falla, mantener el estado local actualizado de todas formas
        setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? taskConStatusActualizado : task)))
      }
    } else {
      // Si no hay ordenId, solo actualizar el estado local
      setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
    }
  }

  const handleRestartOrdenEnTablero = useCallback(
    async (task: Task) => {
      const ordenId = parseTaskIdToOrdenId(task.id)
      if (!ordenId) {
        setActionError('No se pudo identificar la orden.')
        return
      }
      if (task.ordenEliminada) {
        const ok = window.confirm(
          'Esta OP está marcada como eliminada. ¿Restaurarla en el tablero? Se quitará el estado eliminado y volverá a ser visible.'
        )
        if (!ok) return
      } else if (task.entregado) {
        const ok = window.confirm(
          'Esta OP figura como entregada/archivada. ¿Volver a abrirla en el tablero general? Se desmarcará como entregada.'
        )
        if (!ok) return
      }

      const response = await (await getApiService()).restartOrdenParaTablero(ordenId)
      if (!response.success || !response.data) {
        const msg = response.error || 'No se pudo restaurar la OP.'
        setActionError(msg)
        window.alert(msg)
        return
      }

      const refreshed = ordenToTask(response.data)
      const statusFinal = task.status
      window.dispatchEvent(
        new CustomEvent('user-edited-task', {
          detail: { taskId: ordenId.toString(), status: statusFinal, timestamp: Date.now() }
        })
      )

      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id)
        if (idx === -1) return [...prev, refreshed]
        return prev.map((t) => (t.id === task.id ? refreshed : t))
      })

      setActionSuccess(
        task.ordenEliminada
          ? 'OP restaurada: volverá a figurar en el tablero general.'
          : task.entregado
            ? 'OP desarchivada: vuelve al tablero general.'
            : 'La ficha volvió a estar visible en el tablero.'
      )

      if (onReloadData) {
        await onReloadData({ silent: true })
      }
    },
    [onReloadData, setTasks, setActionError, setActionSuccess]
  )

  const handleDeleteTask = useCallback(async (taskId: string) => {
    const task = tasksRef.current.find((t) => t.id === taskId)

    const motivo = window.prompt(
      '¿Por qué eliminás esta OP?\n(Este motivo va a quedar registrado en la auditoría.)',
      ''
    )

    if (motivo === null) {
      // Cancelado
      return
    }

    if (!motivo.trim()) {
      window.alert('Necesitás escribir un motivo para eliminar la OP.')
      return
    }

    void persistWorkingUser(taskId, null)

    const ordenId = parseTaskIdToOrdenId(taskId)
    if (ordenId) {
      const response = await (await getApiService()).deleteOrden(ordenId, {
        motivo: motivo.trim(),
        usuarioId: usuario?.id ?? null,
        usuarioNombre: nombreVisible || null,
        estadoAnterior: task?.status ?? null
      })

      if (!response.success) {
        const msg = response.error || 'No se pudo eliminar la orden en Supabase.'
        setActionError(msg)
        // Alert inmediato (evita que el usuario "no vea nada")
        window.alert(msg)
        return
      }
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setTaskToEdit(null)

    if (onReloadData) {
      await onReloadData({ silent: true })
    }
  }, [usuario, onReloadData, persistWorkingUser, setTasks, setTaskToEdit, setActionError])

  const handleMarkDelivered = useCallback(async (taskId: string, delivered: boolean) => {
    const ordenId = parseTaskIdToOrdenId(taskId)
    if (!ordenId) {
      console.error('❌ No se pudo obtener ordenId de taskId:', taskId)
      setActionError('Error: No se pudo identificar la orden')
      throw new Error('No se pudo obtener ordenId')
    }

    console.log(`📦 Marcando orden ${ordenId} como entregado: ${delivered}`)

    try {
      const response = await (await getApiService()).marcarEntregado(ordenId, delivered)
      
      if (response.success) {
        console.log(`✅ Orden ${ordenId} marcada como entregado: ${delivered}`)
        
        // Entregada: sale del kanban (biblioteca). Desarchivar: vuelve a Almacén.
        setTasks((prev) => {
          if (delivered) {
            return prev.filter((task) => task.id !== taskId)
          }
          return prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  entregado: false,
                  visibleEnTablero: true,
                  status: 'almacen-entrega'
                }
              : task
          )
        })
        setActionSuccess(
          delivered
            ? 'Entrega procesada: la OP pasó a la biblioteca y salió del tablero'
            : 'Ficha desarchivada y restaurada al tablero'
        )
      } else {
        console.error('❌ Error marcando como entregado:', response.error)
        setActionError(response.error || 'No se pudo marcar como entregado')
        throw new Error(response.error || 'No se pudo marcar como entregado')
      }
    } catch (error) {
      console.error('❌ Excepción al marcar como entregado:', error)
      setActionError(error instanceof Error ? error.message : 'Error desconocido al marcar como entregado')
      throw error
    }
  }, [setTasks, setActionError, setActionSuccess])

  const handleCreateTask = async (
    newTaskData: Omit<Task, 'id'> & { attachments?: Array<{ name: string; remoteUrl: string; uploading?: boolean }> },
    options?: { openChecklist?: boolean }
  ): Promise<void> => {
    const variosSectores = (newTaskData.sectores?.length ?? 0) > 1
    const settleOp = variosSectores ? String(newTaskData.opNumber ?? '').trim() : ''
    if (settleOp) {
      window.dispatchEvent(
        new CustomEvent('plotrello-op-multi-sector-settle', { detail: { numeroOp: settleOp } })
      )
    }
    try {
      console.log('📝 Creando nueva ficha:', {
        opNumber: newTaskData.opNumber,
        sectores: newTaskData.sectores,
        sectorInicial: newTaskData.sectorInicial,
        assignedSector: newTaskData.assignedSector
      })
      const payload = taskToOrdenPayload(newTaskData)
      console.log('📤 Payload a enviar:', payload)
      const response = await (await getApiService()).createOrden(payload)
      console.log('📥 Respuesta de createOrden:', response)
      if (response.success && response.data) {
        let createdTask = ordenToTask(response.data)
        const ordenId = parseTaskIdToOrdenId(createdTask.id)
        const taskSnapshotForInstantUi = createdTask

        // Kanban: mostrar la ficha al instante (no esperar líneas m², adjuntos, brief, etc.)
        if (!variosSectores) {
          startTransition(() => {
            setTasks((prev) => {
              if (prev.some((t) => t.id === taskSnapshotForInstantUi.id)) {
                return prev.map((t) => (t.id === taskSnapshotForInstantUi.id ? taskSnapshotForInstantUi : t))
              }
              return [taskSnapshotForInstantUi, ...prev]
            })
          })
          setActivity((prev) =>
            [
              {
                id: `create-${taskSnapshotForInstantUi.id}-${Date.now()}`,
                taskId: taskSnapshotForInstantUi.id,
                from: taskSnapshotForInstantUi.status,
                to: taskSnapshotForInstantUi.status,
                actorId: sessionActor.id || taskSnapshotForInstantUi.ownerId,
                actorName: sessionActor.name,
                timestamp: new Date().toISOString(),
                note: `Nueva orden creada: ${taskSnapshotForInstantUi.opNumber}`
              },
              ...prev
            ].slice(0, 300)
          )
        }

        if (ordenId) {
          const lineasRes = await (await getApiService()).replaceOrdenLineasM2(
            ordenId,
            newTaskData.lineasMetrosM2 ?? []
          )
          if (!lineasRes.success) {
            console.warn('Líneas m² al crear OP:', lineasRes.error)
          }
          recordTiposImpresionUsados(newTaskData.tipoImpresion, newTaskData.lineasMetrosM2)
        }

        createdTask = {
          ...createdTask,
          tipoImpresion: newTaskData.tipoImpresion,
          lineasMetrosM2: newTaskData.lineasMetrosM2
        }
        
        // Si la OP viene con metros, guardarlos en la ficha (corrección/consistencia para TG)
        if (ordenId && newTaskData.metrosCuadrados !== undefined && newTaskData.metrosCuadrados !== null) {
          const metros = Number(newTaskData.metrosCuadrados)
          if (!Number.isNaN(metros) && metros > 0) {
            await (await getApiService()).actualizarMetrosOrden(ordenId, metros, {
              motivo: 'Carga inicial de metros cuadrados (m²) al crear la OP.'
            })
          }
        }

        // Asociar brief si hay token seleccionado
        if ((newTaskData as any).briefToken && ordenId) {
          try {
            await (await getApiService()).asociarBriefAOrden((newTaskData as any).briefToken, ordenId)
            console.log('✅ Brief asociado a la OP:', ordenId)
          } catch (error) {
            console.error('Error asociando brief a la OP:', error)
          }
        }
        
        // Guardar archivos adjuntos si hay alguno en el taskData
        if (newTaskData.attachments && Array.isArray(newTaskData.attachments) && ordenId) {
          for (const attachment of newTaskData.attachments) {
            if (attachment.remoteUrl && !attachment.uploading) {
              await (await getApiService()).guardarArchivoOrden(ordenId, attachment.name, attachment.remoteUrl)
            }
          }
        }

        if (!variosSectores) {
          startTransition(() => {
            setTasks((prev) => {
              const i = prev.findIndex((t) => t.id === createdTask.id)
              if (i < 0) return [createdTask, ...prev]
              const next = [...prev]
              next[i] = createdTask
              return next
            })
          })
        }
        setActionSuccess('Orden creada en Supabase.')
        
        // Mostrar modal de QR para impresión
        if (createdTask.opNumber && createdTask.title) {
          setQrPrintTask({
            opNumber: createdTask.opNumber,
            cliente: createdTask.title
          })
        }
        
        if (options?.openChecklist) {
          setChecklistTask(createdTask)
        }
        if (onReloadData) {
          if (variosSectores) {
            await new Promise((r) => setTimeout(r, 750))
          }
          await onReloadData({ silent: true })
        }
      } else {
        setActionError(response.error || 'No se pudo crear la orden en Supabase.')
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error inesperado al crear la orden.')
    } finally {
      if (settleOp) {
        window.dispatchEvent(new CustomEvent('plotrello-op-multi-sector-settle-end'))
      }
    }
  }

  const handleAssignTaskOwner = useCallback(
    async (taskId: string, ownerId: string, ownerName: string) => {
      const taskBefore = tasksRef.current.find((t) => t.id === taskId)
      if (!taskBefore) return
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, ownerId, updatedAt: new Date().toISOString() } : t
        )
      )
      const ordenId = parseTaskIdToOrdenId(taskId)
      if (!ordenId) return
      try {
        const response = await (await getApiService()).updateOrden(ordenId, {
          operario_asignado: ownerId
        })
        if (!response.success) {
          setActionError(response.error || 'No se pudo asignar el responsable.')
          setTasks((prev) => prev.map((t) => (t.id === taskId ? taskBefore : t)))
          return
        }
        setActivity((prev) => [
          {
            id: `assign-${Date.now()}`,
            taskId,
            from: taskBefore.status,
            to: taskBefore.status,
            actorId: sessionActor.id || ownerId,
            actorName: sessionActor.name,
            timestamp: new Date().toISOString(),
            note: `PlotAI: asignado a ${ownerName}`
          },
          ...prev
        ])
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Error al asignar responsable')
        setTasks((prev) => prev.map((t) => (t.id === taskId ? taskBefore : t)))
      }
    },
    [sessionActor.id, sessionActor.name]
  )

  const handleApplyOptimizations = (suggestions: Array<{
    type: 'reassign' | 'move' | 'priority'
    taskId: string
    taskTitle: string
    currentValue: string
    suggestedValue: string
    reason: string
    impact: 'high' | 'medium' | 'low'
  }>) => {
    setTasks((prev) =>
      prev.map((task) => {
        const suggestion = suggestions.find((s) => s.taskId === task.id)
        if (!suggestion) return task

        let updatedTask = { ...task }

        if (suggestion.type === 'reassign') {
          const newOwner = teamMembers.find((m) => m.name === suggestion.suggestedValue)
          if (newOwner) {
            updatedTask.ownerId = newOwner.id
          }
        } else if (suggestion.type === 'move') {
          const newStatus = BOARD_COLUMNS.find((col) => col.label === suggestion.suggestedValue)
          if (newStatus) {
            updatedTask.status = newStatus.id
            updatedTask.assignedSector = newStatus.label
          }
        } else if (suggestion.type === 'priority') {
          updatedTask.priority = suggestion.suggestedValue as any
        }

        updatedTask.updatedAt = new Date().toISOString()

        setActivity((prev) => [
          {
            id: `optimize-${Date.now()}-${task.id}`,
            taskId: task.id,
            from: task.status,
            to: updatedTask.status,
            actorId: sessionActor.id || updatedTask.ownerId,
            actorName: sessionActor.name,
            timestamp: new Date().toISOString(),
            note: `Optimización aplicada: ${suggestion.reason}`
          },
          ...prev
        ])

        return updatedTask
      })
    )
    setIsOptimizerModalOpen(false)
  }

  const boardTools = (
    <>
      {isAdmin && (
        <button
          type="button"
          className="insights-toggle-btn"
          onClick={() => setStatsPanelOpen((v) => !v)}
          aria-expanded={statsPanelOpen}
          aria-controls="board-stats-panel"
          id="board-stats-toggle"
          title={statsPanelOpen ? 'Ocultar estadísticas' : 'Mostrar estadísticas'}
          aria-label={
            statsPanelOpen ? 'Ocultar estadísticas del tablero' : 'Mostrar estadísticas del tablero'
          }
        >
          <span className="insights-toggle-icon" aria-hidden="true">
            {statsPanelOpen ? '📉' : '📊'}
          </span>
        </button>
      )}
      <button
        type="button"
        className="insights-toggle-btn"
        onClick={() => setActivityFeedOpen((v) => !v)}
        aria-expanded={activityFeedOpen}
        aria-controls="board-activity-panel"
        id="board-activity-toggle"
        title={activityFeedOpen ? 'Ocultar movimientos' : 'Mostrar movimientos recientes'}
        aria-label={
          activityFeedOpen ? 'Ocultar movimientos recientes' : 'Mostrar movimientos recientes'
        }
      >
        <span className="insights-toggle-icon" aria-hidden="true">
          {activityFeedOpen ? '📋' : '🕐'}
        </span>
      </button>
      {!isPhoneBoard && (
        <InsightsToolsMenu
          onNavigateToChat={onNavigateToChat || (() => {})}
          onTogglePlotAI={() => setIsChatAIOpen((v) => !v)}
          isPlotAIOpen={isChatAIOpen}
          showImpresoras
        />
      )}
      <PlotAIFloatingButton
        isOpen={isChatAIOpen}
        alertCount={plotAIAgentic.alertCount}
        onClick={() => setIsChatAIOpen((v) => !v)}
      />
    </>
  )

  return (
    <div className={`trello-plot-app${isPhoneBoard ? ' trello-plot-app--phone' : ''}`}>
      {(isSyncing || syncError || actionError || actionSuccess) && (
        <div className="sync-banner-container" style={{ marginBottom: '12px' }}>
          {isSyncing && (
            <div
              className="sync-banner"
              style={{ background: '#1f2937', color: '#fff', padding: '8px 12px', borderRadius: '8px' }}
            >
              Sincronizando con Supabase...
            </div>
          )}
          {(syncError || actionError) && (
            <div
              className="sync-banner"
              style={{
                background: '#7f1d1d',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                marginTop: '8px'
              }}
            >
              {actionError || syncError}
            </div>
          )}
          {actionSuccess && !actionError && (
            <div
              className="sync-banner"
              style={{
                background: '#065f46',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                marginTop: '8px'
              }}
            >
              {actionSuccess}
            </div>
          )}
        </div>
      )}
      <Header
        compactPhone={isPhoneBoard}
        teamMembers={teamMembers}
        activity={activity}
        currentUserName={resolveCurrentUserName()}
        onNavigateToStats={onNavigateToStats}
        onNavigateToCalendar={onNavigateToCalendar}
        onNavigateToUsuarios={onNavigateToUsuarios}
        onNavigateToChat={onNavigateToChat}
        onNavigateToMensajeria={onNavigateToMensajeria}
        onNavigateToMostrador={onNavigateToMostrador}
        onNavigateToCompras={onNavigateToCompras}
        onNavigateToCaja={onNavigateToCaja}
        onNavigateToDiseno={onNavigateToDiseno}
            onNavigateToRecursosHumanos={onNavigateToRecursosHumanos}
            onNavigateToClientesWeb={onNavigateToClientesWeb}
            onNavigateToAsesorPresupuestos={onNavigateToAsesorPresupuestos}
            onNavigateToAtencionPublico={onNavigateToAtencionPublico}
            onNavigateToFlota={onNavigateToFlota}
            onNavigateToERP={onNavigateToERP}
        onSolicitarProductos={() => setIsSolicitarProductosOpen(true)}
        onOpenPermisos={() => setIsPermisosOpen(true)}
        onLogout={onLogout}
        isAdmin={isAdmin}
        isDiseno={isDiseno}
        boardTools={boardTools}
      />
      <FiltersBar
        compactPhone={isPhoneBoard}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        statusFocus={statusFocus}
        onStatusToggle={toggleStatusFocus}
        onStatusReset={() => setStatusFocus([])}
        columns={BOARD_COLUMNS}
        priorityFilter={priorityFilter}
        priorityFilters={[
          { id: 'todas', label: 'Todas' },
          { id: 'alta', label: 'Alta' },
          { id: 'media', label: 'Media' },
          { id: 'baja', label: 'Baja' }
        ]}
        onPriorityChange={setPriorityFilter}
        misTrabajosFilter={misTrabajosFilter}
        onMisTrabajosChange={setMisTrabajosFilter}
        sectorFilter={sectorFilter}
        availableSectors={availableSectors}
        onSectorChange={setSectorFilter}
        onAddNewOrder={() => setIsCreateModalOpen(true)}
        onOpenLibrary={() => setIsLibraryModalOpen(true)}
        onOptimizeSprint={() => setIsOptimizerModalOpen(true)}
        showEtapaKanbanButton={
          sectorFilter !== 'todos' && sectorNameSupportsEtapaKanban(sectorFilter)
        }
        onOpenEtapaKanban={() => {
          const cfg = getSectorEtapaKanbanBySectorName(sectorFilter)
          if (cfg) navigate(`/kanban-etapas/${cfg.slug}`)
        }}
      />

      <main
        className={`app-layout${sidebarCompact ? ' app-layout--sidebar-compact' : ''}`}
      >
        <section className="board-panel" id="board-main-panel">
          {isPhoneBoard && (
            <div className="board-phone-filter-strip" aria-live="polite">
              <div className="board-phone-filter-strip-count">
                <strong>{filteredTasks.length}</strong>
                <span> fichas visibles</span>
              </div>
              {phoneFilterChips.length > 0 ? (
                <ul className="board-phone-filter-chips">
                  {phoneFilterChips.map((c) => (
                    <li key={c.key} className="board-phone-filter-chip">
                      {c.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="board-phone-filter-strip-hint">Mostrando el tablero completo (sin filtros).</p>
              )}
            </div>
          )}
          <Board
            columns={BOARD_COLUMNS}
            tasks={filteredTasks}
            onMoveTask={handleMoveTask}
            members={teamMembers}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            sectores={sectores}
            onMarkDelivered={handleMarkDelivered}
            activity={activityFeedOpen ? activity : undefined}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onViewTask={handleViewTask}
            disableDrag={isPhoneBoard}
            sidePanel={
              !isPhoneBoard ? (
                <>
                  <EntregasCobroPanel tasks={filteredTasks} />
                  <EntregasSinRetiroPanel tasks={filteredTasks} onSelectTask={setSelectedTaskId} />
                </>
              ) : undefined
            }
          />
        </section>

        {/* El aside solo existe si hay algún panel abierto; los botones viven en el header. */}
        {!sidebarCompact && (
          <aside className="insights-panel">
            {isAdmin && statsPanelOpen && (
              <div id="board-stats-panel" role="region" aria-labelledby="board-stats-toggle">
                <StatsPanel tasks={tasks} activity={activity} teamMembers={teamMembers} />
              </div>
            )}
            {activityFeedOpen && (
              <div id="board-activity-panel" role="region" aria-labelledby="board-activity-toggle">
                <ActivityFeed activity={activity} teamMembers={teamMembers} />
              </div>
            )}
          </aside>
        )}
      </main>

      {taskToView && (
        <Suspense fallback={null}>
          <TaskViewModal
            task={taskToView}
            teamMembers={teamMembers}
            sectores={sectores}
            onClose={() => setTaskViewId(null)}
          />
        </Suspense>
      )}

      {taskToEdit && (
        <Suspense fallback={null}>
          <TaskEditModal
            task={taskToEdit}
            teamMembers={teamMembers}
            sectores={sectores}
            materiales={materialesCatalog}
            activity={activity}
            onClose={handleCloseEditModal}
            onSave={handleSaveTask}
            onDelete={handleDeleteTask}
            onEspejoSectoresOpSynced={handleEspejoSectoresOpSynced}
          />
        </Suspense>
      )}

      {isCreateModalOpen && (
        <Suspense fallback={null}>
          <TaskCreateModal
            teamMembers={teamMembers}
            sectores={sectores}
            materiales={materialesCatalog}
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={handleCreateTask}
          />
        </Suspense>
      )}

      {isOptimizerModalOpen && (
        <Suspense fallback={null}>
          <SprintOptimizerModal
            tasks={tasks}
            teamMembers={teamMembers}
            onClose={() => setIsOptimizerModalOpen(false)}
            onApplyOptimization={handleApplyOptimizations}
          />
        </Suspense>
      )}

      {isChatAIOpen && (
        <Suspense fallback={null}>
          <PlotAIChat
            tasks={tasks}
            teamMembers={teamMembers}
            activity={activity}
            onCreateTask={handleCreateTask}
            onMoveTask={handleMoveTask}
            onAssignTaskOwner={handleAssignTaskOwner}
            onClose={() => setIsChatAIOpen(false)}
          />
        </Suspense>
      )}

      {checklistTask && (
        <div className="modal-overlay" onClick={() => setChecklistTask(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>
                Checklist para OP {checklistTask.opNumber} – {checklistTask.title}
              </h2>
              <button type="button" className="modal-close" onClick={() => setChecklistTask(null)}>
                ×
              </button>
            </header>
            <div className="modal-body">
              {parseTaskIdToOrdenId(checklistTask.id) ? (
                <Subtasks ordenId={parseTaskIdToOrdenId(checklistTask.id) as number} />
              ) : (
                <div style={{ color: 'var(--text-secondary)' }}>
                  No se pudo obtener el id de la ficha para mostrar el checklist.
                </div>
              )}
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setChecklistTask(null)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}

      {qrPrintTask && (
        <QRPrintView
          opNumber={qrPrintTask.opNumber}
          cliente={qrPrintTask.cliente}
          onClose={() => setQrPrintTask(null)}
        />
      )}

      {isSolicitarProductosOpen && (
        <SolicitarProductosModal
          onClose={() => setIsSolicitarProductosOpen(false)}
          onSuccess={() => {
            setIsSolicitarProductosOpen(false)
            setActionSuccess('Pedido de compra creado exitosamente')
          }}
        />
      )}

      {isPermisosOpen && (
        <SolicitudPermisoModal
          onClose={() => setIsPermisosOpen(false)}
          onSolicitudCreada={() => setIsPermisosOpen(false)}
        />
      )}

      {isLibraryModalOpen && (
        <Suspense fallback={null}>
          <TaskLibraryModal
            tasks={tasks}
            teamMembers={teamMembers}
            sectores={sectores}
            columns={BOARD_COLUMNS}
            onClose={() => setIsLibraryModalOpen(false)}
            onPersistLibraryEdit={handleSaveTask}
            onRestartOrdenEnTablero={handleRestartOrdenEnTablero}
          />
        </Suspense>
      )}

      {usuario?.id ? (
        <WorkPoolOperarioNotasFab
          idUsuario={usuario.id}
          context="tablero"
          tableroTasks={tasks}
          tableroActivity={activity}
          tableroIsMyTask={isTaskAssignedToMe}
          tableroIsWorkingOn={isWorkingOnMyTask}
          variant="admin"
        />
      ) : null}
    </div>
  )
}

export default BoardPage

