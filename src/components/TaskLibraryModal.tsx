import { useState, useMemo, useEffect } from 'react'
import type { Task, TaskStatus, Priority, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import TaskCard from './TaskCard'
import { exportToCSV, exportToPDF } from '../utils/exportUtils'
import apiService from '../services/api'
import './TaskLibraryModal.css'

type DeletedOpRow = {
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
  cambios_detallados?: any
  timestamp: string
}

type TaskLibraryModalProps = {
  tasks: Task[]
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  columns: ReadonlyArray<{ id: TaskStatus; label: string; accent: string }>
  deletedOpsRows?: DeletedOpRow[]
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
  deletedOpsRows,
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
  const [viewMode, setViewMode] = useState<'activas' | 'eliminadas'>('activas')
  const [localDeletedOps, setLocalDeletedOps] = useState<DeletedOpRow[] | null>(null)
  const [deletedOpsError, setDeletedOpsError] = useState<string | null>(null)

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

  const filteredDeletedOps = useMemo(() => {
    const baseRows = deletedOpsRows ?? localDeletedOps ?? []
    if (!baseRows) return []
    const q = searchQuery.trim().toLowerCase()
    return baseRows.filter((row) => {
      const numero =
        row.numero_op ||
        (row.cambios_detallados && (row.cambios_detallados as any).numero_op) ||
        (row.id_orden ? `#${row.id_orden}` : '')
      const cliente =
        row.cliente ||
        (row.cambios_detallados && (row.cambios_detallados as any).cliente) ||
        ''
      const motivo = row.comentario || ''
      const matchesSearch =
        !q ||
        numero.toLowerCase().includes(q) ||
        cliente.toLowerCase().includes(q) ||
        motivo.toLowerCase().includes(q)
      if (!matchesSearch) return false
      if (fechaDesde) {
        const desde = new Date(fechaDesde)
        const rowDate = new Date(row.timestamp)
        if (rowDate < desde) return false
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        const rowDate = new Date(row.timestamp)
        if (rowDate > hasta) return false
      }
      return true
    })
  }, [deletedOpsRows, localDeletedOps, searchQuery, fechaDesde, fechaHasta])

  // Cargar OP eliminadas si el padre no las pasó ya
  useEffect(() => {
    if (deletedOpsRows) {
      setLocalDeletedOps(null)
      setDeletedOpsError(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        setDeletedOpsError(null)
        const resp = await apiService.getOpEliminadas()
        if (!cancelled) {
          if (resp.success && resp.data) {
            setLocalDeletedOps(resp.data as DeletedOpRow[])
          } else {
            setLocalDeletedOps([])
            setDeletedOpsError(resp.error || 'No se pudo cargar la lista de OP eliminadas.')
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setLocalDeletedOps([])
          setDeletedOpsError(e?.message || 'Error al cargar OP eliminadas.')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [deletedOpsRows])

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

          <div className="filter-row" style={{ alignItems: 'flex-end' }}>
            <div className="filter-field" style={{ flex: 1 }}>
              <label>Biblioteca</label>
              <div className="task-library-mode-toggle" role="tablist" aria-label="Biblioteca">
                <button
                  type="button"
                  className={viewMode === 'activas' ? 'is-active' : ''}
                  onClick={() => setViewMode('activas')}
                >
                  Activas ({filteredTasks.length})
                </button>
                <button
                  type="button"
                  className={viewMode === 'eliminadas' ? 'is-active' : ''}
                  onClick={() => setViewMode('eliminadas')}
                >
                  Eliminadas ({deletedOpsRows ?? localDeletedOps ? filteredDeletedOps.length : '…'})
                </button>
              </div>
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
              <span className="results-count">
                {viewMode === 'activas'
                  ? `${filteredTasks.length} fichas encontradas`
                  : `${filteredDeletedOps.length} eliminadas encontradas`}
              </span>
              {viewMode === 'activas' && filteredTasks.length > 0 && (
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

          {viewMode === 'activas' ? (
            <>
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
            </>
          ) : (
            <div className="task-library-deleted-section">
              <h3>Historial de OP eliminadas</h3>
              <p className="task-library-deleted-subtitle">
                Registro completo de fichas borradas: quién las eliminó, cuándo y con qué motivo.
              </p>

              {!deletedOpsRows && !localDeletedOps ? (
                <div className="no-results">
                  <p>Cargando OP eliminadas...</p>
                </div>
              ) : deletedOpsError ? (
                <div className="no-results">
                  <p>{deletedOpsError}</p>
                </div>
              ) : (
                <div className="task-library-deleted-table-wrapper">
                  <table className="task-library-deleted-table">
                    <thead>
                      <tr>
                        <th className="deleted-col-fecha">Fecha</th>
                        <th className="deleted-col-op">Nº OP</th>
                        <th className="deleted-col-cliente">Cliente</th>
                        <th className="deleted-col-usuario">Usuario</th>
                        <th className="deleted-col-rol">Rol</th>
                        <th className="deleted-col-motivo">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeletedOps.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '16px' }}>
                            No hay OP eliminadas para mostrar con estos filtros.
                          </td>
                        </tr>
                        ) : (
                        filteredDeletedOps.map((row) => (
                          <tr key={row.id}>
                            <td className="deleted-cell-fecha">
                              {new Date(row.timestamp).toLocaleString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="deleted-cell-op">
                              {row.numero_op ||
                                (row.cambios_detallados && (row.cambios_detallados as any).numero_op) ||
                                (row.id_orden ? `#${row.id_orden}` : '-')}
                            </td>
                            <td className="deleted-cell-cliente">
                              {row.cliente ||
                                (row.cambios_detallados && (row.cambios_detallados as any).cliente) ||
                                '-'}
                            </td>
                            <td className="deleted-cell-usuario">{row.nombre_usuario || '-'}</td>
                            <td className="deleted-cell-rol">
                              <span className="deleted-rol-chip">{row.rol_usuario || '-'}</span>
                            </td>
                            <td className="deleted-cell-motivo">
                              <span className="deleted-motivo-pill">
                                {row.comentario || 'Sin motivo registrado'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskLibraryModal

