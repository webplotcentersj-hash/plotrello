import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import { useUsuariosDisplay } from '../hooks/useUsuariosDisplay'
import type { FichaHistorialItem } from '../types/api'
import type { Task } from '../types/board'

type HistorialFichasAsesorPanelProps = {
  tasks: Task[]
  onEditTask: (task: Task) => void
  onRefrescarTablero?: () => Promise<void>
}

const formatFecha = (iso: string | null) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

const HistorialFichasAsesorPanel = ({
  tasks,
  onEditTask,
  onRefrescarTablero
}: HistorialFichasAsesorPanelProps) => {
  useUsuariosDisplay()
  const navigate = useNavigate()
  const [rows, setRows] = useState<FichaHistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await apiService.getHistorialFichasAsesor()
    if (res.success && Array.isArray(res.data)) {
      setRows(res.data)
    } else {
      setRows([])
      setError(res.error || 'No se pudo cargar el historial')
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.numero_op.toLowerCase().includes(q) ||
        (r.numero_ficha_original || '').toLowerCase().includes(q) ||
        (r.cliente || '').toLowerCase().includes(q) ||
        (r.nombre_creador || '').toLowerCase().includes(q) ||
        (r.descripcion || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const handleRefrescar = async () => {
    setRefreshing(true)
    if (onRefrescarTablero) {
      await onRefrescarTablero()
    }
    await load()
  }

  const abrirDetalle = (numeroOp: string) => {
    navigate(`/op/${encodeURIComponent(numeroOp)}`)
  }

  const abrirEnFlujo = (id: number) => {
    const task = tasks.find((t) => t.id === String(id))
    if (task) {
      onEditTask(task)
    }
  }

  if (loading) {
    return (
      <div className="ap-historial ap-historial--loading">
        <p className="ap-historial-muted">Cargando historial de fichas…</p>
      </div>
    )
  }

  return (
    <div className="ap-historial">
      <div className="ap-historial-toolbar">
        <div className="ap-historial-intro">
          <h2 className="ap-historial-title">Historial de fichas</h2>
          <p className="ap-historial-muted">
            Fichas activas y órdenes que ya fueron convertidas a OP (tras aplicar el parche SQL con{' '}
            <code className="ap-historial-code">numero_ficha_original</code>).
          </p>
        </div>
        <div className="ap-historial-actions">
          <input
            type="search"
            className="ap-historial-search"
            placeholder="Buscar por número, cliente, creador…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar en historial"
          />
          <button
            type="button"
            className="asesor-p-btn asesor-p-btn-secondary"
            disabled={refreshing}
            onClick={() => void handleRefrescar()}
          >
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="asesor-presupuestos-toast asesor-presupuestos-toast--error" role="alert">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="ap-historial-empty">
          <p>
            {rows.length === 0
              ? 'No hay fichas en el historial. Creá una desde el Kanban o verificá la conexión con Supabase.'
              : 'No hay resultados para esa búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="ap-historial-table-wrap">
          <table className="ap-historial-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Número actual</th>
                <th>Número ficha</th>
                <th>Cliente</th>
                <th>Sector / estado</th>
                <th>Creada</th>
                <th>Creador</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const esActiva = r.es_ficha_no_op === true
                const taskLocal = tasks.find((t) => t.id === String(r.id))
                return (
                  <tr key={r.id}>
                    <td>
                      <span
                        className={`ap-historial-badge ${esActiva ? 'ap-historial-badge--activa' : 'ap-historial-badge--op'}`}
                      >
                        {esActiva ? 'Ficha' : 'Ya es OP'}
                      </span>
                    </td>
                    <td>
                      <span className="ap-historial-mono">{r.numero_op}</span>
                    </td>
                    <td>
                      <span className="ap-historial-mono">
                        {r.numero_ficha_original || (esActiva ? r.numero_op : '—')}
                      </span>
                    </td>
                    <td>{r.cliente || '—'}</td>
                    <td>
                      <span className="ap-historial-cell-sub">
                        {r.sector || '—'}
                        {r.estado ? ` · ${r.estado}` : ''}
                      </span>
                    </td>
                    <td>{formatFecha(r.fecha_creacion)}</td>
                    <td>{etiquetaUsuarioNombre(r.nombre_creador)}</td>
                    <td className="ap-historial-actions-cell">
                      <button
                        type="button"
                        className="ap-historial-linkbtn"
                        onClick={() => abrirDetalle(r.numero_op)}
                      >
                        Ver
                      </button>
                      {taskLocal && (
                        <button
                          type="button"
                          className="ap-historial-linkbtn"
                          onClick={() => abrirEnFlujo(r.id)}
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default HistorialFichasAsesorPanel
