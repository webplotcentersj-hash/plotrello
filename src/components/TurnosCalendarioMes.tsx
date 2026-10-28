import { useMemo } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths
} from 'date-fns'
import { es } from 'date-fns/locale'
import { getArgentinaDateString } from '../utils/dateUtils'
import type { DiaCalendarioTurnos } from '../utils/rrhhTurnosCalendario'

type Props = {
  mesIso: string
  fechaSeleccionada: string
  dias: DiaCalendarioTurnos[]
  onCambiarMes: (mesIso: string) => void
  onElegirDia: (fechaIso: string) => void
}

export default function TurnosCalendarioMes({
  mesIso,
  fechaSeleccionada,
  dias,
  onCambiarMes,
  onElegirDia
}: Props) {
  const mesDate = useMemo(() => parseISO(`${mesIso}-01`), [mesIso])
  const hoy = getArgentinaDateString()
  const monthStart = startOfMonth(mesDate)
  const monthEnd = endOfMonth(mesDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const padStart = (monthStart.getDay() + 6) % 7

  const byKey = useMemo(() => {
    const m = new Map<string, DiaCalendarioTurnos>()
    for (const d of dias) m.set(d.fecha, d)
    return m
  }, [dias])

  return (
    <div className="rrhh-turnos-cal">
      <div className="reloj-historial-head">
        <button
          type="button"
          className="reloj-historial-nav"
          onClick={() => onCambiarMes(format(subMonths(mesDate, 1), 'yyyy-MM'))}
        >
          ←
        </button>
        <h3>{format(mesDate, 'MMMM yyyy', { locale: es })}</h3>
        <button
          type="button"
          className="reloj-historial-nav"
          onClick={() => onCambiarMes(format(addMonths(mesDate, 1), 'yyyy-MM'))}
        >
          →
        </button>
      </div>

      <p className="rrhh-turnos-cal-help">
        Calendario de turnos. Tocá un día para ver la lista. Verde = en turno · Violeta = rotativo · Ámbar =
        permiso.
      </p>

      <div className="reloj-historial-weekdays">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="rrhh-turnos-cal-grid">
        {Array.from({ length: padStart }).map((_, i) => (
          <div key={`pad-${i}`} className="rrhh-turnos-cal-day rrhh-turnos-cal-day--empty" />
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const info = byKey.get(key)
          const selected = key === fechaSeleccionada
          const isHoy = key === hoy
          const dow = day.getDay()
          return (
            <button
              key={key}
              type="button"
              className={[
                'rrhh-turnos-cal-day',
                selected ? 'is-selected' : '',
                isHoy ? 'is-today' : '',
                dow === 0 ? 'is-sunday' : '',
                dow === 6 ? 'is-saturday' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onElegirDia(key)}
            >
              <span className="rrhh-turnos-cal-daynum">{format(day, 'd')}</span>
              <span className="rrhh-turnos-cal-stats">
                {info && info.trabajando > 0 ? (
                  <span className="rrhh-turnos-cal-stat rrhh-turnos-cal-stat--ok" title="En turno">
                    {info.trabajando}
                  </span>
                ) : null}
                {info && info.rotativos > 0 ? (
                  <span className="rrhh-turnos-cal-stat rrhh-turnos-cal-stat--rot" title="Rotativos">
                    {info.rotativos}
                  </span>
                ) : null}
                {info && info.permisos > 0 ? (
                  <span className="rrhh-turnos-cal-stat rrhh-turnos-cal-stat--perm" title="Permisos">
                    {info.permisos}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
