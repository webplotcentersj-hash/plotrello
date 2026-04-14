import { useMemo, useState } from 'react'
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Task } from '../types/board'
import './GanttPage.css'

type ZoomLevel = 'week' | 'month' | 'quarter'

type GanttPageProps = {
  tasks: Task[]
  onBack: () => void
}

const LABEL_COL_PX = 280

const dayWidthByZoom: Record<ZoomLevel, number> = {
  week: 28,
  month: 14,
  quarter: 6
}

const normalizeDate = (value?: string) => {
  if (!value) return null
  const parsed = parseISO(value)
  if (!isValid(parsed)) return null
  return parsed
}

const GanttPage = ({ tasks, onBack }: GanttPageProps) => {
  const [zoom, setZoom] = useState<ZoomLevel>('month')

  const mapped = useMemo(() => {
    const items = tasks.map((task) => {
      const start = normalizeDate(task.createdAt) ?? new Date()
      const fallbackEnd = addDays(start, 2)
      const end = normalizeDate(task.dueDate) ?? fallbackEnd
      return {
        id: task.id,
        name: `${task.opNumber} · ${task.title}`,
        start,
        end,
        priority: task.priority,
        status: task.status
      }
    })
    if (items.length === 0) return { items, min: new Date(), max: addDays(new Date(), 1) }
    const min = items.reduce((acc, item) => (item.start < acc ? item.start : acc), items[0].start)
    const maxRaw = items.reduce((acc, item) => (item.end > acc ? item.end : acc), items[0].end)
    const today = new Date()
    const max = maxRaw > today ? maxRaw : today
    return { items, min, max }
  }, [tasks])

  const totalDays = Math.max(differenceInCalendarDays(mapped.max, mapped.min) + 1, 1)
  const dayWidth = dayWidthByZoom[zoom]
  const timelineWidth = totalDays * dayWidth
  const todayOffset = differenceInCalendarDays(new Date(), mapped.min)

  const formatTick = (index: number) => {
    const date = addDays(mapped.min, index)
    if (zoom === 'week') return format(date, 'EEE d', { locale: es })
    if (zoom === 'month') return format(date, 'd', { locale: es })
    return format(date, 'd', { locale: es })
  }

  return (
    <div className="gantt-page">
      <header className="gantt-topbar">
        <button type="button" className="gantt-btn gantt-btn--ghost" onClick={onBack}>
          ← Volver
        </button>
        <div className="gantt-legend">
          <span className="gantt-pill gantt-pill--alta">Alta</span>
          <span className="gantt-pill gantt-pill--media">Media</span>
          <span className="gantt-pill gantt-pill--baja">Baja</span>
        </div>
        <div className="gantt-zoom">
          {(['week', 'month', 'quarter'] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              className={zoom === level ? 'gantt-btn gantt-btn--ghost is-active' : 'gantt-btn gantt-btn--ghost'}
              onClick={() => setZoom(level)}
            >
              {level === 'week' && 'Semana'}
              {level === 'month' && 'Mes'}
              {level === 'quarter' && 'Trimestre'}
            </button>
          ))}
        </div>
      </header>

      {mapped.items.length === 0 ? (
        <div className="gantt-empty">No hay órdenes para mostrar.</div>
      ) : (
        <div className="gantt-wrapper">
          <div
            className="gantt-inner"
            style={{
              minWidth: LABEL_COL_PX + 16 + timelineWidth
            }}
          >
            <div className="gantt-label-col">
              <div className="gantt-corner" aria-hidden />
              {mapped.items.map((item) => (
                <div key={item.id} className="gantt-label" title={item.name}>
                  <strong className="gantt-label-title">{item.name}</strong>
                  <span className="gantt-label-dates">
                    {format(item.start, 'd MMM', { locale: es })} → {format(item.end, 'd MMM', { locale: es })}
                  </span>
                </div>
              ))}
            </div>

            <div className="gantt-chart-scroll">
            <div className="gantt-chart" style={{ width: timelineWidth }}>
              <div className="gantt-ticks">
                {Array.from({ length: totalDays }).map((_, index) => (
                  <div
                    key={index}
                    className="gantt-tick"
                    style={{ width: dayWidth, minWidth: dayWidth }}
                    title={format(addDays(mapped.min, index), 'PPP', { locale: es })}
                  >
                    <span className="gantt-tick-label">{formatTick(index)}</span>
                  </div>
                ))}
              </div>

              <div className="gantt-bar-rows">
                {mapped.items.map((item) => {
                  const startOffset = differenceInCalendarDays(item.start, mapped.min)
                  const duration = Math.max(
                    differenceInCalendarDays(item.end, item.start) + 1,
                    1
                  )
                  const left = startOffset * dayWidth
                  const width = duration * dayWidth
                  return (
                    <div key={item.id} className="gantt-bar-row">
                      <div className="gantt-bar-track">
                        <div
                          className={`gantt-bar gantt-bar--${item.priority}`}
                          style={{ left, width }}
                          title={item.name}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="gantt-today-line"
                  style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                  title="Hoy"
                />
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GanttPage
