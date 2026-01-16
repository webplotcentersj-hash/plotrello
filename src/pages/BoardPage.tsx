import { useEffect, useMemo, useRef, useState } from 'react'
import Board from '../components/Board'
import Header from '../components/Header'
import FiltersBar from '../components/FiltersBar'
import StatsPanel from '../components/StatsPanel'
import ActivityFeed from '../components/ActivityFeed'
import TaskEditModal from '../components/TaskEditModal'
import TaskCreateModal from '../components/TaskCreateModal'
import SprintOptimizerModal from '../components/SprintOptimizerModal'
import PlotAIChat from '../components/PlotAIChat'
import PlotAIFloatingButton from '../components/PlotAIFloatingButton'
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
  onNavigateToDiseno?: () => void
  onNavigateToRecursosHumanos?: () => void
  onNavigateToClientesWeb?: () => void
  onNavigateToAsesorPresupuestos?: () => void
  onNavigateToFlota?: () => void
  onNavigateToERP?: () => void
  onLogout?: () => void
  onReloadData?: () => Promise<void>
  isSyncing?: boolean
  syncError?: string | null
  sectores: SectorRecord[]
  materialesCatalog: MaterialRecord[]
  isCompact: boolean
  onToggleCompact: () => void
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
  onNavigateToDiseno,
  onNavigateToRecursosHumanos,
  onNavigateToClientesWeb,
  onNavigateToAsesorPresupuestos,
  onNavigateToFlota,
  onNavigateToERP,
  onLogout,
  onReloadData,
  isSyncing,
  syncError,
  sectores,
  materialesCatalog,
  isCompact,
  onToggleCompact
}: BoardPageProps) => {
  const { usuario, isAdmin, isMostrador, isDiseno } = useAuth()
  const [statusFocus, setStatusFocus] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas')
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
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (actionError || actionSuccess) {
      const timer = setTimeout(() => {
        setActionError(null)
        setActionSuccess(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [actionError, actionSuccess])

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

  const persistWorkingUser = async (taskId: string, workingUser: string | null) => {
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
  }

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
    return tasks.filter((task) => {
      // Excluir fichas entregadas/archivadas del board principal
      if (task.entregado) return false
      
      const matchesStatus = statusFocus.length === 0 || statusFocus.includes(task.status)
      const matchesPriority = priorityFilter === 'todas' || task.priority === priorityFilter
      const matchesSector = 
        sectorFilter === 'todos' || 
        task.assignedSector === sectorFilter ||
        (task.sectores && task.sectores.includes(sectorFilter))
      const matchesSearch =
        task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.summary.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesPriority && matchesSector && matchesSearch
    })
  }, [tasks, statusFocus, priorityFilter, sectorFilter, searchQuery])

  const toggleStatusFocus = (status: TaskStatus) => {
    setStatusFocus((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    )
  }

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
  }, [])

  // Listener para actualizar solo la etapa de una tarea sin recargar todo
  useEffect(() => {
    const handleUpdateTaskEtapa = (event: Event) => {
      const customEvent = event as CustomEvent<{
        ordenId: number
        etapa: string
        fechaInicio?: string | null
        tipo: 'taller_grafico' | 'instalaciones' | 'taller_imprenta' | 'metalurgica'
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

  const handleMoveTask = async (taskId: string, destination: TaskStatus) => {
    const destinationColumn = BOARD_COLUMNS.find((column) => column.id === destination)

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task
        return {
          ...task,
          status: destination,
          assignedSector: destinationColumn?.label ?? task.assignedSector,
          updatedAt: new Date().toISOString(),
          progress: destination === 'almacen-entrega' ? 100 : task.progress
        }
      })
    )

    const taskSnapshot = tasks.find((task) => task.id === taskId)
    if (!taskSnapshot || taskSnapshot.status === destination) return

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

    const ordenId = parseTaskIdToOrdenId(taskId)
    if (ordenId) {
      const nuevoEstado = mapStatusToEstado(destination)
      
      // Notificar a App.tsx sobre el movimiento reciente para evitar efecto espejo
      window.dispatchEvent(new CustomEvent('user-moved-task', {
        detail: { taskId: ordenId.toString(), estado: nuevoEstado, timestamp: Date.now() }
      }))
      
      const usuarioId = Number(localStorage.getItem('usuario_id')) || 0
      const response = await apiService.moveOrden(
        ordenId,
        nuevoEstado,
        usuarioId
      )
      if (!response.success) {
        setActionError(response.error || 'No se pudo actualizar la orden en Supabase.')
        // Revertir el cambio local si falla
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id !== taskId) return task
            return taskSnapshot
          })
        )
      } else {
        setActionSuccess('Orden actualizada en Supabase.')
        // ⚠️ NO recargar todos los datos - confiar en el realtime subscription
        // El realtime actualizará automáticamente cuando la BD cambie
        // onReloadData() causaba que las fichas volvieran al estado anterior
      }
    }
  }

  const handleEditTask = (task: Task) => {
    const editingUserName = resolveCurrentUserName()
    void persistWorkingUser(task.id, editingUserName)
    setTaskToEdit({ ...task, workingUser: editingUserName })
  }

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
        
        // Determinar el status final:
        // - Si cambió el sector, usar el nuevo status basado en el sector
        // - Si NO cambió el sector, preservar el status original (columna actual)
        const statusFinal = sectorCambio 
          ? taskConStatusActualizado.status 
          : (taskOriginal?.status || updatedTask.status) // Preservar el status original si no cambió el sector
        
        console.log(`📊 Status final: ${statusFinal} (sectorCambio: ${sectorCambio}, original: ${taskOriginal?.status}, updated: ${updatedTask.status})`)
        
        // Notificar al realtime que esta tarea fue editada para preservar su status
        window.dispatchEvent(new CustomEvent('user-edited-task', {
          detail: { taskId: ordenId.toString(), status: statusFinal, timestamp: Date.now() }
        }))
        
        const taskFinal: Task = {
          ...taskActualizado,
          status: statusFinal, // Preservar el status original si no cambió el sector, sino usar el nuevo
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

  const handleDeleteTask = async (taskId: string) => {
    void persistWorkingUser(taskId, null)
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setTaskToEdit(null)

    const ordenId = parseTaskIdToOrdenId(taskId)
    if (ordenId) {
      const response = await apiService.deleteOrden(ordenId)
      if (!response.success) {
        setActionError(response.error || 'No se pudo eliminar la orden en Supabase.')
      } else if (onReloadData) {
        await onReloadData()
      }
    }
  }

  const handleMarkDelivered = async (taskId: string, delivered: boolean) => {
    const ordenId = parseTaskIdToOrdenId(taskId)
    if (!ordenId) return

    const response = await apiService.marcarEntregado(ordenId, delivered)
    if (response.success) {
      // Actualizar el estado local
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, entregado: delivered } : task
        )
      )
      setActionSuccess(delivered ? 'Ficha marcada como entregada y archivada' : 'Ficha desarchivada')
    } else {
      setActionError(response.error || 'No se pudo marcar como entregado')
    }
  }

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
        onOptimizeSprint={() => setIsOptimizerModalOpen(true)}
        onNavigateToStats={onNavigateToStats}
        onNavigateToCalendar={onNavigateToCalendar}
        onNavigateToGantt={onNavigateToGantt}
        onNavigateToUsuarios={onNavigateToUsuarios}
        onNavigateToChat={onNavigateToChat}
        onNavigateToHerramienta={onNavigateToHerramienta}
        onNavigateToMostrador={onNavigateToMostrador}
        onNavigateToCompras={onNavigateToCompras}
        onNavigateToDiseno={onNavigateToDiseno}
            onNavigateToRecursosHumanos={onNavigateToRecursosHumanos}
            onNavigateToClientesWeb={onNavigateToClientesWeb}
            onNavigateToAsesorPresupuestos={onNavigateToAsesorPresupuestos}
            onNavigateToFlota={onNavigateToFlota}
            onNavigateToERP={onNavigateToERP}
        onSolicitarProductos={() => setIsSolicitarProductosOpen(true)}
        onOpenChatAI={() => setIsChatAIOpen(true)}
        onLogout={onLogout}
        isAdmin={isAdmin}
        isMostrador={isMostrador}
        isDiseno={isDiseno}
        isCompact={isCompact}
        onToggleCompact={onToggleCompact}
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
        onOpenLibrary={() => setIsLibraryModalOpen(true)}
      />

      <main className="app-layout">
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
          />
        </section>

        <aside className="insights-panel">
          {isAdmin && <StatsPanel tasks={tasks} activity={activity} teamMembers={teamMembers} />}
          <ActivityFeed activity={activity} teamMembers={teamMembers} />
        </aside>
      </main>

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

