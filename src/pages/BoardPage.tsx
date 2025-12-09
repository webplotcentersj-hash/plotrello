import { useEffect, useMemo, useState } from 'react'
import Board from '../components/Board'
import Header from '../components/Header'
import FiltersBar from '../components/FiltersBar'
import StatsPanel from '../components/StatsPanel'
import ActivityFeed from '../components/ActivityFeed'
import TaskEditModal from '../components/TaskEditModal'
import TaskCreateModal from '../components/TaskCreateModal'
import SprintOptimizerModal from '../components/SprintOptimizerModal'
import PlotAIChat from '../components/PlotAIChat'
import TaskLibraryModal from '../components/TaskLibraryModal'
import { BOARD_COLUMNS } from '../data/mockData'
import type { ActivityEvent, Priority, Task, TaskStatus, TeamMember } from '../types/board'
import type { MaterialRecord, SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  ordenToTask,
  parseTaskIdToOrdenId,
  taskToOrdenPayload,
  mapStatusToEstado
} from '../utils/dataMappers'

type BoardPageProps = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  activity: ActivityEvent[]
  setActivity: React.Dispatch<React.SetStateAction<ActivityEvent[]>>
  teamMembers: TeamMember[]
  onNavigateToStats: () => void
  onNavigateToUsuarios?: () => void
  onNavigateToChat?: () => void
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
  onNavigateToUsuarios,
  onNavigateToChat,
  onLogout,
  onReloadData,
  isSyncing,
  syncError,
  sectores,
  materialesCatalog
}: BoardPageProps) => {
  const { usuario, isAdmin } = useAuth()
  const [statusFocus, setStatusFocus] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false)
  const [isChatAIOpen, setIsChatAIOpen] = useState(false)
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = statusFocus.length === 0 || statusFocus.includes(task.status)
      const matchesPriority = priorityFilter === 'todas' || task.priority === priorityFilter
      const matchesSearch =
        task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.summary.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesPriority && matchesSearch
    })
  }, [tasks, statusFocus, priorityFilter, searchQuery])

  const toggleStatusFocus = (status: TaskStatus) => {
    setStatusFocus((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    )
  }

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
    setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
    setActivity((prev) => [
      {
        id: `edit-${Date.now()}`,
        taskId: updatedTask.id,
        from: updatedTask.status,
        to: updatedTask.status,
        actorId: updatedTask.ownerId,
        timestamp: new Date().toISOString(),
        note: 'Tarea actualizada'
      },
      ...prev
    ])

    const ordenId = parseTaskIdToOrdenId(updatedTask.id)
    if (ordenId) {
      const response = await apiService.updateOrden(ordenId, taskToOrdenPayload(updatedTask))
      if (response.success && response.data) {
        const syncedTask = ordenToTask(response.data)
        setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? syncedTask : task)))
        setActionSuccess('Cambios guardados en Supabase.')
        if (onReloadData) await onReloadData()
      } else {
        setActionError(response.error || 'No se pudo guardar la orden en Supabase.')
      }
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

  const handleCreateTask = async (newTaskData: Omit<Task, 'id'>) => {
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
        onAddNewOrder={() => setIsCreateModalOpen(true)}
        onOptimizeSprint={() => setIsOptimizerModalOpen(true)}
        onNavigateToStats={onNavigateToStats}
        onNavigateToUsuarios={onNavigateToUsuarios}
        onNavigateToChat={onNavigateToChat}
        onOpenChatAI={() => setIsChatAIOpen(true)}
        onLogout={onLogout}
        isAdmin={isAdmin}
      />
      <FiltersBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
        onOpenLibrary={() => setIsLibraryModalOpen(true)}
      />

      <main className="app-layout">
        <section className="board-panel">
          <Board
            columns={BOARD_COLUMNS}
            tasks={filteredTasks}
            allTasks={tasks}
            onMoveTask={handleMoveTask}
            members={teamMembers}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            sectores={sectores}
          />
        </section>

        <aside className="insights-panel">
          <StatsPanel tasks={tasks} activity={activity} teamMembers={teamMembers} />
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

      {isChatAIOpen && (
        <PlotAIChat
          tasks={tasks}
          teamMembers={teamMembers}
          activity={activity}
          onCreateTask={handleCreateTask}
          onClose={() => setIsChatAIOpen(false)}
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
        />
      )}
    </div>
  )
}

export default BoardPage

