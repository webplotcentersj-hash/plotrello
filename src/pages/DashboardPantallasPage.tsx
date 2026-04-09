import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import { ordenToTask } from '../utils/dataMappers'
import type { Task } from '../types/board'
import type { OrdenTrabajo } from '../types/api'
import { BOARD_COLUMNS } from '../data/mockData'
import './DashboardPantallasPage.css'

/** OP creada en las últimas N horas se marca como "nueva" en el tablero */
const NUEVA_OP_MAX_MS = 12 * 60 * 60 * 1000
/** Refuerzo visual si entró por tiempo real hace poco */
const NUEVA_EN_VIVO_MS = 6 * 60 * 1000

const VIEW_SCALE_STORAGE_KEY = 'dashboard-pantallas-view-scale'
const VIEW_SCALE_MIN = 0.5
const VIEW_SCALE_MAX = 1.5
const VIEW_SCALE_STEP = 0.1

function readStoredViewScale(): number {
  try {
    const raw = localStorage.getItem(VIEW_SCALE_STORAGE_KEY)
    if (raw == null) return 1
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) return 1
    const rounded = Math.round(n * 100) / 100
    return Math.min(VIEW_SCALE_MAX, Math.max(VIEW_SCALE_MIN, rounded))
  } catch {
    return 1
  }
}

function isOrdenNuevaPorFecha(createdAt: string): boolean {
  const t = new Date(createdAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < NUEVA_OP_MAX_MS
}

/** Jornada visible en la barra (hora local del dispositivo / pantalla) */
const JORNADA_INICIO_H = 8
const JORNADA_FIN_H = 19

function getFullscreenElement(): Element | null {
  try {
    const d = document as Document & { webkitFullscreenElement?: Element | null }
    return document.fullscreenElement ?? d.webkitFullscreenElement ?? null
  } catch {
    return null
  }
}

/** Varios navegadores de TV no implementan matchMedia o lanzan al evaluar. */
function safeMediaMatches(query: string, fallback = false): boolean {
  try {
    if (typeof window.matchMedia !== 'function') return fallback
    const m = window.matchMedia(query)
    return Boolean(m && m.matches)
  } catch {
    return fallback
  }
}

function awaitMaybePromise(p: unknown): Promise<void> {
  if (p != null && typeof (p as PromiseLike<void>).then === 'function') {
    return Promise.resolve(p as Promise<void>)
  }
  return Promise.resolve()
}

/** true si entró en fullscreen nativo; false si no hay API o falló (sin lanzar). */
async function requestElementFullscreen(el: HTMLElement): Promise<boolean> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void
    msRequestFullscreen?: () => void
  }
  try {
    if (typeof el.requestFullscreen === 'function') {
      await awaitMaybePromise(el.requestFullscreen())
      return true
    }
    if (typeof anyEl.webkitRequestFullscreen === 'function') {
      anyEl.webkitRequestFullscreen()
      return true
    }
    if (typeof anyEl.msRequestFullscreen === 'function') {
      anyEl.msRequestFullscreen()
      return true
    }
  } catch {
    return false
  }
  return false
}

async function exitDocumentFullscreen(): Promise<void> {
  try {
    const d = document as Document & {
      webkitExitFullscreen?: () => void
      msExitFullscreen?: () => void
    }
    if (typeof document.exitFullscreen === 'function') {
      await awaitMaybePromise(document.exitFullscreen())
      return
    }
    if (typeof d.webkitExitFullscreen === 'function') {
      d.webkitExitFullscreen()
      return
    }
    if (typeof d.msExitFullscreen === 'function') {
      d.msExitFullscreen()
    }
  } catch {
    /* TV / WebViews a veces lanzan aunque no haya fullscreen */
  }
}

function getJornadaLaboral(now: Date): {
  pct: number
  phase: 'antes' | 'durante' | 'despues'
  labelCorta: string
} {
  const totalMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const startMin = JORNADA_INICIO_H * 60
  const endMin = JORNADA_FIN_H * 60
  const span = endMin - startMin

  if (totalMin <= startMin) {
    return {
      pct: 0,
      phase: 'antes',
      labelCorta: `Comienza 8:00`
    }
  }
  if (totalMin >= endMin) {
    return {
      pct: 100,
      phase: 'despues',
      labelCorta: `Finalizada 19:00`
    }
  }
  const pct = ((totalMin - startMin) / span) * 100
  return {
    pct,
    phase: 'durante',
    labelCorta: now.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }
}

const DashboardPantallasPage = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [now, setNow] = useState(() => new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  /** Si el API fullscreen no existe en la TV, mismo efecto visual con position:fixed */
  const [immersiveLayout, setImmersiveLayout] = useState(false)
  const [viewScale, setViewScale] = useState(readStoredViewScale)
  /** id de tarea → timestamp de llegada por INSERT realtime */
  const [llegadaEnVivo, setLlegadaEnVivo] = useState<Record<string, number>>({})

  /** Contenedor que recorta el tablero (sin scroll nativo: en TV/WebKit falla bajo `transform: scale`) */
  const boardViewportRef = useRef<HTMLDivElement | null>(null)
  const columnsTrackRef = useRef<HTMLDivElement | null>(null)
  /** Par viewport (clip) + track (cards) por columna */
  const columnPanElsRef = useRef<{ v: HTMLDivElement | null; t: HTMLDivElement | null }[]>([])
  const hPanRef = useRef(0)
  const hDirRef = useRef(1)
  const vPanRefs = useRef<number[]>([])
  /** Solo lo actualiza el loop RAF; si deja de avanzar, el setInterval hace el pan (TV / WebViews) */
  const lastRafAtRef = useRef(0)
  /** Contenedor de pantalla completa (no usar documentElement: rompe altura flex/#app) */
  const shellRef = useRef<HTMLDivElement | null>(null)
  const prevNativeFsRef = useRef(false)

  const setColumnPanSlot = useCallback((index: number) => {
    if (!columnPanElsRef.current[index]) {
      columnPanElsRef.current[index] = { v: null, t: null }
    }
    return columnPanElsRef.current[index]
  }, [])

  // Cargar tareas iniciales
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiService.getOrdenes()
        
        if (response.success && response.data) {
          const mappedTasks = response.data.map(ordenToTask)
          setTasks(mappedTasks)
          setLastUpdate(new Date())
        } else {
          setError(response.error || 'Error al cargar tareas')
        }
      } catch (err) {
        console.error('Error cargando tareas:', err)
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [])

  // Reloj en vivo (cada segundo)
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Pantalla completa sobre el propio dashboard (evita html/body sin altura definida)
  useEffect(() => {
    const syncFs = () => {
      try {
        const el = shellRef.current
        const fs = getFullscreenElement()
        const native = Boolean(el && fs === el)
        if (prevNativeFsRef.current && !native) {
          setImmersiveLayout(false)
        }
        prevNativeFsRef.current = native
        setIsFullscreen(native)
      } catch {
        /* ignore */
      }
    }
    document.addEventListener('fullscreenchange', syncFs)
    document.addEventListener('webkitfullscreenchange', syncFs)
    return () => {
      document.removeEventListener('fullscreenchange', syncFs)
      document.removeEventListener('webkitfullscreenchange', syncFs)
    }
  }, [])

  const pantallaGrandeActiva = isFullscreen || immersiveLayout

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current
    if (!el) return
    try {
      if (getFullscreenElement()) {
        await exitDocumentFullscreen()
        setImmersiveLayout(false)
        return
      }
      if (immersiveLayout) {
        setImmersiveLayout(false)
        return
      }
      const ok = await requestElementFullscreen(el)
      if (!ok) setImmersiveLayout(true)
    } catch {
      setImmersiveLayout((v) => !v)
    }
  }, [immersiveLayout])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_SCALE_STORAGE_KEY, String(viewScale))
    } catch {
      /* ignore */
    }
  }, [viewScale])

  const bumpViewScale = useCallback((delta: number) => {
    setViewScale((prev) => {
      const next = Math.round((prev + delta) * 100) / 100
      return Math.min(VIEW_SCALE_MAX, Math.max(VIEW_SCALE_MIN, next))
    })
  }, [])

  // Limpieza de marcas "recién llegó" (evita crecer el objeto sin límite)
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now()
      setLlegadaEnVivo((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [k, ts] of Object.entries(next)) {
          if (t - ts > NUEVA_EN_VIVO_MS) {
            delete next[k]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Auto-pan con translate (compatible con TV / WebKit bajo transform: scale en un ancestro)
  useEffect(() => {
    if (loading) return

    const reducedMotion = safeMediaMatches('(prefers-reduced-motion: reduce)', false)
    const likelyTvOrKiosk = safeMediaMatches('(hover: none)', true)
    const hBase = likelyTvOrKiosk ? 0.22 : 0.14
    const vBase = likelyTvOrKiosk ? 0.55 : 0.38
    const hSpeed = reducedMotion ? hBase * 0.35 : hBase
    const vSpeed = reducedMotion ? vBase * 0.35 : vBase

    hPanRef.current = 0
    hDirRef.current = 1
    vPanRefs.current = []

    const scheduleFrame =
      typeof requestAnimationFrame === 'function'
        ? (cb: FrameRequestCallback) => requestAnimationFrame(cb)
        : (cb: FrameRequestCallback) =>
            window.setTimeout(() => {
              try {
                const t = typeof performance !== 'undefined' ? performance.now() : Date.now()
                cb(t)
              } catch {
                /* ignore */
              }
            }, 32) as unknown as number

    const cancelFrame =
      typeof cancelAnimationFrame === 'function'
        ? (id: number) => cancelAnimationFrame(id)
        : (id: number) => window.clearTimeout(id as unknown as number)

    const advancePan = () => {
      try {
        const vp = boardViewportRef.current
        const track = columnsTrackRef.current
        if (vp && track) {
          const vw = vp.clientWidth
          const tw = track.offsetWidth
          const maxH = Math.max(0, tw - vw)
          if (maxH > 2) {
            hPanRef.current += hSpeed * hDirRef.current
            if (hPanRef.current >= maxH - 0.5) {
              hPanRef.current = maxH
              hDirRef.current = -1
            } else if (hPanRef.current <= 0.5) {
              hPanRef.current = 0
              hDirRef.current = 1
            }
            track.style.transform = `translate3d(${-hPanRef.current}px,0,0)`
          } else {
            hPanRef.current = 0
            track.style.transform = ''
          }
        } else if (track) {
          track.style.transform = ''
        }

        const nCols = BOARD_COLUMNS.length
        while (vPanRefs.current.length < nCols) vPanRefs.current.push(0)

        for (let i = 0; i < nCols; i++) {
          const slot = columnPanElsRef.current[i]
          const colVp = slot?.v
          const colTrack = slot?.t
          if (!colVp || !colTrack) continue
          const vh = colVp.clientHeight
          const th = colTrack.offsetHeight
          const maxV = Math.max(0, th - vh)
          if (maxV > 2) {
            let v = vPanRefs.current[i] ?? 0
            v += vSpeed
            if (v >= maxV - 0.5) v = 0
            vPanRefs.current[i] = v
            colTrack.style.transform = `translate3d(0,${-v}px,0)`
          } else {
            vPanRefs.current[i] = 0
            colTrack.style.transform = ''
          }
        }
      } catch {
        /* TV: lecturas DOM / style a veces fallan durante transiciones */
      }
    }

    const rafRef = { id: 0 as number }
    const tick = () => {
      advancePan()
      lastRafAtRef.current = Date.now()
      rafRef.id = scheduleFrame(tick)
    }
    rafRef.id = scheduleFrame(tick)

    // Si el RAF no corre (varias TV / WebViews), el pan sigue por intervalo
    const stallMs = 450
    const intervalMs = 80
    const iv = window.setInterval(() => {
      if (Date.now() - lastRafAtRef.current > stallMs) advancePan()
    }, intervalMs)

    return () => {
      cancelFrame(rafRef.id)
      window.clearInterval(iv)
      columnsTrackRef.current && (columnsTrackRef.current.style.transform = '')
      columnPanElsRef.current.forEach((slot) => {
        if (slot?.t) slot.t.style.transform = ''
      })
    }
  }, [loading, tasks.length, viewScale])

  // Suscripción a cambios en tiempo real
  useEffect(() => {
    if (!supabase) {
      console.warn('⚠️ Supabase no disponible para Realtime')
      return
    }

    const channel = supabase
      .channel('dashboard-pantallas-ordenes')
      .on<OrdenTrabajo>(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'ordenes_trabajo' 
        },
        (payload) => {
          console.log('🔄 Cambio en tiempo real:', payload.eventType)
          
          if (payload.eventType === 'DELETE') {
            setTasks((prev) => 
              prev.filter((t) => t.id !== payload.old.id?.toString())
            )
          } else if (payload.new) {
            const newTask = ordenToTask(payload.new as OrdenTrabajo)
            if (payload.eventType === 'INSERT') {
              setLlegadaEnVivo((prev) => ({ ...prev, [newTask.id]: Date.now() }))
            }
            setTasks((prev) => {
              const existingIndex = prev.findIndex((t) => t.id === newTask.id)
              if (existingIndex >= 0) {
                const updated = [...prev]
                updated[existingIndex] = newTask
                return updated
              }
              return [...prev, newTask]
            })
          }
          setLastUpdate(new Date())
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Dashboard: Realtime conectado')
        }
      })

    return () => {
      void channel.unsubscribe()
    }
  }, [])

  // Organizar tareas por columna
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    
    BOARD_COLUMNS.forEach((col) => {
      grouped[col.id] = []
    })

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task)
      }
    })

    // Ordenar por prioridad (alta primero) y luego por fecha
    Object.keys(grouped).forEach((colId) => {
      grouped[colId].sort((a, b) => {
        if (a.priority === 'alta' && b.priority !== 'alta') return -1
        if (a.priority !== 'alta' && b.priority === 'alta') return 1
        const dateA = new Date(a.updatedAt || a.createdAt).getTime()
        const dateB = new Date(b.updatedAt || b.createdAt).getTime()
        return dateB - dateA
      })
    })

    return grouped
  }, [tasks])

  // Contar tareas de prioridad alta
  const highPriorityCount = useMemo(() => {
    return tasks.filter((t) => t.priority === 'alta').length
  }, [tasks])

  const jornada = useMemo(() => getJornadaLaboral(now), [now])

  if (loading) {
    return (
      <div className="dashboard-pantallas-loading">
        <div className="loading-spinner"></div>
        <p>Cargando flujo de trabajo...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-pantallas-error">
        <h2>⚠️ Error</h2>
        <p>{error}</p>
      </div>
    )
  }

  const scaleRootStyle = {
    width: `${(100 / viewScale).toFixed(4)}%`,
    transform: `scale(${viewScale})`,
    transformOrigin: 'top left' as const
  }

  return (
    <div
      ref={shellRef}
      className={[
        'dashboard-pantallas',
        pantallaGrandeActiva ? 'dashboard-pantallas--fullscreen' : '',
        immersiveLayout ? 'dashboard-pantallas--immersive-layout' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="dashboard-pantallas-zoom-fab"
        role="group"
        aria-label="Escala de la pantalla"
      >
        <button
          type="button"
          className="dashboard-zoom-btn"
          onClick={() => bumpViewScale(-VIEW_SCALE_STEP)}
          disabled={viewScale <= VIEW_SCALE_MIN}
          title="Achicar contenido"
          aria-label="Reducir escala"
        >
          −
        </button>
        <span className="dashboard-zoom-label" title="Escala actual">
          {Math.round(viewScale * 100)}%
        </span>
        <button
          type="button"
          className="dashboard-zoom-btn"
          onClick={() => bumpViewScale(VIEW_SCALE_STEP)}
          disabled={viewScale >= VIEW_SCALE_MAX}
          title="Agrandar contenido"
          aria-label="Aumentar escala"
        >
          +
        </button>
        <button
          type="button"
          className="dashboard-zoom-btn dashboard-zoom-reset"
          onClick={() => setViewScale(1)}
          title="Volver a 100%"
        >
          100%
        </button>
      </div>

      <div className="dashboard-pantallas-scale-root" style={scaleRootStyle}>
      <header className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">
            <span className="title-icon">📊</span>
            Flujo de Trabajo en Tiempo Real
          </h1>
          <div className="header-pantalla-controls">
            <div className="dashboard-reloj" aria-live="polite">
              <time dateTime={now.toISOString()}>
                <span className="dashboard-reloj-hora">
                  {now.toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  })}
                </span>
                <span className="dashboard-reloj-fecha">
                  {now.toLocaleDateString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  })}
                </span>
              </time>
            </div>
            <button
              type="button"
              className="btn-pantalla-completa"
              onClick={() => void toggleFullscreen()}
              title={
                pantallaGrandeActiva ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'
              }
            >
              {pantallaGrandeActiva ? '✕ Salir' : '⛶ Pantalla grande'}
            </button>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-label">Total OP:</span>
              <span className="stat-value">{tasks.length}</span>
            </div>
            {highPriorityCount > 0 && (
              <div className="stat-item priority-alert">
                <span className="priority-led"></span>
                <span className="stat-label">Prioridad Alta:</span>
                <span className="stat-value">{highPriorityCount}</span>
              </div>
            )}
            <div className="stat-item">
              <span className="stat-label">Última actualización:</span>
              <span className="stat-value">
                {lastUpdate.toLocaleTimeString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        <div
          className="dashboard-jornada"
          role="region"
          aria-label={`Jornada de trabajo de ${JORNADA_INICIO_H}:00 a ${JORNADA_FIN_H}:00`}
        >
          <div className="dashboard-jornada-head">
            <span className="dashboard-jornada-extremo">8:00</span>
            <span className="dashboard-jornada-titulo">Hora de trabajo</span>
            <span className="dashboard-jornada-extremo">19:00</span>
          </div>
          <div className="dashboard-jornada-track">
            <div
              className="dashboard-jornada-fill"
              style={{ width: `${jornada.pct}%` }}
            />
            <div
              className="dashboard-jornada-marcador"
              style={{ left: `${jornada.pct}%` }}
              title={jornada.labelCorta}
            />
          </div>
          <p className="dashboard-jornada-estado">
            {jornada.phase === 'antes' && 'Antes de la jornada'}
            {jornada.phase === 'durante' && `En jornada · ${jornada.labelCorta}`}
            {jornada.phase === 'despues' && 'Jornada finalizada'}
          </p>
        </div>
      </header>

      <div className="dashboard-content" ref={boardViewportRef}>
        <div className="columns-container" ref={columnsTrackRef}>
          {BOARD_COLUMNS.map((column, colIndex) => {
            const columnTasks = tasksByColumn[column.id] || []
            const highPriorityInColumn = columnTasks.filter(
              (t) => t.priority === 'alta'
            ).length

            return (
              <div key={column.id} className="dashboard-column">
                <div className="column-header">
                  <h2 className="column-title" style={{ color: column.accent }}>
                    {column.label}
                  </h2>
                  <div className="column-badge">
                    {columnTasks.length}
                    {highPriorityInColumn > 0 && (
                      <span className="priority-indicator">
                        {' '}
                        <span className="priority-dot"></span>
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="column-content"
                  ref={(el) => {
                    setColumnPanSlot(colIndex).v = el
                  }}
                >
                  <div
                    className="column-content-track"
                    ref={(el) => {
                      setColumnPanSlot(colIndex).t = el
                    }}
                  >
                  {columnTasks.length === 0 ? (
                    <div className="empty-column">
                      <span className="empty-icon">📭</span>
                      <p>Sin tareas</p>
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const enVivo =
                        llegadaEnVivo[task.id] != null &&
                        Date.now() - llegadaEnVivo[task.id] < NUEVA_EN_VIVO_MS
                      const esNueva = isOrdenNuevaPorFecha(task.createdAt) || enVivo
                      const cardClass = [
                        'task-card',
                        task.priority === 'alta' ? 'high-priority' : '',
                        esNueva ? 'task-nueva' : '',
                        enVivo ? 'task-nueva--en-vivo' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')

                      return (
                      <div key={task.id} className={cardClass}>
                        <div className="task-header">
                          <span className="task-op">OP: {task.opNumber}</span>
                          <div className="task-header-right">
                            {task.priority === 'alta' && (
                              <>
                                <span className="task-priority-led" aria-hidden />
                                <span className="priority-badge">URGENTE</span>
                              </>
                            )}
                            {esNueva && (
                              <span
                                className="task-nueva-badge"
                                title="Orden nueva o reciente"
                              >
                                NUEVA
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="task-client">{task.title}</div>
                        {task.dniCuit && (
                          <div className="task-dni">DNI/CUIT: {task.dniCuit}</div>
                        )}
                        {task.summary && (
                          <div className="task-summary">{task.summary}</div>
                        )}
                        <div className="task-footer">
                          {task.assignedSector && (
                            <span className="task-sector">
                              📍 {task.assignedSector}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="task-date">
                              📅 {new Date(task.dueDate).toLocaleDateString('es-AR')}
                            </span>
                          )}
                        </div>
                      </div>
                      )
                    })
                  )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <footer className="dashboard-footer">
        <p>
          Actualización automática en tiempo real • Desplazamiento automático del tablero •{' '}
          {now.toLocaleString('es-AR')}
        </p>
      </footer>
      </div>
    </div>
  )
}

export default DashboardPantallasPage

