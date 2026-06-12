import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import type { Task, TaskStatus, Priority, TeamMember } from '../types/board'
import type { MaterialRecord, SectorRecord } from '../types/api'
import TaskCard from './TaskCard'
import { exportToCSV, exportToPDF } from '../utils/exportUtils'
import apiService from '../services/api'
import { ordenToTask, parseTaskIdToOrdenId } from '../utils/dataMappers'
import {
  readOrdenesBibliotecaCache,
  writeOrdenesBibliotecaCache
} from '../utils/ordenesBibliotecaCache'
import TaskViewModal from './TaskViewModal'
import TaskEditModal from './TaskEditModal'
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
  const qTrim = q.trim()
  // Atajo: "#123" busca por ID de BD exacto
  const mHash = qTrim.match(/^#(\d+)$/)
  if (mHash) {
    const qId = mHash[1]
    const oid = parseTaskIdToOrdenId(task.id)
    return oid != null && String(oid) === qId
  }
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

/** Fichas visibles en grilla por tanda (evita 2000 nodos DOM de golpe). */
const LIBRARY_GRID_BATCH = 120
const LIBRARY_SERVER_SEARCH_MIN = 2
const LIBRARY_SERVER_SEARCH_LIMIT = 50
const LIBRARY_SERVER_SEARCH_DEBOUNCE_MS = 320

type TaskLibraryModalProps = {
  tasks: Task[]
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  columns: ReadonlyArray<{ id: TaskStatus; label: string; accent: string }>
  /** Si se pasa, no se vuelve a pedir a la API (p. ej. tests). Omitir en producción para cargar siempre al abrir. */
  deletedOpsRows?: DeletedOpRow[]
  onClose: () => void
  /** Misma persistencia que el tablero (Supabase); obligatorio en producción para que Editar guarde. */
  onPersistLibraryEdit?: (updatedTask: Task) => void | Promise<void>
  /** Restaura visible_en_tablero y, si aplica, quita borrado lógico para que la OP vuelva al tablero. */
  onRestartOrdenEnTablero?: (task: Task) => void | Promise<void>
}

const TaskLibraryModal = ({
  tasks,
  teamMembers,
  sectores,
  columns,
  deletedOpsRows,
  onClose,
  onPersistLibraryEdit,
  onRestartOrdenEnTablero
}: TaskLibraryModalProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [idBdQuery, setIdBdQuery] = useState('')
  const [selectedTableroEstado, setSelectedTableroEstado] = useState<
    'todos' | 'visibles' | 'ocultas' | 'entregadas' | 'eliminadas'
  >('todos')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'idBd'>('updatedAt')
  const [selectedSector, setSelectedSector] = useState<string>('todos')
  const [selectedOperario, setSelectedOperario] = useState<string>('todos')
  const [selectedEstado, setSelectedEstado] = useState<string>('todos')
  const [selectedPrioridad, setSelectedPrioridad] = useState<Priority | 'todas'>('todas')
  const [selectedComplejidad, setSelectedComplejidad] = useState<string>('todas')
  const [selectedReclamo, setSelectedReclamo] = useState<'todos' | 'solo' | 'sin'>('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [viewMode, setViewMode] = useState<'activas' | 'eliminadas'>('activas')
  const [elimAuditRows, setElimAuditRows] = useState<DeletedOpRow[]>([])
  const [eliminadasTasks, setEliminadasTasks] = useState<Task[]>([])
  const [elimAuditLoading, setElimAuditLoading] = useState(() => deletedOpsRows === undefined)
  const [elimAuditError, setElimAuditError] = useState<string | null>(null)
  const [elimDetalleError, setElimDetalleError] = useState<string | null>(null)
  /** Escala visual de las fichas (solo biblioteca; no modifica datos). */
  const [cardScale, setCardScale] = useState(1)
  const [libraryDetailTask, setLibraryDetailTask] = useState<Task | null>(null)
  const [libraryEditTask, setLibraryEditTask] = useState<Task | null>(null)
  const [pinnedTaskIds, setPinnedTaskIds] = useState<Set<string>>(() => new Set())
  const [materiales, setMateriales] = useState<MaterialRecord[]>([])
  /** null = solo las OP ya cargadas en el tablero (~800); tras “catálogo completo” incluye todas. */
  const [catalogTasks, setCatalogTasks] = useState<Task[] | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogProgress, setCatalogProgress] = useState<{ loaded: number; total: number | null } | null>(
    null
  )
  const [dbTotalCount, setDbTotalCount] = useState<number | null>(null)
  const [serverSearchTasks, setServerSearchTasks] = useState<Task[] | null>(null)
  const [serverSearchLoading, setServerSearchLoading] = useState(false)
  const [serverSearchTruncated, setServerSearchTruncated] = useState(false)
  const [serverSearchError, setServerSearchError] = useState<string | null>(null)
  const [gridVisibleCount, setGridVisibleCount] = useState(LIBRARY_GRID_BATCH)

  const libraryTasks = catalogTasks ?? tasks

  const serverSearchActive =
    searchQuery.trim().length >= LIBRARY_SERVER_SEARCH_MIN || idBdQuery.trim() !== ''

  useEffect(() => {
    let cancelled = false
    void apiService.getOrdenesBibliotecaCount().then((res) => {
      if (!cancelled && res.success && res.data != null) setDbTotalCount(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!serverSearchActive) {
      setServerSearchTasks(null)
      setServerSearchLoading(false)
      setServerSearchTruncated(false)
      setServerSearchError(null)
      return
    }

    setServerSearchLoading(true)
    setServerSearchError(null)
    const t = window.setTimeout(() => {
      const idBdRaw = idBdQuery.trim()
      const idBd = idBdRaw !== '' ? Number(idBdRaw) : undefined
      void apiService
        .searchOrdenesBiblioteca(searchQuery.trim(), {
          idBd: idBd != null && Number.isFinite(idBd) ? idBd : undefined
        })
        .then((res) => {
          setServerSearchLoading(false)
          if (!res.success) {
            setServerSearchTasks(null)
            setServerSearchTruncated(false)
            setServerSearchError(res.error || 'No se pudo buscar en la base.')
            return
          }
          const rows = res.data ?? []
          setServerSearchTasks(rows.map((o) => ordenToTask(o)))
          setServerSearchTruncated(rows.length >= LIBRARY_SERVER_SEARCH_LIMIT)
          setServerSearchError(null)
        })
    }, LIBRARY_SERVER_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(t)
  }, [searchQuery, idBdQuery, serverSearchActive])

  const openLibraryDetail = useCallback((t: Task) => {
    setLibraryDetailTask(t)
  }, [])

  const pinTaskId = useCallback((taskId: string) => {
    setPinnedTaskIds((prev) => {
      const next = new Set(prev)
      next.add(taskId)
      return next
    })
  }, [])

  const unpinTaskId = useCallback((taskId: string) => {
    setPinnedTaskIds((prev) => {
      if (!prev.has(taskId)) return prev
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }, [])

  const requestEditFromLibrary = useCallback(
    async (t: Task) => {
      pinTaskId(t.id)
      setLibraryEditTask(t)
      if (materiales.length === 0) {
        const r = await apiService.getMateriales()
        if (r.success && r.data) setMateriales(r.data)
      }
    },
    [materiales.length, pinTaskId]
  )

  const refreshLibraryDetailFromServer = useCallback(async (taskId: string) => {
    const ordenId = parseTaskIdToOrdenId(taskId)
    if (!ordenId) return
    const r = await apiService.getOrden(ordenId)
    if (r.success && r.data) {
      setLibraryDetailTask(ordenToTask(r.data))
    }
  }, [])

  const handleRestartFromLibrary = useCallback(
    async (t: Task) => {
      if (!onRestartOrdenEnTablero) return
      await onRestartOrdenEnTablero(t)
      await refreshLibraryDetailFromServer(t.id)
      setEliminadasTasks((prev) => prev.filter((x) => x.id !== t.id))
    },
    [onRestartOrdenEnTablero, refreshLibraryDetailFromServer]
  )

  const handleLibraryEditSave = useCallback(
    async (updatedTask: Task) => {
      if (onPersistLibraryEdit) {
        await onPersistLibraryEdit(updatedTask)
      }
      await refreshLibraryDetailFromServer(updatedTask.id)
      setLibraryEditTask(null)
      unpinTaskId(updatedTask.id)
    },
    [onPersistLibraryEdit, refreshLibraryDetailFromServer, unpinTaskId]
  )

  const counters = useMemo(() => {
    const all = libraryTasks.length
    const ocultas = libraryTasks.filter((t) => t.visibleEnTablero === false).length
    const eliminadas = libraryTasks.filter((t) => t.ordenEliminada).length
    const entregadas = libraryTasks.filter((t) => t.entregado).length
    return { all, ocultas, eliminadas, entregadas }
  }, [libraryTasks])

  const tasksForFiltering = useMemo(() => {
    if (serverSearchActive && serverSearchTasks !== null) return serverSearchTasks
    return libraryTasks
  }, [libraryTasks, serverSearchActive, serverSearchTasks])

  const skipTextFilter =
    serverSearchActive && serverSearchTasks !== null && !serverSearchLoading

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const qId = idBdQuery.trim()
    const filtered = tasksForFiltering.filter((task) => {
      const matchesSearch = skipTextFilter ? true : matchesSearchQuery(task, q)
      const matchesIdBd =
        skipTextFilter ? true : qId === '' ? true : String(parseTaskIdToOrdenId(task.id) ?? task.id) === qId

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

      const matchesReclamo =
        selectedReclamo === 'todos'
          ? true
          : selectedReclamo === 'solo'
            ? task.enReclamo === true
            : task.enReclamo !== true

      const matchesTableroEstado = (() => {
        if (selectedTableroEstado === 'todos') return true
        if (selectedTableroEstado === 'visibles') return task.visibleEnTablero !== false && !task.ordenEliminada
        if (selectedTableroEstado === 'ocultas') return task.visibleEnTablero === false
        if (selectedTableroEstado === 'entregadas') return task.entregado === true
        if (selectedTableroEstado === 'eliminadas') return task.ordenEliminada === true
        return true
      })()

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
        matchesIdBd &&
        matchesSector &&
        matchesOperario &&
        matchesEstado &&
        matchesPrioridad &&
        matchesComplejidad &&
        matchesReclamo &&
        matchesTableroEstado &&
        matchesFecha
      )
    })

    // Evita “saltos/desapariciones” mientras la OP está abierta o editándose desde Biblioteca:
    // si está pinneada, la incluimos aunque ya no cumpla filtros (por cambios propios o realtime).
    if (pinnedTaskIds.size > 0) {
      const existing = new Set(filtered.map((t) => t.id))
      for (const id of pinnedTaskIds) {
        if (existing.has(id)) continue
        const t = tasksForFiltering.find((x) => x.id === id) ?? libraryTasks.find((x) => x.id === id)
        if (t) filtered.push(t)
      }
    }

    const byId = (t: Task) => parseTaskIdToOrdenId(t.id) ?? Number(t.id) ?? 0
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'createdAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'idBd') return byId(b) - byId(a)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return sorted
  }, [
    tasksForFiltering,
    libraryTasks,
    searchQuery,
    idBdQuery,
    skipTextFilter,
    selectedTableroEstado,
    sortBy,
    selectedSector,
    selectedOperario,
    selectedEstado,
    selectedPrioridad,
    selectedComplejidad,
    selectedReclamo,
    fechaDesde,
    fechaHasta,
    columns,
    pinnedTaskIds
  ])

  const visibleFilteredTasks = useMemo(
    () => filteredTasks.slice(0, gridVisibleCount),
    [filteredTasks, gridVisibleCount]
  )

  const hasMoreGridRows = filteredTasks.length > visibleFilteredTasks.length

  useEffect(() => {
    setGridVisibleCount(LIBRARY_GRID_BATCH)
  }, [
    searchQuery,
    idBdQuery,
    selectedTableroEstado,
    sortBy,
    selectedSector,
    selectedOperario,
    selectedEstado,
    selectedPrioridad,
    selectedComplejidad,
    selectedReclamo,
    fechaDesde,
    fechaHasta,
    viewMode,
    catalogTasks,
    serverSearchTasks
  ])

  const handleRefreshCatalog = useCallback(async () => {
    setCatalogError(null)
    const cached = readOrdenesBibliotecaCache()
    if (cached?.length) {
      setCatalogTasks(cached.map((o) => ordenToTask(o)))
    }
    setCatalogLoading(true)
    setCatalogProgress({ loaded: cached?.length ?? 0, total: dbTotalCount })
    try {
      const resp = await apiService.getOrdenesBibliotecaCatalogo({
        onProgress: (loaded, total) => setCatalogProgress({ loaded, total })
      })
      if (resp.success && resp.data) {
        writeOrdenesBibliotecaCache(resp.data)
        setCatalogTasks(resp.data.map((o) => ordenToTask(o)))
        setCatalogError(null)
      } else if (!cached?.length) {
        setCatalogError(resp.error || 'No se pudo cargar el catálogo completo.')
      } else {
        setCatalogError(
          resp.error
            ? `${resp.error} (se muestra la copia en caché de ${cached.length} OP.)`
            : null
        )
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar catálogo'
      if (!cached?.length) setCatalogError(msg)
      else setCatalogError(`${msg} (se muestra la copia en caché.)`)
    } finally {
      setCatalogLoading(false)
      setCatalogProgress(null)
    }
  }, [dbTotalCount])

  const filteredEliminadasTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const qId = idBdQuery.trim()
    return eliminadasTasks.filter((task) => {
      const matchesSearch = matchesSearchQuery(task, q)
      const matchesIdBd =
        qId === '' ? true : String(parseTaskIdToOrdenId(task.id) ?? task.id) === qId
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

      const matchesReclamo =
        selectedReclamo === 'todos'
          ? true
          : selectedReclamo === 'solo'
            ? task.enReclamo === true
            : task.enReclamo !== true

      const matchesTableroEstado = (() => {
        if (selectedTableroEstado === 'todos') return true
        if (selectedTableroEstado === 'visibles') return task.visibleEnTablero !== false && !task.ordenEliminada
        if (selectedTableroEstado === 'ocultas') return task.visibleEnTablero === false
        if (selectedTableroEstado === 'entregadas') return task.entregado === true
        if (selectedTableroEstado === 'eliminadas') return task.ordenEliminada === true
        return true
      })()

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
        matchesIdBd &&
        matchesSector &&
        matchesOperario &&
        matchesEstado &&
        matchesPrioridad &&
        matchesComplejidad &&
        matchesReclamo &&
        matchesTableroEstado &&
        matchesFecha
      )
    })
  }, [
    eliminadasTasks,
    searchQuery,
    idBdQuery,
    selectedTableroEstado,
    selectedSector,
    selectedOperario,
    selectedEstado,
    selectedPrioridad,
    selectedComplejidad,
    selectedReclamo,
    fechaDesde,
    fechaHasta,
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
    setIdBdQuery('')
    setSelectedTableroEstado('todos')
    setSortBy('updatedAt')
    setSelectedSector('todos')
    setSelectedOperario('todos')
    setSelectedEstado('todos')
    setSelectedPrioridad('todas')
    setSelectedComplejidad('todas')
    setSelectedReclamo('todos')
    setFechaDesde('')
    setFechaHasta('')
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
              Búsqueda en toda la base (2+ caracteres) sin descargar todo; catálogo completo opcional. Desde el detalle
              podés editar y guardar como en el tablero.
              {dbTotalCount != null ? ` · ${dbTotalCount.toLocaleString('es-AR')} OP en base` : ''}
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
                placeholder="N° OP, cliente, #id… (busca en toda la base desde 2 caracteres)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {serverSearchLoading && (
                <span className="task-library-server-search-hint">Buscando en toda la base…</span>
              )}
              {!serverSearchLoading && serverSearchError && (
                <span className="task-library-server-search-hint task-library-server-search-hint--error" role="alert">
                  {serverSearchError}
                </span>
              )}
              {!serverSearchLoading && !serverSearchError && serverSearchActive && serverSearchTasks !== null && (
                <span className="task-library-server-search-hint">
                  {serverSearchTasks.length === 0
                    ? 'Sin coincidencias en la base.'
                    : serverSearchTruncated
                      ? `${serverSearchTasks.length} coincidencias (mostrando las más recientes; refiná la búsqueda).`
                      : `${serverSearchTasks.length} coincidencia${serverSearchTasks.length === 1 ? '' : 's'} en la base.`}
                </span>
              )}
            </div>
            <div className="filter-field" style={{ maxWidth: 220 }}>
              <label>ID BD</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Ej. 1234"
                value={idBdQuery}
                onChange={(e) => setIdBdQuery(e.target.value)}
              />
            </div>
            <div className="filter-field" style={{ maxWidth: 280 }}>
              <label>Estado tablero</label>
              <select
                value={selectedTableroEstado}
                onChange={(e) =>
                  setSelectedTableroEstado(
                    e.target.value as 'todos' | 'visibles' | 'ocultas' | 'entregadas' | 'eliminadas'
                  )
                }
              >
                <option value="todos">Todos</option>
                <option value="visibles">Visibles en tablero</option>
                <option value="ocultas">Ocultas en tablero</option>
                <option value="entregadas">Entregadas / archivadas</option>
                <option value="eliminadas">Eliminadas</option>
              </select>
            </div>
            <div className="filter-field" style={{ maxWidth: 220 }}>
              <label>Orden</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="updatedAt">Último movimiento</option>
                <option value="createdAt">Fecha creación</option>
                <option value="idBd">ID BD</option>
              </select>
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

            <div className="filter-field">
              <label>Reclamos</label>
              <select
                value={selectedReclamo}
                onChange={(e) => setSelectedReclamo(e.target.value as typeof selectedReclamo)}
              >
                <option value="todos">Todos</option>
                <option value="solo">Solo reclamos</option>
                <option value="sin">Sin reclamos</option>
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

          </div>

          <div className="filter-actions">
            <button type="button" className="btn-limpiar" onClick={handleLimpiar}>
              Limpiar filtros
            </button>
            <button
              type="button"
              className="btn-limpiar btn-catalogo-completo"
              onClick={() => void handleRefreshCatalog()}
              disabled={catalogLoading}
              title="Descarga todas las OP en páginas livianas (sin m²), sin tope artificial. No afecta la carga del tablero."
            >
              {catalogLoading
                ? catalogProgress != null
                  ? catalogProgress.total != null
                    ? `Cargando catálogo… ${catalogProgress.loaded.toLocaleString('es-AR')} / ${catalogProgress.total.toLocaleString('es-AR')}`
                    : `Cargando catálogo… ${catalogProgress.loaded.toLocaleString('es-AR')}`
                  : 'Cargando catálogo…'
                : dbTotalCount != null
                  ? `Actualizar catálogo completo (${dbTotalCount.toLocaleString('es-AR')} OP)`
                  : 'Actualizar catálogo completo'}
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
              <span className="results-count" title="Totales globales (sin filtros)">
                Total cargado: {counters.all}
                {catalogTasks == null
                  ? ` (tablero ~${tasks.length}${dbTotalCount != null ? ` de ${dbTotalCount.toLocaleString('es-AR')}` : ''})`
                  : ' (catálogo completo)'}
                {serverSearchActive && serverSearchTasks !== null ? ' · búsqueda en servidor' : ''} · Ocultas:{' '}
                {counters.ocultas} · Entregadas: {counters.entregadas} · Eliminadas: {counters.eliminadas}
              </span>
              {catalogError ? (
                <span className="task-library-catalog-error" role="alert">
                  {catalogError}
                </span>
              ) : null}
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
                    {visibleFilteredTasks.map((task, index) => {
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

              {hasMoreGridRows && (
                <div className="task-library-load-more">
                  <p>
                    Mostrando {visibleFilteredTasks.length} de {filteredTasks.length} fichas filtradas.
                  </p>
                  <button
                    type="button"
                    className="btn-limpiar"
                    onClick={() =>
                      setGridVisibleCount((n) =>
                        Math.min(n + LIBRARY_GRID_BATCH, filteredTasks.length)
                      )
                    }
                  >
                    Mostrar más fichas (
                    {Math.min(LIBRARY_GRID_BATCH, filteredTasks.length - visibleFilteredTasks.length)})
                  </button>
                  <button
                    type="button"
                    className="btn-limpiar btn-catalogo-completo"
                    onClick={() => setGridVisibleCount(filteredTasks.length)}
                  >
                    Mostrar todas ({filteredTasks.length})
                  </button>
                </div>
              )}

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
        allowEdit
        onRequestEdit={(t) => requestEditFromLibrary(t)}
        onRestartEnTablero={
          onRestartOrdenEnTablero &&
          (libraryDetailTask.visibleEnTablero === false ||
            libraryDetailTask.ordenEliminada ||
            libraryDetailTask.entregado === true)
            ? () => handleRestartFromLibrary(libraryDetailTask)
            : undefined
        }
        onClose={() => setLibraryDetailTask(null)}
      />
    )}
    {libraryEditTask && (
      <TaskEditModal
        task={libraryEditTask}
        teamMembers={teamMembers}
        sectores={sectores}
        materiales={materiales}
        activity={[]}
        onClose={() => {
          if (libraryEditTask) unpinTaskId(libraryEditTask.id)
          setLibraryEditTask(null)
        }}
        onSave={handleLibraryEditSave}
      />
    )}
    </Fragment>
  )
}

export default TaskLibraryModal
