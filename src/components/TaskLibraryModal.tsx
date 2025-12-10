import { useState, useMemo } from 'react'
import type { Task, TaskStatus, Priority, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import TaskCard from './TaskCard'
import { exportToCSV, exportToPDF } from '../utils/exportUtils'
import './TaskLibraryModal.css'

type TaskLibraryModalProps = {
  tasks: Task[]
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  columns: ReadonlyArray<{ id: TaskStatus; label: string; accent: string }>
  onClose: () => void
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  onMarkDelivered?: (taskId: string, delivered: boolean) => Promise<void>
}

const TaskLibraryModal = ({
  tasks,
  teamMembers,
  sectores,
  columns,
  onClose,
  onEditTask,
  onDeleteTask,
  onMarkDelivered
}: TaskLibraryModalProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('todos')
  const [selectedOperario, setSelectedOperario] = useState<string>('todos')
  const [selectedEstado, setSelectedEstado] = useState<string>('todos')
  const [selectedPrioridad, setSelectedPrioridad] = useState<Priority | 'todas'>('todas')
  const [selectedComplejidad, setSelectedComplejidad] = useState<string>('todas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [incluirCompletadas, setIncluirCompletadas] = useState(false)

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Búsqueda
      const matchesSearch =
        searchQuery === '' ||
        task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.opNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.summary.toLowerCase().includes(searchQuery.toLowerCase())

      // Sector
      const matchesSector =
        selectedSector === 'todos' || task.assignedSector === selectedSector

      // Operario
      const matchesOperario =
        selectedOperario === 'todos' || task.ownerId === selectedOperario

      // Estado
      const matchesEstado =
        selectedEstado === 'todos' ||
        task.status === selectedEstado ||
        columns.find((c) => c.id === task.status)?.label === selectedEstado

      // Prioridad
      const matchesPrioridad =
        selectedPrioridad === 'todas' || task.priority === selectedPrioridad

      // Complejidad
      const matchesComplejidad =
        selectedComplejidad === 'todas' ||
        task.impact === selectedComplejidad ||
        (selectedComplejidad === 'alta' && task.impact === 'alta') ||
        (selectedComplejidad === 'media' && task.impact === 'media') ||
        (selectedComplejidad === 'baja' && task.impact === 'low')

      // Fechas
      let matchesFecha = true
      if (fechaDesde) {
        const desde = new Date(fechaDesde)
        const taskDate = new Date(task.createdAt)
        if (taskDate < desde) matchesFecha = false
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        const taskDate = new Date(task.createdAt)
        if (taskDate > hasta) matchesFecha = false
      }

      // Completadas antiguas
      const isCompleted = task.status === 'almacen-entrega' || task.status === 'finalizado-taller'
      if (!incluirCompletadas && isCompleted) {
        // Solo excluir si no está en los últimos 30 días
        const taskDate = new Date(task.updatedAt)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        if (taskDate < thirtyDaysAgo) return false
      }

      return (
        matchesSearch &&
        matchesSector &&
        matchesOperario &&
        matchesEstado &&
        matchesPrioridad &&
        matchesComplejidad &&
        matchesFecha
      )
    })
  }, [
    tasks,
    searchQuery,
    selectedSector,
    selectedOperario,
    selectedEstado,
    selectedPrioridad,
    selectedComplejidad,
    fechaDesde,
    fechaHasta,
    incluirCompletadas,
    columns
  ])

  const handleLimpiar = () => {
    setSearchQuery('')
    setSelectedSector('todos')
    setSelectedOperario('todos')
    setSelectedEstado('todos')
    setSelectedPrioridad('todas')
    setSelectedComplejidad('todas')
    setFechaDesde('')
    setFechaHasta('')
    setIncluirCompletadas(false)
  }

  return (
    <div className="task-library-modal-overlay" onClick={onClose}>
      <div className="task-library-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-library-header">
          <h2>Bibliotecas de OPs - Filtros Avanzados</h2>
          <button className="task-library-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="task-library-filters">
          <div className="filter-row">
            <div className="filter-field">
              <label>Buscar</label>
              <input
                type="text"
                placeholder="N° OP o Cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-field">
              <label>Sector</label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
              >
                <option value="todos">Todos los Sectores</option>
                {sectores.map((sector) => (
                  <option key={sector.id} value={sector.nombre}>
                    {sector.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>Operario</label>
              <select
                value={selectedOperario}
                onChange={(e) => setSelectedOperario(e.target.value)}
              >
                <option value="todos">Todos los Operarios</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>Estado</label>
              <select
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>Prioridad</label>
              <select
                value={selectedPrioridad}
                onChange={(e) => setSelectedPrioridad(e.target.value as Priority | 'todas')}
              >
                <option value="todas">Todas las Prioridades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div className="filter-field">
              <label>Complejidad</label>
              <select
                value={selectedComplejidad}
                onChange={(e) => setSelectedComplejidad(e.target.value)}
              >
                <option value="todas">Todas las Complejidades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-field">
              <label>Fecha Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>

            <div className="filter-field">
              <label>Fecha Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>

            <div className="filter-field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={incluirCompletadas}
                  onChange={(e) => setIncluirCompletadas(e.target.checked)}
                />
                Incluir fichas completadas antiguas
              </label>
            </div>
          </div>

          <div className="filter-actions">
            <button className="btn-limpiar" onClick={handleLimpiar}>
              Limpiar
            </button>
          </div>
        </div>

        <div className="task-library-results">
          <div className="results-header">
            <span>Resultados</span>
            <div className="results-header-right">
              <span className="results-count">{filteredTasks.length} fichas encontradas</span>
              {filteredTasks.length > 0 && (
                <div className="export-buttons">
                  <button
                    className="export-btn export-csv"
                    onClick={() => exportToCSV(filteredTasks, teamMembers, sectores, columns)}
                    title="Exportar a CSV"
                  >
                    📊 CSV
                  </button>
                  <button
                    className="export-btn export-pdf"
                    onClick={() => exportToPDF(filteredTasks, teamMembers, sectores, columns)}
                    title="Exportar a PDF"
                  >
                    📄 PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="task-library-grid">
            {filteredTasks.map((task, index) => {
              const owner = teamMembers.find((m) => m.id === task.ownerId)
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  owner={owner}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  sectores={sectores}
                  isDraggable={false}
                  onMarkDelivered={onMarkDelivered}
                />
              )
            })}
          </div>

          {filteredTasks.length === 0 && (
            <div className="no-results">
              <p>No se encontraron fichas con los filtros seleccionados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskLibraryModal

