import { useMemo, useState } from 'react'
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
import type { Task } from '../types/board'
import './CalendarPage.css'

type CalendarPageProps = {
  tasks: Task[]
  onBack: () => void
}

const normalizeDateKey = (value?: string) => {
  if (!value) return null
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return null
  return format(parsed, 'yyyy-MM-dd')
}

const dayLabel = (date: Date) => format(date, 'EEE dd', { locale: es })
const monthLabel = (date: Date) => format(date, 'MMMM yyyy', { locale: es })

const CalendarPage = ({ tasks, onBack }: CalendarPageProps) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      const key =
        normalizeDateKey(task.dueDate) ??
        normalizeDateKey(task.createdAt)
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
            <button onClick={goToPrevMonth} className="ghost-button">◀</button>
            <button onClick={goToToday} className="ghost-button">Hoy</button>
            <button onClick={goToNextMonth} className="ghost-button">▶</button>
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

            return (
              <div
                key={key + format(date, 'd')}
                className={`calendar-cell ${highlight ? 'today' : ''} ${
                  isCurrent ? '' : 'muted'
                }`}
              >
                <div className="cell-header">
                  <span className="cell-date">{dayLabel(date)}</span>
                  {dayTasks.length > 0 && (
                    <span className="cell-count">{dayTasks.length}</span>
                  )}
                </div>
                <div className="cell-tasks">
                  {dayTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className={`task-pill priority-${task.priority}`}
                      title={`${task.opNumber} • ${task.title}`}
                    >
                      <strong>{task.opNumber}</strong> {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 4 && (
                    <div className="more-pill">+{dayTasks.length - 4} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        <aside className="calendar-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-title">Próximas entregas</div>
            {upcoming.length === 0 && (
              <div className="sidebar-empty">Sin próximas entregas</div>
            )}
            {upcoming.map(([dateKey, dateTasks]) => (
              <div key={dateKey} className="sidebar-day">
                <div className="sidebar-day-header">
                  <span>{format(parseISO(dateKey), 'EEEE d', { locale: es })}</span>
                  <span className="sidebar-count">{dateTasks.length}</span>
                </div>
                <div className="sidebar-tasks">
                  {dateTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className={`sidebar-pill priority-${task.priority}`}>
                      <strong>{task.opNumber}</strong> {task.title}
                    </div>
                  ))}
                  {dateTasks.length > 3 && (
                    <div className="more-pill small">+{dateTasks.length - 3} más</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default CalendarPage

