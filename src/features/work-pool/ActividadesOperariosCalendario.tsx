import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './ActividadesOperariosCalendario.css'

type Props = {
  month: Date
  selectedDate: string
  countsByDay: Record<string, number>
  onSelectDate: (yyyyMmDd: string) => void
  onChangeMonth: (next: Date) => void
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toKey(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

export default function ActividadesOperariosCalendario({
  month,
  selectedDate,
  countsByDay,
  onSelectDate,
  onChangeMonth
}: Props) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const out: Array<{ key: string; day: number; inMonth: boolean } | null> = []
    for (let i = 0; i < startOffset; i += 1) out.push(null)
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push({ key: toKey(year, monthIndex, d), day: d, inMonth: true })
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [year, monthIndex])

  const monthLabel = month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <section className="act-op-cal" aria-label="Calendario de actividades">
      <header className="act-op-cal__head">
        <button
          type="button"
          className="act-op-cal__nav"
          aria-label="Mes anterior"
          onClick={() => onChangeMonth(new Date(year, monthIndex - 1, 1))}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <h3>{monthLabel}</h3>
        <button
          type="button"
          className="act-op-cal__nav"
          aria-label="Mes siguiente"
          onClick={() => onChangeMonth(new Date(year, monthIndex + 1, 1))}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </header>
      <div className="act-op-cal__weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="act-op-cal__grid">
        {cells.map((cell, i) =>
          cell ? (
            <button
              key={cell.key}
              type="button"
              className={`act-op-cal__day${selectedDate === cell.key ? ' is-selected' : ''}${
                countsByDay[cell.key] ? ' has-activity' : ''
              }`}
              onClick={() => onSelectDate(cell.key)}
              title={
                countsByDay[cell.key]
                  ? `${countsByDay[cell.key]} actividad${countsByDay[cell.key] === 1 ? '' : 'es'}`
                  : 'Sin actividades'
              }
            >
              <span>{cell.day}</span>
              {countsByDay[cell.key] ? (
                <em aria-hidden>{countsByDay[cell.key] > 9 ? '9+' : countsByDay[cell.key]}</em>
              ) : null}
            </button>
          ) : (
            <span key={`empty-${i}`} className="act-op-cal__day act-op-cal__day--empty" aria-hidden />
          )
        )}
      </div>
    </section>
  )
}
