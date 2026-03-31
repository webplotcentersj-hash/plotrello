import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { ActivityEvent, Task, TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'
import EtapaKanbanBoard from '../components/EtapaKanbanBoard'
import apiService from '../services/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { ordenToTask, parseTaskIdToOrdenId } from '../utils/dataMappers'
import {
  SIN_ETAPA_COLUMN_ID,
  filterTasksForSectorEtapaKanban,
  getSectorEtapaKanbanBySlug,
  resolveEtapaColumnId
} from '../data/sectorEtapaKanban'
import './TallerGraficoDashboardPage.css'

type Props = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  teamMembers: TeamMember[]
  activity: ActivityEvent[]
  sectores: SectorRecord[]
}

const DEFAULT_BG = {
  kind: 'gradient' as const,
  value:
    'radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 55%), radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.18), transparent 55%), #020617'
}

function storageKeyForUserBg(userId?: number | string | null) {
  return `tg_dashboard_bg_v1:${userId ?? 'anon'}`
}

type BgPref =
  | { kind: 'gradient'; value: string }
  | { kind: 'image'; value: string }

export default function TallerGraficoDashboardPage({ tasks, setTasks, teamMembers, activity, sectores }: Props) {
  const { isAdmin, isTallerGrafico, usuario } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)

  const [bgPref, setBgPref] = useState<BgPref>(DEFAULT_BG)
  const [savingBg, setSavingBg] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)

  useEffect(() => {
    const key = storageKeyForUserBg(usuario?.id ?? null)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw) as BgPref
      if (!parsed || typeof parsed !== 'object') return
      if (parsed.kind === 'image' && typeof parsed.value === 'string' && parsed.value.trim()) {
        setBgPref({ kind: 'image', value: parsed.value })
      } else if (parsed.kind === 'gradient' && typeof parsed.value === 'string' && parsed.value.trim()) {
        setBgPref({ kind: 'gradient', value: parsed.value })
      }
    } catch {
      // ignore
    }
  }, [usuario?.id])

  const persistBg = useCallback(
    (next: BgPref) => {
      setBgPref(next)
      const key = storageKeyForUserBg(usuario?.id ?? null)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // ignore
      }
    },
    [usuario?.id]
  )

  const kanbanConfig = useMemo(() => getSectorEtapaKanbanBySlug('taller-grafico'), [])

  const filtered = useMemo(() => {
    if (!kanbanConfig) return []
    return filterTasksForSectorEtapaKanban(tasks, kanbanConfig)
  }, [tasks, kanbanConfig])

  const columns = useMemo(() => {
    if (!kanbanConfig) return []
    return [
      {
        id: SIN_ETAPA_COLUMN_ID,
        label: 'Sin etapa',
        accent: '#64748b',
        description: 'Arrastrá a la derecha para asignar etapa'
      },
      ...kanbanConfig.etapas.map((e) => ({
        id: e.id,
        label: e.label,
        accent: e.accent,
        description: ''
      }))
    ]
  }, [kanbanConfig])

  const groupedByColumnId = useMemo(() => {
    const g: Record<string, Task[]> = {}
    for (const c of columns) g[c.id] = []
    if (!kanbanConfig) return g
    for (const t of filtered) {
      const col = resolveEtapaColumnId(t, kanbanConfig)
      g[col].push(t)
    }
    return g
  }, [filtered, columns, kanbanConfig])

  const activityScoped = useMemo(() => {
    const ids = new Set(filtered.map((t) => t.id))
    return activity.filter((a) => ids.has(a.taskId))
  }, [filtered, activity])

  const nombreUsuario = usuario?.nombre?.trim() || 'Usuario'

  const handleEtapaMove = useCallback(
    async (taskId: string, destinationColumnId: string) => {
      if (!kanbanConfig) return
      const ordenId = parseTaskIdToOrdenId(taskId)
      if (!ordenId) {
        setError('No se pudo obtener el id de la orden')
        return
      }
      setError(null)
      setMoving(true)
      try {
        const r = await apiService.actualizarEtapaTallerGrafico(ordenId, destinationColumnId, nombreUsuario)
        if (!r.success || !r.data) {
          setError(r.error ?? 'Error al guardar etapa')
          return
        }
        const updated = ordenToTask(r.data)
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === updated.id)
          if (idx < 0) return prev
          const next = [...prev]
          next[idx] = updated
          return next
        })
      } finally {
        setMoving(false)
      }
    },
    [kanbanConfig, nombreUsuario, setTasks]
  )

  const pageBgStyle = useMemo(() => {
    if (bgPref.kind === 'image') {
      return {
        backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.78), rgba(2, 6, 23, 0.78)), url(${bgPref.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } as const
    }
    return { background: bgPref.value } as const
  }, [bgPref])

  const onPickBgFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setBgError(null)
      setSavingBg(true)
      try {
        const url = await uploadAttachmentAndGetUrl(file, 'tg-backgrounds')
        persistBg({ kind: 'image', value: url })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo subir la imagen'
        setBgError(msg)
      } finally {
        setSavingBg(false)
      }
    },
    [persistBg]
  )

  const canAccess = isAdmin || isTallerGrafico

  if (!canAccess) {
    return (
      <div className="tg-dashboard-page tg-dashboard-denied">
        <div className="tg-dashboard-card">
          <h1>Acceso restringido</h1>
          <p>Este dashboard es para Taller Gráfico / administración.</p>
          <button type="button" onClick={() => navigate('/')}>← Volver al tablero</button>
        </div>
      </div>
    )
  }

  return (
    <div className="tg-dashboard-page" style={pageBgStyle}>
      <header className="tg-dashboard-header">
        <div>
          <h1>Kanban · Taller Gráfico</h1>
          <p>
            Etapas internas del sector (no cambia la columna del tablero general). {filtered.length} ficha
            {filtered.length === 1 ? '' : 's'} activas.
          </p>
        </div>
        <div className="tg-dashboard-actions">
          <label className="tg-bg-upload-btn">
            {savingBg ? 'Subiendo…' : '🖼️ Cambiar fondo'}
            <input
              type="file"
              accept="image/*"
              disabled={savingBg}
              onChange={(e) => void onPickBgFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
          </label>
          <button
            type="button"
            className="tg-bg-reset-btn"
            onClick={() => {
              setBgError(null)
              persistBg(DEFAULT_BG)
            }}
          >
            Reset fondo
          </button>
          <button type="button" className="tg-back-button" onClick={() => navigate('/')}>
            ← Volver al tablero
          </button>
        </div>
      </header>

      {(bgError || error) && (
        <div className="tg-dashboard-error" role="alert">
          {bgError ?? error}
        </div>
      )}
      {moving && <div className="tg-dashboard-info">Guardando etapa…</div>}

      <EtapaKanbanBoard
        columns={columns}
        groupedByColumnId={groupedByColumnId}
        members={teamMembers}
        activity={activityScoped}
        sectores={sectores}
        onEtapaMove={handleEtapaMove}
      />
    </div>
  )
}
