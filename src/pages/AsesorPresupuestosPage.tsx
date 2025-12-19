import { useEffect, useMemo, useRef, useState } from 'react'
import Board from '../components/Board'
import Header from '../components/Header'
import FiltersBar from '../components/FiltersBar'
import TaskEditModal from '../components/TaskEditModal'
import TaskCreateModal from '../components/TaskCreateModal'
import { ASESOR_PRESUPUESTOS_COLUMNS } from '../data/asesorPresupuestosColumns'
import type { ActivityEvent, Priority, Task, TaskStatus, TeamMember } from '../types/board'
import type { MaterialRecord, SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  parseTaskIdToOrdenId,
  taskToOrdenPayload
} from '../utils/dataMappers'
import './AsesorPresupuestosPage.css'

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
  onReloadData?: () => Promise<void>
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
  const { isAdmin, isAsesorTecnico, isPresupuestos } = useAuth()
  const [statusFocus, setStatusFocus] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Verificar permisos
  const canAccess = isAdmin || isAsesorTecnico || isPresupuestos

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
      filtered = filtered.filter(
        (task) =>
          task.opNumber.toLowerCase().includes(query) ||
          task.title.toLowerCase().includes(query) ||
          task.summary.toLowerCase().includes(query) ||
          task.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    if (priorityFilter !== 'todas') {
      filtered = filtered.filter((task) => task.priority === priorityFilter)
    }

    if (statusFocus.length > 0) {
      filtered = filtered.filter((task) => statusFocus.includes(task.status))
    }

    return filtered
  }, [tasks, searchQuery, priorityFilter, statusFocus, canAccess])

  useEffect(() => {
    if (actionError || actionSuccess) {
      const timer = setTimeout(() => {
        setActionError(null)
        setActionSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [actionError, actionSuccess])

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

      const updatedTask = {
        ...taskToUpdate,
        status: destination,
        assignedSector: destinationColumn.label
      }
      const payload = taskToOrdenPayload(updatedTask)

      const response = await apiService.updateOrden(ordenId, payload)
      if (!response.success) {
        setActionError(response.error || 'Error al mover la orden')
        return
      }

      setActionSuccess('Orden movida correctamente')
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

  const handleTaskCreate = async (newTask: Partial<Task>) => {
    try {
      const sectorInicial = 'Asesor Técnico' // Por defecto empieza en Asesor Técnico
      const taskWithDefaults: Task = {
        ...newTask,
        id: 'temp',
        opNumber: newTask.opNumber || '',
        title: newTask.title || '',
        summary: newTask.summary || '',
        status: 'asesor-tecnico',
        priority: newTask.priority || 'media',
        ownerId: newTask.ownerId || '',
        createdBy: newTask.createdBy || '',
        tags: newTask.tags || [],
        materials: newTask.materials || [],
        assignedSector: sectorInicial,
        photoUrl: newTask.photoUrl || '',
        storyPoints: newTask.storyPoints || 0,
        progress: newTask.progress || 0,
        createdAt: newTask.createdAt || new Date().toISOString(),
        dueDate: newTask.dueDate || new Date().toISOString(),
        updatedAt: newTask.updatedAt || new Date().toISOString(),
        impact: newTask.impact || 'media'
      } as Task
      const payload = taskToOrdenPayload(taskWithDefaults)

      const response = await apiService.createOrden(payload)
      if (!response.success) {
        setActionError(response.error || 'Error al crear la orden')
        return
      }

      setActionSuccess('Orden creada correctamente')
      setIsCreateModalOpen(false)
      if (onReloadData) {
        await onReloadData()
      }
    } catch (error) {
      console.error('Error creando tarea:', error)
      setActionError('Error al crear la orden')
    }
  }

  if (!canAccess) {
    return (
      <div className="asesor-presupuestos-page">
        <div className="access-denied">
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="asesor-presupuestos-page">
      <Header
        teamMembers={teamMembers}
        activity={activity}
        onNavigateToStats={onNavigateToStats}
        onNavigateToUsuarios={onNavigateToUsuarios}
        onNavigateToChat={onNavigateToChat}
        onLogout={onLogout}
      />

      <div className="asesor-presupuestos-content">
        <div className="asesor-presupuestos-header">
          <h1>Asesor Técnico y Presupuestos</h1>
          <p className="subtitle">Gestión de mediciones, factibilidad y presupuestos</p>
        </div>

        {actionError && (
          <div className="alert alert-error">
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="alert alert-success">
            {actionSuccess}
          </div>
        )}

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
          onAddNewOrder={() => setIsCreateModalOpen(true)}
        />

        <div className="board-container">
          <Board
            tasks={filteredTasks}
            allTasks={tasks}
            onMoveTask={handleTaskMove}
            members={teamMembers}
            onEditTask={(task) => setTaskToEdit(task)}
            columns={ASESOR_PRESUPUESTOS_COLUMNS}
            sectores={sectores}
            activity={activity}
          />
        </div>

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

        {isCreateModalOpen && (
          <TaskCreateModal
            teamMembers={teamMembers}
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={async (newTask) => {
              await handleTaskCreate(newTask)
            }}
            sectores={sectores.filter(s => 
              s.nombre === 'Asesor Técnico' || s.nombre === 'Presupuestos'
            )}
            materiales={materialesCatalog}
          />
        )}
      </div>
    </div>
  )
}

export default AsesorPresupuestosPage

