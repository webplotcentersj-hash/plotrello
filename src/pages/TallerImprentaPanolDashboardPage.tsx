import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Task } from '../types/board'
import apiService from '../services/api'
import { parseTaskIdToOrdenId } from '../utils/dataMappers'
import {
  PANOL_LETTERS,
  PANOL_ROWS,
  makePanolSlot,
  normalizePanolSlot,
  panolSlotLabel,
  type PanolSlot
} from '../utils/panolTallerImprenta'
import PanolSlotPicker from '../components/PanolSlotPicker'
import './TallerImprentaPanolDashboardPage.css'

type Props = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
}

function isEntregaTallerImprenta(task: Task): boolean {
  return task.status === 'finalizado-taller' && task.visibleEnTablero !== false && !task.ordenEliminada && !task.entregado
}

export default function TallerImprentaPanolDashboardPage({ tasks, setTasks }: Props) {
  const { canManageTallerImprenta, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterLetter, setFilterLetter] = useState<string | 'all'>('all')
  const [query, setQuery] = useState('')

  const canEdit = canManageTallerImprenta || isAdmin

  const entregas = useMemo(() => tasks.filter(isEntregaTallerImprenta), [tasks])

  const bySlot = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of entregas) {
      const slot = normalizePanolSlot(t.panolSlot)
      if (!slot) continue
      const list = map.get(slot) ?? []
      list.push(t)
      map.set(slot, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.opNumber.localeCompare(b.opNumber, 'es', { numeric: true }))
    }
    return map
  }, [entregas])

  const occupiedSlots = useMemo(() => new Set(bySlot.keys()), [bySlot])

  const sinUbicar = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entregas
      .filter((t) => !normalizePanolSlot(t.panolSlot))
      .filter((t) => {
        if (!q) return true
        return (
          t.opNumber.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.summary || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.opNumber.localeCompare(b.opNumber, 'es', { numeric: true }))
  }, [entregas, query])

  const selected = useMemo(
    () => (selectedId ? entregas.find((t) => t.id === selectedId) ?? null : null),
    [selectedId, entregas]
  )

  const letters = useMemo(
    () => (filterLetter === 'all' ? PANOL_LETTERS : PANOL_LETTERS.filter((L) => L === filterLetter)),
    [filterLetter]
  )

  const assignSlot = useCallback(
    async (task: Task, slot: PanolSlot | null) => {
      if (!canEdit) return
      const ordenId = parseTaskIdToOrdenId(task.id)
      if (!ordenId) {
        setError('No se pudo identificar la OP.')
        return
      }
      setError(null)
      const prev = task.panolSlot ?? null
      setTasks((list) =>
        list.map((t) => (t.id === task.id ? { ...t, panolSlot: slot } : t))
      )
      const res = await apiService.updateOrden(ordenId, { panol_slot: slot })
      if (!res.success) {
        setTasks((list) =>
          list.map((t) => (t.id === task.id ? { ...t, panolSlot: prev } : t))
        )
        setError(res.error || 'No se pudo guardar el casillero.')
      }
    },
    [canEdit, setTasks]
  )

  if (!canEdit) {
    return (
      <div className="ti-panol">
        <div className="ti-panol__denied">
          <p>No tenés acceso al pañol de Taller de Imprenta.</p>
          <button type="button" onClick={() => navigate('/')}>
            Volver al tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ti-panol">
      <header className="ti-panol__header">
        <div>
          <p className="ti-panol__eyebrow">Taller de Imprenta</p>
          <h1>Pañol · Entregas</h1>
          <p className="ti-panol__sub">
            Casilleros A–Z · 3 filas (arriba / medio / abajo) · {entregas.length} OP en entregas
          </p>
        </div>
        <div className="ti-panol__actions">
          <Link to="/" className="ti-panol__link">
            ← Tablero
          </Link>
        </div>
      </header>

      {error && (
        <div className="ti-panol__error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <section className="ti-panol__toolbar">
        <label>
          Buscar
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="OP o cliente…"
          />
        </label>
        <label>
          Letra
          <select value={filterLetter} onChange={(e) => setFilterLetter(e.target.value as string | 'all')}>
            <option value="all">A–Z</option>
            {PANOL_LETTERS.map((L) => (
              <option key={L} value={L}>
                {L}
              </option>
            ))}
          </select>
        </label>
        <div className="ti-panol__stats">
          <span>
            Ubicadas <strong>{entregas.length - sinUbicar.length}</strong>
          </span>
          <span>
            Sin ubicar <strong>{sinUbicar.length}</strong>
          </span>
        </div>
      </section>

      {selected && canEdit && (
        <section className="ti-panol__assign">
          <div>
            <strong>#{selected.opNumber}</strong> · {selected.title}
          </div>
          <PanolSlotPicker
            value={selected.panolSlot}
            occupiedSlots={occupiedSlots}
            onChange={(slot) => assignSlot(selected, slot)}
            label="Mover a casillero"
          />
        </section>
      )}

      <section className="ti-panol__rack" aria-label="Pañol A a Z">
        <div className="ti-panol__rack-scroll">
          {letters.map((letter) => (
            <div key={letter} className="ti-panol__bay">
              <div className="ti-panol__bay-letter">{letter}</div>
              {PANOL_ROWS.map((row) => {
                const slot = makePanolSlot(letter, row)
                const items = bySlot.get(slot) ?? []
                const q = query.trim().toLowerCase()
                const visible = q
                  ? items.filter(
                      (t) =>
                        t.opNumber.toLowerCase().includes(q) ||
                        t.title.toLowerCase().includes(q)
                    )
                  : items
                return (
                  <div
                    key={slot}
                    className={`ti-panol__cell${visible.length ? ' has-items' : ''}`}
                    data-slot={slot}
                    title={panolSlotLabel(slot)}
                  >
                    <div className="ti-panol__cell-meta">
                      <span>{slot}</span>
                      <span className="ti-panol__cell-row">
                        {row === 1 ? '↑' : row === 2 ? '·' : '↓'}
                      </span>
                    </div>
                    <div className="ti-panol__cell-body">
                      {visible.length === 0 ? (
                        <span className="ti-panol__empty">—</span>
                      ) : (
                        visible.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`ti-panol__op${selectedId === t.id ? ' is-selected' : ''}`}
                            onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                            title={`${t.title}\n${t.summary || ''}`}
                          >
                            <span className="ti-panol__op-num">#{t.opNumber}</span>
                            <span className="ti-panol__op-name">{t.title}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="ti-panol__unassigned">
        <h2>Sin ubicar ({sinUbicar.length})</h2>
        {sinUbicar.length === 0 ? (
          <p className="ti-panol__muted">Todas las entregas tienen casillero.</p>
        ) : (
          <ul>
            {sinUbicar.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={selectedId === t.id ? 'is-selected' : undefined}
                  onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                >
                  <strong>#{t.opNumber}</strong>
                  <span>{t.title}</span>
                </button>
                {canEdit && selectedId === t.id && (
                  <PanolSlotPicker
                    compact
                    value={t.panolSlot}
                    occupiedSlots={occupiedSlots}
                    onChange={(slot) => assignSlot(t, slot)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
