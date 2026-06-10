import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { es } from 'date-fns/locale'
import { BOARD_COLUMNS } from '../data/mockData'
import type { Task } from '../types/board'
import './CalendarPage.css'

type CalendarPageProps = {
  tasks: Task[]
  onBack: () => void
}

const SIDEBAR_VISIBLE = 3
const GRID_VISIBLE = 4

const normalizeDateKey = (value?: string) => {
  if (!value) return null
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return null
  return format(parsed, 'yyyy-MM-dd')
}

const dayLabel = (date: Date) => format(date, 'EEE dd', { locale: es })
const monthLabel = (date: Date) => format(date, 'MMMM yyyy', { locale: es })

function taskColumnLabel(task: Task): string {
  const col = BOARD_COLUMNS.find((c) => c.id === task.status)
  return col?.label || task.assignedSector || 'Sin columna'
}

function priorityLabel(priority: Task['priority']): string {
  if (priority === 'alta') return 'Alta'
  if (priority === 'baja') return 'Baja'
  return 'Media'
}

const CalendarPage = ({ tasks, onBack }: CalendarPageProps) => {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [expandedSidebarDays, setExpandedSidebarDays] = useState<Set<string>>(() => new Set())
  const [expandedGridDays, setExpandedGridDays] = useState<Set<string>>(() => new Set())

  const openTaskFicha = useCallback(
    (task: Task) => {
      if (!task.opNumber?.trim()) return
      navigate(`/op/${encodeURIComponent(task.opNumber.trim())}`)
    },
    [navigate]
  )

  const toggleSidebarDay = useCallback((dateKey: string) => {
    setExpandedSidebarDays((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }, [])

  const toggleGridDay = useCallback((dateKey: string) => {
    setExpandedGridDays((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }, [])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      const key = normalizeDateKey(task.dueDate) ?? normalizeDateKey(task.createdAt)
      if (!key) return
      const existing = map.get(key) ?? []
      existing.push(task)
      map.set(key, existing)
    })
    return map
  }, [tasks])

  const upcoming = useMemo(() => {
    const todayKey = normalizeDateKey(new Date().toISOString()) ?? ''
    const entries = Array.from(tasksByDate.entries())
      .filter(([key]) => key >= todayKey)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 10)
    return entries
  }, [tasksByDate])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = gridStart
  while (day <= gridEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const goToPrevMonth = () => setCurrentMonth((prev) => addDays(startOfMonth(prev), -1))
  const goToNextMonth = () => setCurrentMonth((prev) => addDays(endOfMonth(prev), 1))
  const goToToday = () => setCurrentMonth(startOfMonth(new Date()))

  return (
    <div className="calendar-page">
      <header className="calendar-topbar">
        <div className="calendar-left">
          <button className="ghost-button" onClick={onBack}>
            ← Volver al tablero
          </button>
          <div className="month-nav">
            <button onClick={goToPrevMonth} className="ghost-button">
              ◀
            </button>
            <button onClick={goToToday} className="ghost-button">
              Hoy
            </button>
            <button onClick={goToNextMonth} className="ghost-button">
              ▶
            </button>
          </div>
          <div className="month-title">{monthLabel(currentMonth)}</div>
        </div>
        <div className="calendar-legend">
          <span className="pill priority-alta">Alta</span>
          <span className="pill priority-media">Media</span>
          <span className="pill priority-baja">Baja</span>
        </div>
      </header>

      <div className="calendar-layout">
        <section className="calendar-grid">
          {days.map((date) => {
            const key = format(date, 'yyyy-MM-dd')
            const dayTasks = tasksByDate.get(key) ?? []
            const isCurrent = isSameMonth(date, monthStart)
            const highlight = isToday(date)
            const expanded = expandedGridDays.has(key)
            const visibleTasks = expanded ? dayTasks : dayTasks.slice(0, GRID_VISIBLE)
            const hiddenCount = dayTasks.length - GRID_VISIBLE

            return (
              <div
                key={key + format(date, 'd')}
                className={`calendar-cell ${highlight ? 'today' : ''} ${isCurrent ? '' : 'muted'}`}
              >
                <div className="cell-header">
                  <span className="cell-date">{dayLabel(date)}</span>
                  {dayTasks.length > 0 && <span className="cell-count">{dayTasks.length}</span>}
                </div>
                <div className="cell-tasks">
                  {visibleTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className={`task-pill priority-${task.priority}`}
                      title={`${task.opNumber} • ${task.title}`}
                      onClick={() => openTaskFicha(task)}
                    >
                      <strong>{task.opNumber}</strong> {task.title}
                    </button>
                  ))}
                  {!expanded && hiddenCount > 0 && (
                    <button
                      type="button"
                      className="more-pill"
                      onClick={() => toggleGridDay(key)}
                      aria-expanded={false}
                    >
                      +{hiddenCount} más
                    </button>
                  )}
                  {expanded && hiddenCount > 0 && (
                    <button
                      type="button"
                      className="more-pill more-pill--collapse"
                      onClick={() => toggleGridDay(key)}
                      aria-expanded
                    >
                      Ver menos
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        <aside className="calendar-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-card-head">
              <div>
                <div className="sidebar-title">Próximas entregas</div>
                <p className="sidebar-subtitle">Tocá una OP para abrir la ficha completa</p>
              </div>
              {upcoming.length > 0 && (
                <span className="sidebar-total-badge">
                  {upcoming.reduce((acc, [, list]) => acc + list.length, 0)} OP
                </span>
              )}
            </div>

            {upcoming.length === 0 && <div className="sidebar-empty">Sin próximas entregas</div>}

            <div className="sidebar-days">
              {upcoming.map(([dateKey, dateTasks]) => {
                const expanded = expandedSidebarDays.has(dateKey)
                const visibleTasks = expanded ? dateTasks : dateTasks.slice(0, SIDEBAR_VISIBLE)
                const hiddenCount = dateTasks.length - SIDEBAR_VISIBLE
                const dayDate = parseISO(dateKey)
                const isDayToday = isToday(dayDate)

                return (
                  <div key={dateKey} className={`sidebar-day${isDayToday ? ' sidebar-day--today' : ''}`}>
                    <div className="sidebar-day-header">
                      <div className="sidebar-day-date">
                        <span className="sidebar-day-weekday">
                          {format(dayDate, 'EEEE', { locale: es })}
                        </span>
                        <span className="sidebar-day-num">{format(dayDate, "d 'de' MMMM", { locale: es })}</span>
                      </div>
                      <span className="sidebar-count">{dateTasks.length}</span>
                    </div>

                    <div className="sidebar-tasks">
                      {visibleTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className={`sidebar-task-card priority-${task.priority}`}
                          onClick={() => openTaskFicha(task)}
                          title="Abrir ficha de la OP"
                        >
                          <div className="sidebar-task-top">
                            <span className="sidebar-task-op">{task.opNumber}</span>
                            <span className={`sidebar-task-priority priority-${task.priority}`}>
                              {priorityLabel(task.priority)}
                            </span>
                          </div>
                          <span className="sidebar-task-client">{task.title}</span>
                          <span className="sidebar-task-meta">{taskColumnLabel(task)}</span>
                        </button>
                      ))}

                      {!expanded && hiddenCount > 0 && (
                        <button
                          type="button"
                          className="more-pill small"
                          onClick={() => toggleSidebarDay(dateKey)}
                          aria-expanded={false}
                        >
                          <span>+{hiddenCount} más</span>
                          <span className="more-pill-chevron" aria-hidden>
                            ▾
                          </span>
                        </button>
                      )}
                      {expanded && hiddenCount > 0 && (
                        <button
                          type="button"
                          className="more-pill small more-pill--collapse"
                          onClick={() => toggleSidebarDay(dateKey)}
                          aria-expanded
                        >
                          <span>Ver menos</span>
                          <span className="more-pill-chevron more-pill-chevron--up" aria-hidden>
                            ▴
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default CalendarPage
