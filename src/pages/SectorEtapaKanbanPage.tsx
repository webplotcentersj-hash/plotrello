import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Task } from '../types/board'
import type { SectorRecord } from '../types/api'
import EtapaKanbanBoard from '../components/EtapaKanbanBoard'
import {
  SIN_ETAPA_COLUMN_ID,
  filterTasksForSectorEtapaKanban,
  getSectorEtapaKanbanBySlug,
  resolveEtapaColumnId,
  type SectorEtapaKanbanConfig
} from '../data/sectorEtapaKanban'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { ordenToTask, parseTaskIdToOrdenId } from '../utils/dataMappers'
import './SectorEtapaKanbanPage.css'

type Props = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  teamMembers: import('../types/board').TeamMember[]
  activity: import('../types/board').ActivityEvent[]
  sectores: SectorRecord[]
}

export default function SectorEtapaKanbanPage({
  tasks,
  setTasks,
  teamMembers,
  activity,
  sectores
}: Props) {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { usuario, isAdmin } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)

  const config = slug ? getSectorEtapaKanbanBySlug(slug) : null

  const columns = useMemo(() => {
    if (!config) return []
    return [
      {
        id: SIN_ETAPA_COLUMN_ID,
        label: 'Sin etapa',
        accent: '#64748b',
        description: 'Arrastrá una ficha a la derecha para asignar etapa'
      },
      ...config.etapas.map((e) => ({
        id: e.id,
        label: e.label,
        accent: e.accent,
        description: ''
      }))
    ]
  }, [config])

  const filtered = useMemo(() => {
    if (!config) return []
    return filterTasksForSectorEtapaKanban(tasks, config)
  }, [tasks, config])

  const groupedByColumnId = useMemo(() => {
    const g: Record<string, Task[]> = {}
    for (const c of columns) g[c.id] = []
    if (!config) return g
    for (const t of filtered) {
      const col = resolveEtapaColumnId(t, config)
      g[col].push(t)
    }
    return g
  }, [filtered, columns, config])

  const activityScoped = useMemo(() => {
    const ids = new Set(filtered.map((t) => t.id))
    return activity.filter((a) => ids.has(a.taskId))
  }, [filtered, activity])

  const nombreUsuario = usuario?.nombre?.trim() || 'Usuario'

  const persistEtapa = useCallback(
    async (cfg: SectorEtapaKanbanConfig, ordenId: number, nuevaEtapa: string) => {
      switch (cfg.slug) {
        case 'taller-grafico': {
          const r = await apiService.actualizarEtapaTallerGrafico(ordenId, nuevaEtapa, nombreUsuario)
          if (!r.success || !r.data) return { ok: false as const, error: r.error ?? 'Error' }
          return { ok: true as const, task: ordenToTask(r.data) }
        }
        case 'instalaciones': {
          const r = await apiService.actualizarEtapaInstalaciones(ordenId, nuevaEtapa, nombreUsuario)
          if (!r.success || !r.data) return { ok: false as const, error: r.error ?? 'Error' }
          return { ok: true as const, task: ordenToTask(r.data) }
        }
        case 'taller-imprenta': {
          const r = await apiService.actualizarEtapaTallerImprenta(ordenId, nuevaEtapa, nombreUsuario)
          if (!r.success || !r.data) return { ok: false as const, error: r.error ?? 'Error' }
          return { ok: true as const, task: ordenToTask(r.data) }
        }
        case 'metalurgica': {
          const r = await apiService.actualizarEtapaMetalurgica(ordenId, nuevaEtapa, nombreUsuario)
          if (!r.success || !r.data) return { ok: false as const, error: r.error ?? 'Error' }
          return { ok: true as const, task: ordenToTask(r.data) }
        }
        case 'imprenta': {
          const r = await apiService.actualizarEtapaImpresionDigital(ordenId, nuevaEtapa, nombreUsuario)
          if (!r.success || !r.data) return { ok: false as const, error: r.error ?? 'Error' }
          const row = r.data
          return {
            ok: true as const,
            patch: {
              id: String(ordenId),
              etapaImpresionDigital: row.etapa_impresion_digital,
              etapaImpresionDigitalFechaInicio: row.etapa_impresion_digital_fecha_inicio
            }
          }
        }
        default:
          return { ok: false as const, error: 'Sector no soportado' }
      }
    },
    [nombreUsuario]
  )

  const handleEtapaMove = useCallback(
    async (taskId: string, destinationColumnId: string) => {
      if (!config) return
      const ordenId = parseTaskIdToOrdenId(taskId)
      if (!ordenId) {
        setError('No se pudo obtener el id de la orden')
        return
      }
      const movingTask = tasks.find((t) => t.id === taskId)
      if (movingTask?.opBloqueada && !isAdmin) {
        setError(
          'Esta OP está trabada: no se puede cambiar la etapa hasta que el operario asignado la destabe (administración/gerencia puede hacerlo).'
        )
        return
      }
      setError(null)
      setMoving(true)
      try {
        const result = await persistEtapa(config, ordenId, destinationColumnId)
        if (!result.ok) {
          setError(result.error)
          return
        }
        if ('task' in result && result.task) {
          const updated = result.task
          setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === updated.id)
            if (idx < 0) return prev
            const next = [...prev]
            next[idx] = updated
            return next
          })
        } else if ('patch' in result && result.patch) {
          const { id, etapaImpresionDigital, etapaImpresionDigitalFechaInicio } = result.patch
          setTasks((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    etapaImpresionDigital: etapaImpresionDigital ?? undefined,
                    etapaImpresionDigitalFechaInicio: etapaImpresionDigitalFechaInicio ?? undefined
                  }
                : t
            )
          )
        }
      } finally {
        setMoving(false)
      }
    },
    [config, persistEtapa, setTasks, tasks, isAdmin]
  )

  if (!config) {
    return (
      <div className="sector-etapa-kanban-page">
        <header className="sector-etapa-kanban-header">
          <button type="button" className="sector-etapa-back" onClick={() => navigate('/')}>
            ← Volver al tablero
          </button>
          <h1>Kanban por etapas</h1>
        </header>
        <p className="sector-etapa-error">
          {slug
            ? `No hay kanban de etapas para «${slug}». Usá un sector con etapas (Taller Gráfico, Instalaciones, etc.).`
            : 'Ruta no válida.'}
        </p>
      </div>
    )
  }

  return (
    <div className="sector-etapa-kanban-page">
      <header className="sector-etapa-kanban-header">
        <button type="button" className="sector-etapa-back" onClick={() => navigate('/')}>
          ← Volver al tablero
        </button>
        <div>
          <h1>Kanban · {config.sectorName}</h1>
          <p className="sector-etapa-sub">
            Mismas etapas que en la ficha; arrastrá para cambiar. Solo fichas en columna «{config.sectorName}» del tablero
            principal.
          </p>
        </div>
      </header>
      {error && (
        <div className="sector-etapa-banner sector-etapa-banner--error" role="alert">
          {error}
        </div>
      )}
      {moving && (
        <div className="sector-etapa-banner sector-etapa-banner--info">Guardando etapa…</div>
      )}
      <EtapaKanbanBoard
        columns={columns}
        groupedByColumnId={groupedByColumnId}
        members={teamMembers}
        activity={activityScoped}
        sectores={sectores}
        onEtapaMove={handleEtapaMove}
      />
      <p className="sector-etapa-footnote">
        {filtered.length} ficha{filtered.length === 1 ? '' : 's'} en este sector (no entregadas).
      </p>
    </div>
  )
}
