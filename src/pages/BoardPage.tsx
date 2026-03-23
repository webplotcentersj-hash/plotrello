import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Board from '../components/Board'
import Header from '../components/Header'
import FiltersBar from '../components/FiltersBar'
import StatsPanel from '../components/StatsPanel'
import ActivityFeed from '../components/ActivityFeed'
import TaskEditModal from '../components/TaskEditModal'
import TaskViewModal from '../components/TaskViewModal'
import TaskCreateModal from '../components/TaskCreateModal'
import SprintOptimizerModal from '../components/SprintOptimizerModal'
import PlotAIChat from '../components/PlotAIChat'
import PlotAIFloatingButton from '../components/PlotAIFloatingButton'
import ChatFloatingButton from '../components/ChatFloatingButton'
import TaskLibraryModal from '../components/TaskLibraryModal'
import QRPrintView from '../components/QRPrintView'
import SolicitarProductosModal from '../components/SolicitarProductosModal'
import { BOARD_COLUMNS } from '../data/mockData'
import type { ActivityEvent, Priority, Task, TaskStatus, TeamMember } from '../types/board'
import type { MaterialRecord, SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  ordenToTask,
  parseTaskIdToOrdenId,
  taskToOrdenPayload,
  mapStatusToEstado,
  mapEstadoToStatus
} from '../utils/dataMappers'
import Subtasks from '../components/Subtasks'
import {
  getSectorEtapaKanbanBySectorName,
  sectorNameSupportsEtapaKanban
} from '../data/sectorEtapaKanban'

type BoardPageProps = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  activity: ActivityEvent[]
  setActivity: React.Dispatch<React.SetStateAction<ActivityEvent[]>>
  teamMembers: TeamMember[]
  onNavigateToStats: () => void
  onNavigateToCalendar?: () => void
  onNavigateToGantt?: () => void
  onNavigateToUsuarios?: () => void
  onNavigateToChat?: () => void
  onNavigateToHerramienta?: () => void
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
  onReloadData?: () => Promise<void>
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
  onNavigateToGantt,
  onNavigateToUsuarios,
  onNavigateToChat,
  onNavigateToHerramienta,
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
  const { usuario, isAdmin, isMostrador, isDiseno } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [statusFocus, setStatusFocus] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas')
  const [sectorFilter, setSectorFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [checklistTask, setChecklistTask] = useState<Task | null>(null)
  const [qrPrintTask, setQrPrintTask] = useState<{ opNumber: string; cliente: string } | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false)
  const [deletedOpsRows, setDeletedOpsRows] = useState<
    Array<{
      id: number
      id_orden: number | null
      numero_op: string | null
      cliente: string | null
      id_usuario: number | null
      nombre_usuario: string | null
      rol_usuario: string | null
      estado_anterior: string | null
      estado_nuevo: string | null
      comentario: string | null
      accion_tipo: string | null
      timestamp: string
    }>
  >([])
  const [isChatAIOpen, setIsChatAIOpen] = useState(false)
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false)
  const [isSolicitarProductosOpen, setIsSolicitarProductosOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskViewId, setTaskViewId] = useState<string | null>(null)
  /** Estadísticas del tablero: ocultas por defecto; se abren con el botón del panel lateral */
  const [statsPanelOpen, setStatsPanelOpen] = useState(false)
  /** Movimientos recientes: ocultos por defecto para dar más ancho al tablero */
  const [activityFeedOpen, setActivityFeedOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const sidebarCompact =
    isAdmin ? !statsPanelOpen && !activityFeedOpen : !activityFeedOpen
  const tasksRef = useRef<Task[]>(tasks)
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

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

  const resolveCurrentUserName = () => {
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
      const response = await apiService.setOrdenWorkingUser(ordenId, workingUser)
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
      // Excluir fichas entregadas/archivadas del board principal
      if (task.entregado) return false

      const matchesStatus = statusFocus.length === 0 || statusFocus.includes(task.status)
      const matchesPriority = priorityFilter === 'todas' || task.priority === priorityFilter
      const matchesSector =
        sectorFilter === 'todos' ||
        task.assignedSector === sectorFilter ||
        (task.sectores && task.sectores.includes(sectorFilter))
      return matchesStatus && matchesPriority && matchesSector && matchesSearchText(task)
    })
  }, [tasks, statusFocus, priorityFilter, sectorFilter, searchQuery])

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

  const handleMoveTask = useCallback(async (taskId: string, destination: TaskStatus) => {
    const destinationColumn = BOARD_COLUMNS.find((column) => column.id === destination)
    const movedAt = Date.now()
    try {
      localStorage.setItem(`taskcard:new-move:${taskId}`, String(movedAt))
    } catch {
      // ignore storage failures
    }

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

    const taskSnapshot = tasksRef.current.find((task) => task.id === taskId)
    if (!taskSnapshot || taskSnapshot.status === destination) return

    startTransition(() => {
      setActivity((prev) => [
        {
          id: `move-${Date.now()}`,
          taskId,
          from: taskSnapshot.status,
          to: destination,
          actorId: taskSnapshot.ownerId,
          timestamp: new Date().toISOString(),
          note: `Movimiento rápido hacia ${destination}`
        },
        ...prev
      ])
    })

    const ordenId = parseTaskIdToOrdenId(taskId)
    if (ordenId) {
      const nuevoEstado = mapStatusToEstado(destination)

      window.dispatchEvent(
        new CustomEvent('user-moved-task', {
          detail: { taskId: ordenId.toString(), estado: nuevoEstado, timestamp: Date.now() }
        })
      )

      const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
      const response = await apiService.moveOrden(ordenId, nuevoEstado, usuarioId)
      if (!response.success) {
        setActionError(response.error || 'No se pudo actualizar la orden en Supabase.')
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id !== taskId) return task
            return taskSnapshot
          })
        )
      } else {
        if ((response.data as any)?.fusionada && (response.data as any)?.fusionadaId) {
          const fusionadaId = String((response.data as any).fusionadaId)
          const conservadaId = String((response.data as any).id ?? '')
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
        } else {
          startTransition(() => {
            setActionSuccess('Orden actualizada en Supabase.')
          })
        }
      }
    }
  }, [setTasks, setActivity, setActionError, setActionSuccess])

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

  const handleEditTask = useCallback((task: Task) => {
    const editingUserName = resolveCurrentUserName()
    void persistWorkingUser(task.id, editingUserName)
    setTaskToEdit({ ...task, workingUser: editingUserName })
  }, [usuario, persistWorkingUser])

  const handleCloseEditModal = (taskId?: string) => {
    if (taskId) {
      void persistWorkingUser(taskId, null)
    }
    setTaskToEdit(null)
  }

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
      
      const response = await apiService.updateOrden(ordenId, payload)
      if (response.success && response.data) {
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
          id: updatedTask.id // Mantener el ID original
        }
        
        setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? taskFinal : task)))
        setActivity((prev) => [
          {
            id: `edit-${Date.now()}`,
            taskId: updatedTask.id,
            from: taskOriginal?.status || updatedTask.status,
            to: statusFinal,
            actorId: updatedTask.ownerId,
            timestamp: new Date().toISOString(),
            note: sectorCambio ? `Sector cambiado a ${updatedTask.assignedSector}` : 'Tarea actualizada'
          },
          ...prev
        ])
        
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
      const response = await apiService.deleteOrden(ordenId, {
        motivo: motivo.trim(),
        usuarioId: usuario?.id ?? null,
        usuarioNombre: usuario?.nombre || null,
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
      await onReloadData()
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
      const response = await apiService.marcarEntregado(ordenId, delivered)
      
      if (response.success) {
        console.log(`✅ Orden ${ordenId} marcada como entregado: ${delivered}`)
        
        // Actualizar el estado local: entregado y estado
        // Cuando se marca como entregado, el estado en BD cambia a "Entregado o Instalado"
        // El filtro filteredTasks excluye automáticamente las fichas con entregado=true
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId 
              ? { 
                  ...task, 
                  entregado: delivered,
                  // Si se desmarca, restaurar el estado a almacen-entrega
                  status: delivered ? task.status : 'almacen-entrega'
                } 
              : task
          )
        )
        setActionSuccess(delivered ? 'Ficha marcada como entregada y archivada' : 'Ficha desarchivada')
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
    try {
      console.log('📝 Creando nueva ficha:', {
        opNumber: newTaskData.opNumber,
        sectores: newTaskData.sectores,
        sectorInicial: newTaskData.sectorInicial,
        assignedSector: newTaskData.assignedSector
      })
      const payload = taskToOrdenPayload(newTaskData)
      console.log('📤 Payload a enviar:', payload)
      const response = await apiService.createOrden(payload)
      console.log('📥 Respuesta de createOrden:', response)
      if (response.success && response.data) {
        const createdTask = ordenToTask(response.data)
        const ordenId = parseTaskIdToOrdenId(createdTask.id)
        
        // Si la OP viene con metros, guardarlos en la ficha (corrección/consistencia para TG)
        if (ordenId && newTaskData.metrosCuadrados !== undefined && newTaskData.metrosCuadrados !== null) {
          const metros = Number(newTaskData.metrosCuadrados)
          if (!Number.isNaN(metros) && metros > 0) {
            await apiService.actualizarMetrosOrden(ordenId, metros, {
              motivo: 'Carga inicial de metros cuadrados (m²) al crear la OP.'
            })
          }
        }

        // Asociar brief si hay token seleccionado
        if ((newTaskData as any).briefToken && ordenId) {
          try {
            await apiService.asociarBriefAOrden((newTaskData as any).briefToken, ordenId)
            console.log('✅ Brief asociado a la OP:', ordenId)
          } catch (error) {
            console.error('Error asociando brief a la OP:', error)
          }
        }
        
        // Guardar archivos adjuntos si hay alguno en el taskData
        if (newTaskData.attachments && Array.isArray(newTaskData.attachments) && ordenId) {
          for (const attachment of newTaskData.attachments) {
            if (attachment.remoteUrl && !attachment.uploading) {
              await apiService.guardarArchivoOrden(ordenId, attachment.name, attachment.remoteUrl)
            }
          }
        }
        
        setTasks((prev) => [createdTask, ...prev])
        setActivity((prev) => [
          {
            id: `create-${Date.now()}`,
            taskId: createdTask.id,
            from: createdTask.status,
            to: createdTask.status,
            actorId: createdTask.ownerId,
            timestamp: new Date().toISOString(),
            note: `Nueva orden creada: ${createdTask.opNumber}`
          },
          ...prev
        ])
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
        if (onReloadData) await onReloadData()
      } else {
        setActionError(response.error || 'No se pudo crear la orden en Supabase.')
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error inesperado al crear la orden.')
    }
  }

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
            actorId: updatedTask.ownerId,
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

  return (
    <div className="trello-plot-app">
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
        teamMembers={teamMembers}
        activity={activity}
        currentUserName={resolveCurrentUserName()}
        onNavigateToStats={onNavigateToStats}
        onNavigateToCalendar={onNavigateToCalendar}
        onNavigateToGantt={onNavigateToGantt}
        onNavigateToUsuarios={onNavigateToUsuarios}
        onNavigateToChat={onNavigateToChat}
        onNavigateToHerramienta={onNavigateToHerramienta}
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
        onLogout={onLogout}
        isAdmin={isAdmin}
        isMostrador={isMostrador}
        isDiseno={isDiseno}
      />
      <FiltersBar
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
        sectorFilter={sectorFilter}
        availableSectors={availableSectors}
        onSectorChange={setSectorFilter}
        onAddNewOrder={() => setIsCreateModalOpen(true)}
        onOpenLibrary={async () => {
          try {
            const resp = await apiService.getOpEliminadas()
            if (resp.success && resp.data) {
              setDeletedOpsRows(resp.data as any)
            } else {
              setDeletedOpsRows([])
            }
          } catch (e) {
            console.error('Error cargando OP eliminadas para la biblioteca:', e)
            setDeletedOpsRows([])
          }
          setIsLibraryModalOpen(true)
        }}
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
        <section className="board-panel">
          <Board
            columns={BOARD_COLUMNS}
            tasks={filteredTasks}
            allTasks={tasks.filter((t) => !t.entregado)}
            onMoveTask={handleMoveTask}
            members={teamMembers}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            sectores={sectores}
            onMarkDelivered={handleMarkDelivered}
            activity={activity}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onViewTask={handleViewTask}
          />
        </section>

        <aside
          className={`insights-panel${sidebarCompact ? ' insights-panel--compact' : ''}`}
        >
          <div className="insights-toggle-row">
            {isAdmin && (
              <button
                type="button"
                className="insights-toggle-btn"
                onClick={() => setStatsPanelOpen((v) => !v)}
                aria-expanded={statsPanelOpen}
                aria-controls="board-stats-panel"
                id="board-stats-toggle"
                title={statsPanelOpen ? 'Ocultar estadísticas' : 'Mostrar estadísticas'}
                aria-label={statsPanelOpen ? 'Ocultar estadísticas del tablero' : 'Mostrar estadísticas del tablero'}
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
          </div>
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
      </main>

      {taskToView && (
        <TaskViewModal
          task={taskToView}
          teamMembers={teamMembers}
          sectores={sectores}
          onClose={() => setTaskViewId(null)}
        />
      )}

      {taskToEdit && (
        <TaskEditModal
          task={taskToEdit}
          teamMembers={teamMembers}
          sectores={sectores}
          materiales={materialesCatalog}
          activity={activity}
          onClose={handleCloseEditModal}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}

      {isCreateModalOpen && (
        <TaskCreateModal
          teamMembers={teamMembers}
          sectores={sectores}
          materiales={materialesCatalog}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateTask}
        />
      )}

      {isOptimizerModalOpen && (
        <SprintOptimizerModal
          tasks={tasks}
          teamMembers={teamMembers}
          onClose={() => setIsOptimizerModalOpen(false)}
          onApplyOptimization={handleApplyOptimizations}
        />
      )}

      <ChatFloatingButton
        onNavigateToChat={onNavigateToChat || (() => {})}
      />

      <PlotAIFloatingButton
        onClick={() => setIsChatAIOpen(!isChatAIOpen)}
        isOpen={isChatAIOpen}
        hasUnreadMessages={false}
      />

      {isChatAIOpen && (
        <PlotAIChat
          tasks={tasks}
          teamMembers={teamMembers}
          activity={activity}
          onCreateTask={handleCreateTask}
          onClose={() => setIsChatAIOpen(false)}
        />
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

      {isLibraryModalOpen && (
        <TaskLibraryModal
          tasks={tasks}
          teamMembers={teamMembers}
          sectores={sectores}
          columns={BOARD_COLUMNS}
          deletedOpsRows={deletedOpsRows}
          onClose={() => setIsLibraryModalOpen(false)}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onMarkDelivered={handleMarkDelivered}
        />
      )}
    </div>
  )
}

export default BoardPage

