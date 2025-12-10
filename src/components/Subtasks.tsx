import { useEffect, useState } from 'react'
import apiService from '../services/api'
import type { Subtask } from '../types/board'
import './Subtasks.css'

type SubtasksProps = {
  ordenId: number
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${secs.toString().padStart(2, '0')}s`
}

const Subtasks = ({ ordenId }: SubtasksProps) => {
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEstimate, setNewEstimate] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const fetchSubtasks = async () => {
    setLoading(true)
    const res = await apiService.getSubitems(ordenId)
    if (res.success && res.data) {
      setSubtasks(
        res.data.map((s) => ({
          id: s.id.toString(),
          ordenId: s.id_orden,
          title: s.titulo,
          done: s.done,
          estimatedMinutes: s.duracion_estimada_min ?? undefined,
          timeSpentSec: s.tiempo_invertido_seg ?? 0,
          startedAt: s.iniciado_en ?? undefined,
          completedAt: s.completado_en ?? undefined
        }))
      )
    } else {
      setError(res.error || 'No se pudieron cargar las subtareas')
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchSubtasks()
  }, [ordenId])

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    const res = await apiService.createSubitem({
      idOrden: ordenId,
      titulo: newTitle.trim(),
      duracionEstimadaMin: newEstimate
    })
    if (res.success && res.data) {
      const data = res.data
      setSubtasks((prev) => [
        ...prev,
        {
          id: data.id.toString(),
          ordenId,
          title: data.titulo,
          done: data.done,
          estimatedMinutes: data.duracion_estimada_min ?? undefined,
          timeSpentSec: data.tiempo_invertido_seg ?? 0,
          startedAt: data.iniciado_en ?? undefined,
          completedAt: data.completado_en ?? undefined
        }
      ])
      setNewTitle('')
      setNewEstimate(undefined)
    } else {
      setError(res.error || 'No se pudo crear la subtarea')
    }
  }

  const handleToggle = async (id: string, done: boolean) => {
    const sub = subtasks.find((s) => s.id === id)
    const startedAt = sub?.startedAt
    const res = await apiService.toggleSubitemDone(Number(id), done, startedAt)
    if (res.success) {
      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                done,
                startedAt: done ? undefined : s.startedAt,
                timeSpentSec: done && startedAt ? s.timeSpentSec + Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)) : s.timeSpentSec,
                completedAt: done ? new Date().toISOString() : undefined
              }
            : s
        )
      )
    } else {
      setError(res.error || 'No se pudo actualizar la subtarea')
    }
  }

  const handlePlay = async (id: string) => {
    const res = await apiService.startSubitemTimer(Number(id))
    if (res.success) {
      const now = new Date().toISOString()
      setSubtasks((prev) =>
        prev.map((s) => (s.id === id ? { ...s, startedAt: now } : s))
      )
    } else {
      setError(res.error || 'No se pudo iniciar el timer')
    }
  }

  const handlePause = async (id: string) => {
    const sub = subtasks.find((s) => s.id === id)
    const res = await apiService.stopSubitemTimer(Number(id), sub?.startedAt)
    if (res.success) {
      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                startedAt: undefined,
                timeSpentSec: s.timeSpentSec + (res.data?.timeAdded ?? 0)
              }
            : s
        )
      )
    } else {
      setError(res.error || 'No se pudo pausar el timer')
    }
  }

  const totalProgress =
    subtasks.length === 0
      ? 0
      : Math.round((subtasks.filter((s) => s.done).length / subtasks.length) * 100)

  return (
    <div className="subtasks">
      <div className="subtasks-header">
        <h5>Checklist</h5>
        <span className="subtasks-progress">{totalProgress}%</span>
      </div>

      {error && <div className="subtasks-error">{error}</div>}
      {loading && <div className="subtasks-loading">Cargando subtareas...</div>}

      <div className="subtasks-list">
        {subtasks.map((item) => {
          const running = !!item.startedAt && !item.done
          const runningDelta = running ? Math.max(0, Math.round((Date.now() - new Date(item.startedAt!).getTime()) / 1000)) : 0
          const totalSeconds = item.timeSpentSec + runningDelta
          return (
            <div key={item.id} className={`subtask ${item.done ? 'done' : ''}`}>
              <label>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => void handleToggle(item.id, e.target.checked)}
                />
                <span className="subtask-title">{item.title}</span>
              </label>
              <div className="subtask-meta">
                {item.estimatedMinutes && (
                  <span className="pill estimate">Est: {item.estimatedMinutes}m</span>
                )}
                <span className="pill time">⏱ {formatTime(totalSeconds)}</span>
                {!item.done && (
                  running ? (
                    <button className="pill action stop" onClick={() => void handlePause(item.id)}>
                      ⏸ Pausar
                    </button>
                  ) : (
                    <button className="pill action start" onClick={() => void handlePlay(item.id)}>
                      ▶ Iniciar
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
        {subtasks.length === 0 && !loading && (
          <div className="subtasks-empty">Sin subtareas. Agrega una para empezar.</div>
        )}
      </div>

      <div className="subtasks-add">
        <input
          type="text"
          placeholder="Nueva subtarea..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <input
          type="number"
          placeholder="min"
          value={newEstimate ?? ''}
          onChange={(e) => setNewEstimate(e.target.value ? Number(e.target.value) : undefined)}
          min={1}
        />
        <button onClick={() => void handleAdd()}>Agregar</button>
      </div>
    </div>
  )
}

export default Subtasks

