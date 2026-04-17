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
  cambios_detallados?: unknown
  timestamp: string
}

function startOfLocalDayYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function endOfLocalDayYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

function taskSearchBlob(task: Task): string {
  const bits: string[] = [
    task.id,
    task.title,
    task.summary,
    task.opNumber,
    task.dniCuit ?? '',
    task.clientPhone ?? '',
    task.clientEmail ?? '',
    task.clientAddress ?? '',
    task.clienteNombreCompleto ?? '',
    task.clienteEmpresa ?? '',
    task.numeroFichaOriginal ?? '',
    task.whatsappUrl ?? '',
    task.locationUrl ?? '',
    task.driveUrl ?? '',
    ...(task.tags ?? []),
    ...(task.materials ?? [])
  ]
  return bits.join(' ').toLowerCase()
}

function strFromCambios(cd: unknown, key: string): string {
  if (!cd || typeof cd !== 'object') return ''
  const v = (cd as Record<string, unknown>)[key]
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function deletedRowSearchBlob(row: DeletedOpRow): string {
  const parts: string[] = []
  const push = (v: unknown) => {
    if (v == null || v === '') return
    if (typeof v === 'object') {
      try {
        parts.push(JSON.stringify(v).toLowerCase())
      } catch {
        parts.push(String(v).toLowerCase())
      }
      return
    }
    parts.push(String(v).toLowerCase())
  }
  push(row.numero_op)
  push(row.cliente)
  push(row.comentario)
  push(row.estado_anterior)
  push(row.estado_nuevo)
  push(row.nombre_usuario)
  push(row.rol_usuario)
  if (row.id_orden != null) push(`#${row.id_orden}`)
  push(row.id_orden)
  const cd = row.cambios_detallados
  if (cd && typeof cd === 'object') {
    const o = cd as Record<string, unknown>
    push(o.numero_op)
    push(o.cliente)
    push(o.descripcion)
    push(o.numero_ficha)
  }
  return parts.join(' ')
}

type TaskLibraryModalProps = {
  tasks: Task[]
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  columns: ReadonlyArray<{ id: TaskStatus; label: string; accent: string }>
  /** Si se pasa, no se vuelve a pedir a la API (p. ej. tests). Omitir en producción para cargar siempre al abrir. */
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
  const [elimAuditRows, setElimAuditRows] = useState<DeletedOpRow[]>([])
  const [elimAuditLoading, setElimAuditLoading] = useState(() => deletedOpsRows === undefined)
  const [elimAuditError, setElimAuditError] = useState<string | null>(null)

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesSearch =
        q === '' ||
        taskSearchBlob(task).includes(q) ||
        String(task.id ?? '')
          .toLowerCase()
          .includes(q)

      const matchesSector = selectedSector === 'todos' || task.assignedSector === selectedSector

      const matchesOperario = selectedOperario === 'todos' || task.ownerId === selectedOperario

      const matchesEstado =
        selectedEstado === 'todos' ||
        task.status === selectedEstado ||
        columns.find((c) => c.id === task.status)?.label === selectedEstado

      const matchesPrioridad = selectedPrioridad === 'todas' || task.priority === selectedPrioridad

      const impact = task.impact
      const matchesComplejidad =
        selectedComplejidad === 'todas' ||
        (selectedComplejidad === 'baja' && impact === 'low') ||
        (selectedComplejidad === 'media' && impact === 'media') ||
        (selectedComplejidad === 'alta' && impact === 'alta')

      let matchesFecha = true
      if (fechaDesde) {
        const desde = startOfLocalDayYmd(fechaDesde)
        const taskDate = new Date(task.createdAt)
        if (!Number.isNaN(desde.getTime()) && taskDate < desde) matchesFecha = false
      }
      if (fechaHasta) {
        const hasta = endOfLocalDayYmd(fechaHasta)
        const taskDate = new Date(task.createdAt)
        if (!Number.isNaN(hasta.getTime()) && taskDate > hasta) matchesFecha = false
      }

      const isCompleted = task.status === 'almacen-entrega' || task.status === 'finalizado-taller'
      if (!incluirCompletadas && isCompleted) {
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
    const baseRows = deletedOpsRows !== undefined ? deletedOpsRows : elimAuditRows
    const q = searchQuery.trim().toLowerCase()
    return baseRows.filter((row) => {
      const matchesSearch = q === '' || deletedRowSearchBlob(row).includes(q)
      if (!matchesSearch) return false
      if (fechaDesde) {
        const desde = startOfLocalDayYmd(fechaDesde)
        const rowDate = new Date(row.timestamp)
        if (!Number.isNaN(desde.getTime()) && rowDate < desde) return false
      }
      if (fechaHasta) {
        const hasta = endOfLocalDayYmd(fechaHasta)
        const rowDate = new Date(row.timestamp)
        if (!Number.isNaN(hasta.getTime()) && rowDate > hasta) return false
      }
      return true
    })
  }, [deletedOpsRows, elimAuditRows, searchQuery, fechaDesde, fechaHasta])

  useEffect(() => {
    if (deletedOpsRows !== undefined) {
      setElimAuditRows(deletedOpsRows)
      setElimAuditLoading(false)
      setElimAuditError(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        setElimAuditError(null)
        setElimAuditLoading(true)
        const resp = await apiService.getOpEliminadas()
        if (!cancelled) {
          if (resp.success && resp.data) {
            setElimAuditRows(resp.data as DeletedOpRow[])
          } else {
            setElimAuditRows([])
            setElimAuditError(resp.error || 'No se pudo cargar la lista de OP eliminadas.')
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setElimAuditRows([])
          setElimAuditError(e instanceof Error ? e.message : 'Error al cargar OP eliminadas.')
        }
      } finally {
        if (!cancelled) setElimAuditLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [deletedOpsRows])

  const elimTotalCount = deletedOpsRows !== undefined ? deletedOpsRows.length : elimAuditRows.length

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

  const deletedTableRows = (rows: DeletedOpRow[]) =>
    rows.map((row) => (
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
          {row.numero_op || strFromCambios(row.cambios_detallados, 'numero_op') || (row.id_orden ? `#${row.id_orden}` : '-')}
        </td>
        <td className="deleted-cell-cliente">
          {row.cliente || strFromCambios(row.cambios_detallados, 'cliente') || '-'}
        </td>
        <td className="deleted-cell-usuario">{row.nombre_usuario || '-'}</td>
        <td className="deleted-cell-rol">
          <span className="deleted-rol-chip">{row.rol_usuario || '-'}</span>
        </td>
        <td className="deleted-cell-motivo">
          <span className="deleted-motivo-pill">{row.comentario || 'Sin motivo registrado'}</span>
        </td>
      </tr>
    ))

  return (
    <div
      className="task-library-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="task-library-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-library-header">
          <h2>Bibliotecas de OPs - Filtros Avanzados</h2>
          <button type="button" className="task-library-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="task-library-filters">
          <div className="filter-row">
            <div className="filter-field">
              <label>Buscar</label>
              <input
                type="text"
                placeholder="N° OP, cliente, descripción, etiquetas, materiales, contacto…"
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
                  Eliminadas ({elimAuditLoading ? '…' : elimTotalCount})
                </button>
              </div>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-field">
              <label>Sector</label>
              <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
                <option value="todos">Todos los Sectores</option>
                {(sectores ?? []).map((sector) => (
                  <option key={sector.id} value={sector.nombre}>
                    {sector.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>Operario</label>
              <select value={selectedOperario} onChange={(e) => setSelectedOperario(e.target.value)}>
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
              <select value={selectedEstado} onChange={(e) => setSelectedEstado(e.target.value)}>
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
              <select value={selectedComplejidad} onChange={(e) => setSelectedComplejidad(e.target.value)}>
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
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>

            <div className="filter-field">
              <label>Fecha Hasta</label>
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
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
            <button type="button" className="btn-limpiar" onClick={handleLimpiar}>
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
                    type="button"
                    className="export-btn export-csv"
                    onClick={() => exportToCSV(filteredTasks, teamMembers, sectores, columns)}
                    title="Exportar a CSV"
                  >
                    📊 CSV
                  </button>
                  <button
                    type="button"
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
              {searchQuery.trim() !== '' && filteredDeletedOps.length > 0 && (
                <div className="task-library-deleted-hits">
                  <h3 className="task-library-deleted-hits-title">
                    OP eliminadas que coinciden con la búsqueda ({filteredDeletedOps.length})
                  </h3>
                  <p className="task-library-deleted-hits-note">
                    Las fichas borradas no están en el tablero; aquí ves el historial de auditoría.
                  </p>
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
                      <tbody>{deletedTableRows(filteredDeletedOps)}</tbody>
                    </table>
                  </div>
                </div>
              )}

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
                  <p>No se encontraron fichas activas con los filtros seleccionados.</p>
                </div>
              )}
            </>
          ) : (
            <div className="task-library-deleted-section">
              <h3>Historial de OP eliminadas</h3>
              <p className="task-library-deleted-subtitle">
                Registro de fichas borradas: quién las eliminó, cuándo y con qué motivo (incluye datos en
                auditoría aunque la OP ya no exista en el tablero).
              </p>

              {elimAuditLoading ? (
                <div className="no-results">
                  <p>Cargando OP eliminadas...</p>
                </div>
              ) : elimAuditError ? (
                <div className="no-results">
                  <p>{elimAuditError}</p>
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
                        deletedTableRows(filteredDeletedOps)
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
