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

function isOrdenNuevaPorFecha(createdAt: string): boolean {
  const t = new Date(createdAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < NUEVA_OP_MAX_MS
}

/** Jornada visible en la barra (hora local del dispositivo / pantalla) */
const JORNADA_INICIO_H = 8
const JORNADA_FIN_H = 19

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
  /** id de tarea → timestamp de llegada por INSERT realtime */
  const [llegadaEnVivo, setLlegadaEnVivo] = useState<Record<string, number>>({})

  const boardScrollRef = useRef<HTMLDivElement | null>(null)
  const columnScrollRefs = useRef<(HTMLDivElement | null)[]>([])

  const setColumnScrollRef = useCallback((index: number, el: HTMLDivElement | null) => {
    columnScrollRefs.current[index] = el
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

  // Pantalla completa
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.warn('Pantalla completa no disponible:', err)
    }
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

  // Auto-scroll: horizontal (vaivén) + vertical por columna; respeta prefers-reduced-motion
  useEffect(() => {
    if (loading) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let hDir = 1
    /** Vaivén horizontal del tablero (abajo): lento para lectura en pantalla */
    const hSpeed = 0.12
    const vSpeed = 0.35

    const tick = () => {
      const board = boardScrollRef.current
      if (board) {
        const maxH = board.scrollWidth - board.clientWidth
        if (maxH > 2) {
          board.scrollLeft += hSpeed * hDir
          if (board.scrollLeft >= maxH - 1) hDir = -1
          else if (board.scrollLeft <= 1) hDir = 1
        }
      }

      columnScrollRefs.current.forEach((col) => {
        if (!col) return
        const maxV = col.scrollHeight - col.clientHeight
        if (maxV <= 2) return
        col.scrollTop += vSpeed
        if (col.scrollTop >= maxV - 1) col.scrollTop = 0
      })

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [loading, tasks.length])

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

  return (
    <div className={`dashboard-pantallas ${isFullscreen ? 'dashboard-pantallas--fullscreen' : ''}`}>
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
              title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
            >
              {isFullscreen ? '✕ Salir' : '⛶ Pantalla grande'}
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

      <div className="dashboard-content" ref={boardScrollRef}>
        <div className="columns-container">
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
                  ref={(el) => setColumnScrollRef(colIndex, el)}
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
            )
          })}
        </div>
      </div>

      <footer className="dashboard-footer">
        <p>
          Actualización automática en tiempo real • Auto-scroll (desactivado si el sistema pide menos
          movimiento) •{' '}
          {now.toLocaleString('es-AR')}
        </p>
      </footer>
    </div>
  )
}

export default DashboardPantallasPage

