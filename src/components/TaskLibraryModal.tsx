import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import type { Task, TaskStatus, Priority, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import TaskCard from './TaskCard'
import { exportToCSV, exportToPDF } from '../utils/exportUtils'
import apiService from '../services/api'
import { ordenToTask, parseTaskIdToOrdenId } from '../utils/dataMappers'
import TaskViewModal from './TaskViewModal'
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
  /** Motivo persistido en ordenes_trabajo (borrado lógico) */
  motivo_eliminacion?: string | null
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

function matchesSearchQuery(task: Task, q: string): boolean {
  if (!q) return true
  if (taskSearchBlob(task).includes(q)) return true
  if (/^\d+$/.test(q)) {
    const oid = parseTaskIdToOrdenId(task.id)
    if (oid != null && String(oid) === q) return true
  }
  return false
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
    task.motivoEliminacion ?? '',
    task.fechaEliminacion ?? '',
    ...(task.tags ?? []),
    ...(task.materials ?? [])
  ]
  return bits.join(' ').toLowerCase()
}

/** En OP eliminadas, las fechas “desde/hasta” de la biblioteca usan fecha de borrado si existe. */
function taskDateForLibraryFechaFilter(task: Task): Date {
  if (task.ordenEliminada && task.fechaEliminacion) {
    return new Date(task.fechaEliminacion)
  }
  return new Date(task.createdAt)
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
  push(row.motivo_eliminacion)
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
}

const TaskLibraryModal = ({
  tasks,
  teamMembers,
  sectores,
  columns,
  deletedOpsRows,
  onClose
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
  const [eliminadasTasks, setEliminadasTasks] = useState<Task[]>([])
  const [elimAuditLoading, setElimAuditLoading] = useState(() => deletedOpsRows === undefined)
  const [elimAuditError, setElimAuditError] = useState<string | null>(null)
  const [elimDetalleError, setElimDetalleError] = useState<string | null>(null)
  /** Escala visual de las fichas (solo biblioteca; no modifica datos). */
  const [cardScale, setCardScale] = useState(1)
  const [libraryDetailTask, setLibraryDetailTask] = useState<Task | null>(null)

  const openLibraryDetail = useCallback((t: Task) => {
    setLibraryDetailTask(t)
  }, [])

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesSearch = matchesSearchQuery(task, q)

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

  const filteredEliminadasTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return eliminadasTasks.filter((task) => {
      const matchesSearch = matchesSearchQuery(task, q)
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
      const rowDate = taskDateForLibraryFechaFilter(task)
      if (fechaDesde) {
        const desde = startOfLocalDayYmd(fechaDesde)
        if (!Number.isNaN(desde.getTime()) && rowDate < desde) matchesFecha = false
      }
      if (fechaHasta) {
        const hasta = endOfLocalDayYmd(fechaHasta)
        if (!Number.isNaN(hasta.getTime()) && rowDate > hasta) matchesFecha = false
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
    eliminadasTasks,
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
      setEliminadasTasks([])
      setElimAuditLoading(false)
      setElimAuditError(null)
      setElimDetalleError(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        setElimAuditError(null)
        setElimDetalleError(null)
        setElimAuditLoading(true)
        const [auditResp, detResp] = await Promise.all([
          apiService.getOpEliminadas(),
          apiService.getOrdenesEliminadasDetalle()
        ])
        if (!cancelled) {
          if (auditResp.success && auditResp.data) {
            setElimAuditRows(auditResp.data as DeletedOpRow[])
          } else {
            setElimAuditRows([])
            setElimAuditError(auditResp.error || 'No se pudo cargar la lista de OP eliminadas.')
          }
          if (detResp.success && detResp.data) {
            setEliminadasTasks(detResp.data.map((o) => ordenToTask(o)))
            setElimDetalleError(null)
          } else {
            setEliminadasTasks([])
            setElimDetalleError(detResp.error || 'No se pudieron cargar las fichas de OP eliminadas.')
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setElimAuditRows([])
          setEliminadasTasks([])
          setElimAuditError(e instanceof Error ? e.message : 'Error al cargar OP eliminadas.')
          setElimDetalleError(null)
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

  const eliminadasFichasCount =
    deletedOpsRows !== undefined ? 0 : eliminadasTasks.length

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

  const deletedMotivoParts = (row: DeletedOpRow): { main: string; extra?: string } => {
    const m = row.motivo_eliminacion != null ? String(row.motivo_eliminacion).trim() : ''
    const c = row.comentario != null ? String(row.comentario).trim() : ''
    if (m) {
      return { main: m, extra: c && c !== m ? c : undefined }
    }
    if (c) return { main: c }
    return { main: 'Sin motivo registrado' }
  }

  const deletedTableRows = (rows: DeletedOpRow[]) =>
    rows.map((row) => {
      const { main, extra } = deletedMotivoParts(row)
      const op =
        row.numero_op ||
        strFromCambios(row.cambios_detallados, 'numero_op') ||
        (row.id_orden ? `#${row.id_orden}` : '-')
      const cliente = row.cliente || strFromCambios(row.cambios_detallados, 'cliente') || '-'
      const fechaCorta = new Date(row.timestamp).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      const metaBits = [row.nombre_usuario, row.rol_usuario].filter(Boolean).join(' · ')
      return (
        <tr key={row.id}>
          <td className="deleted-cell-fecha deleted-cell-fecha--compact">{fechaCorta}</td>
          <td className="deleted-cell-op deleted-cell-op--compact">{op}</td>
          <td className="deleted-cell-cliente deleted-cell-cliente--compact">{cliente}</td>
          <td className="deleted-cell-motivo deleted-cell-motivo--compact">
            <div className="deleted-motivo-main">{main}</div>
            {extra ? <div className="deleted-motivo-extra">{extra}</div> : null}
            {metaBits ? <div className="deleted-motivo-meta">{metaBits}</div> : null}
          </td>
        </tr>
      )
    })

  return (
    <Fragment>
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
          <div>
            <h2>Bibliotecas de OPs - Filtros Avanzados</h2>
            <p className="task-library-readonly-hint">
              Solo búsqueda y consulta: desde acá no se edita la OP (usá el tablero para cambios). Hacé clic en una
              ficha para abrir el detalle completo en grande (movimientos, adjuntos, comentarios, trazados).
            </p>
          </div>
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
                placeholder="N° OP, id orden, cliente, descripción, etiquetas, materiales, contacto…"
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
                  Eliminadas ({elimAuditLoading ? '…' : `${eliminadasFichasCount} OP`})
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
              {(viewMode === 'activas' || viewMode === 'eliminadas') && (
                <label className="task-library-scale-control" title="Tamaño de las fichas (solo visualización)">
                  <span className="task-library-scale-label">Tamaño</span>
                  <input
                    type="range"
                    min={0.65}
                    max={1.55}
                    step={0.05}
                    value={cardScale}
                    onChange={(e) => setCardScale(Number(e.target.value))}
                  />
                  <span className="task-library-scale-value">{Math.round(cardScale * 100)}%</span>
                </label>
              )}
              <span className="results-count">
                {viewMode === 'activas'
                  ? `${filteredTasks.length} fichas encontradas`
                  : `${filteredEliminadasTasks.length} fichas · ${filteredDeletedOps.length} filas auditoría`}
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
                <div className="task-library-deleted-hits task-library-deleted-hits--compact">
                  <div className="task-library-deleted-hits-head">
                    <span className="task-library-deleted-hits-title">
                      Eliminadas en búsqueda ({filteredDeletedOps.length})
                    </span>
                    <span className="task-library-deleted-hits-hint">Motivo en columna final</span>
                  </div>
                  <div className="task-library-deleted-table-wrapper task-library-deleted-table-wrapper--compact">
                    <table className="task-library-deleted-table task-library-deleted-table--compact">
                      <thead>
                        <tr>
                          <th className="deleted-col-fecha">Fecha</th>
                          <th className="deleted-col-op">Nº OP</th>
                          <th className="deleted-col-cliente">Cliente</th>
                          <th className="deleted-col-motivo">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>{deletedTableRows(filteredDeletedOps)}</tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="task-library-grid-outer">
                <div
                  className="task-library-grid-scaler"
                  style={{
                    transform: `scale(${cardScale})`,
                    transformOrigin: 'top left',
                    width: `${100 / cardScale}%`
                  }}
                >
                  <div className="task-library-grid">
                    {filteredTasks.map((task, index) => {
                      const owner = teamMembers.find((m) => m.id === task.ownerId)
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          index={index}
                          owner={owner}
                          sectores={sectores}
                          isDraggable={false}
                          readOnly
                          onInspectReadOnly={openLibraryDetail}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>

              {filteredTasks.length === 0 && (
                <div className="no-results">
                  <p>No se encontraron fichas activas con los filtros seleccionados.</p>
                </div>
              )}
            </>
          ) : (
            <div className="task-library-deleted-section task-library-deleted-section--compact">
              <p className="task-library-deleted-lead">
                Fichas de OP con borrado lógico (misma vista que en el tablero, solo lectura). Debajo:{' '}
                <strong>auditoría</strong> de eliminación (quién / cuándo / motivo en historial).
              </p>

              {elimAuditLoading ? (
                <div className="no-results no-results--compact">
                  <p>Cargando…</p>
                </div>
              ) : (
                <>
                  {elimDetalleError ? (
                    <div className="no-results no-results--compact">
                      <p>{elimDetalleError}</p>
                    </div>
                  ) : (
                    <>
                      <div className="task-library-grid-outer">
                        <div
                          className="task-library-grid-scaler"
                          style={{
                            transform: `scale(${cardScale})`,
                            transformOrigin: 'top left',
                            width: `${100 / cardScale}%`
                          }}
                        >
                          <div className="task-library-grid">
                            {filteredEliminadasTasks.map((task, index) => {
                              const owner = teamMembers.find((m) => m.id === task.ownerId)
                              return (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  index={index}
                                  owner={owner}
                                  sectores={sectores}
                                  isDraggable={false}
                                  readOnly
                                  onInspectReadOnly={openLibraryDetail}
                                />
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      {filteredEliminadasTasks.length === 0 && (
                        <div className="no-results no-results--compact">
                          <p>No hay fichas eliminadas con estos filtros.</p>
                        </div>
                      )}
                    </>
                  )}

                  <h3 className="task-library-deleted-audit-heading">Auditoría de eliminación</h3>
                  {elimAuditError ? (
                    <div className="no-results no-results--compact">
                      <p>{elimAuditError}</p>
                    </div>
                  ) : (
                    <div className="task-library-deleted-table-wrapper task-library-deleted-table-wrapper--compact">
                      <table className="task-library-deleted-table task-library-deleted-table--compact">
                        <thead>
                          <tr>
                            <th className="deleted-col-fecha">Fecha</th>
                            <th className="deleted-col-op">Nº OP</th>
                            <th className="deleted-col-cliente">Cliente</th>
                            <th className="deleted-col-motivo">Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDeletedOps.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="deleted-cell-empty">
                                No hay filas de auditoría con estos filtros.
                              </td>
                            </tr>
                          ) : (
                            deletedTableRows(filteredDeletedOps)
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    {libraryDetailTask && (
      <TaskViewModal
        task={libraryDetailTask}
        teamMembers={teamMembers}
        sectores={sectores}
        exhaustiveDetail
        onClose={() => setLibraryDetailTask(null)}
      />
    )}
    </Fragment>
  )
}

export default TaskLibraryModal
