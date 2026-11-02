import { useMemo, useState } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  mesesCalendarioGoce,
  periodoGoceVacaciones,
  type VacacionesPeriodoCalendario
} from '../utils/rrhhVacacionesSaldo'
import './VacacionesCalendarioGoce.css'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Paleta estable por empleado (índice = id % n). */
const PALETTE = [
  '#2dd4bf',
  '#38bdf8',
  '#a78bfa',
  '#fbbf24',
  '#fb7185',
  '#4ade80',
  '#f472b6',
  '#22d3ee',
  '#c084fc',
  '#facc15'
]

function colorForUser(id: number): string {
  return PALETTE[Math.abs(id) % PALETTE.length]
}

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

type Props = {
  anioLiquidado: number
  periodos: VacacionesPeriodoCalendario[]
  filtroUsuarioId?: number | null
  onSelectUsuario?: (idUsuario: number) => void
}

const VacacionesCalendarioGoce = ({
  anioLiquidado,
  periodos,
  filtroUsuarioId = null,
  onSelectUsuario
}: Props) => {
  const goce = periodoGoceVacaciones(anioLiquidado)
  const meses = mesesCalendarioGoce(anioLiquidado)
  const [diaFocus, setDiaFocus] = useState<string | null>(null)

  const visibles = useMemo(() => {
    if (filtroUsuarioId == null) return periodos
    return periodos.filter((p) => p.idUsuario === filtroUsuarioId)
  }, [periodos, filtroUsuarioId])

  const porDia = useMemo(() => {
    const map = new Map<string, VacacionesPeriodoCalendario[]>()
    for (const p of visibles) {
      const start = parseISO(p.fecha_desde)
      const end = parseISO(p.fecha_hasta)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue
      const clipStart = start < parseISO(goce.desde) ? parseISO(goce.desde) : start
      const clipEnd = end > parseISO(goce.hasta) ? parseISO(goce.hasta) : end
      if (clipEnd < clipStart) continue
      for (const day of eachDayOfInterval({ start: clipStart, end: clipEnd })) {
        const iso = toIso(day)
        const prev = map.get(iso) ?? []
        prev.push(p)
        map.set(iso, prev)
      }
    }
    return map
  }, [visibles, goce.desde, goce.hasta])

  const leyenda = useMemo(() => {
    const seen = new Map<number, string>()
    for (const p of visibles) {
      if (!seen.has(p.idUsuario)) seen.set(p.idUsuario, p.nombre)
    }
    return [...seen.entries()]
      .map(([id, nombre]) => ({ id, nombre, color: colorForUser(id) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [visibles])

  const delDiaFocus = diaFocus ? porDia.get(diaFocus) ?? [] : []

  return (
    <section className="vac-goce" aria-label="Calendario de goce de vacaciones">
      <div className="vac-goce-hero">
        <div className="vac-goce-hero-copy">
          <p className="vac-goce-kicker">Temporada de goce · LCT</p>
          <h2>
            Diciembre {anioLiquidado}
            <span aria-hidden> → </span>
            Abril {anioLiquidado + 1}
          </h2>
          <p>
            Períodos tomados en la ventana habitual de vacaciones (desde diciembre en adelante).
            {filtroUsuarioId != null ? ' Mostrando solo el colaborador seleccionado.' : ' Vista de todo el equipo.'}
          </p>
        </div>
        <div className="vac-goce-hero-stats">
          <div>
            <strong>{visibles.length}</strong>
            <span>períodos</span>
          </div>
          <div>
            <strong>{leyenda.length}</strong>
            <span>personas</span>
          </div>
          <div>
            <strong>{porDia.size}</strong>
            <span>días con vacaciones</span>
          </div>
        </div>
      </div>

      {leyenda.length > 0 ? (
        <div className="vac-goce-legend" aria-label="Leyenda">
          {leyenda.slice(0, 12).map((l) => (
            <button
              key={l.id}
              type="button"
              className={`vac-goce-legend-chip${filtroUsuarioId === l.id ? ' is-active' : ''}`}
              style={{ ['--vac-color' as string]: l.color }}
              onClick={() => onSelectUsuario?.(l.id)}
              title={l.nombre}
            >
              <i style={{ background: l.color }} />
              <span>{l.nombre}</span>
            </button>
          ))}
          {leyenda.length > 12 ? (
            <span className="vac-goce-legend-more">+{leyenda.length - 12} más</span>
          ) : null}
        </div>
      ) : (
        <p className="vac-goce-empty">Todavía no hay vacaciones cargadas en esta temporada de goce.</p>
      )}

      <div className="vac-goce-months">
        {meses.map(({ anio, mes }) => {
          const monthDate = new Date(anio, mes, 1, 12, 0, 0)
          const start = startOfMonth(monthDate)
          const end = endOfMonth(monthDate)
          const days = eachDayOfInterval({ start, end })
          // Lunes = 0 en nuestra grilla
          const pad = (getDay(start) + 6) % 7

          return (
            <article key={`${anio}-${mes}`} className="vac-goce-month">
              <header className="vac-goce-month-head">
                <h3>{format(monthDate, 'MMMM yyyy', { locale: es })}</h3>
              </header>
              <div className="vac-goce-weekdays">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="vac-goce-grid">
                {Array.from({ length: pad }).map((_, i) => (
                  <div key={`pad-${i}`} className="vac-goce-cell vac-goce-cell--pad" />
                ))}
                {days.map((day) => {
                  const iso = toIso(day)
                  const enVentana = isWithinInterval(day, {
                    start: parseISO(goce.desde),
                    end: parseISO(goce.hasta)
                  })
                  const items = porDia.get(iso) ?? []
                  const has = items.length > 0
                  const isFocus = diaFocus === iso
                  const uniqueUsers = [...new Map(items.map((x) => [x.idUsuario, x])).values()]

                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!enVentana}
                      className={[
                        'vac-goce-cell',
                        has ? 'vac-goce-cell--has' : '',
                        isFocus ? 'vac-goce-cell--focus' : '',
                        !enVentana ? 'vac-goce-cell--out' : '',
                        isSameDay(day, new Date()) ? 'vac-goce-cell--today' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setDiaFocus((prev) => (prev === iso ? null : iso))}
                      title={
                        has
                          ? items.map((x) => x.nombre).join(', ')
                          : format(day, "d 'de' MMMM", { locale: es })
                      }
                    >
                      <span className="vac-goce-daynum">{format(day, 'd')}</span>
                      {has ? (
                        <span className="vac-goce-bars" aria-hidden>
                          {uniqueUsers.slice(0, 4).map((u) => {
                            const isStartReal = toIso(day) === u.fecha_desde
                            const isEnd = toIso(day) === u.fecha_hasta
                            return (
                              <i
                                key={`${u.key}-${iso}`}
                                className={[
                                  'vac-goce-bar',
                                  isStartReal ? 'vac-goce-bar--start' : '',
                                  isEnd ? 'vac-goce-bar--end' : '',
                                  !isStartReal && !isEnd ? 'vac-goce-bar--mid' : ''
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                style={{ background: colorForUser(u.idUsuario) }}
                              />
                            )
                          })}
                          {uniqueUsers.length > 4 ? (
                            <span className="vac-goce-more">+{uniqueUsers.length - 4}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>

      {diaFocus ? (
        <div className="vac-goce-daypanel">
          <div className="vac-goce-daypanel-head">
            <h3>
              {format(parseISO(diaFocus), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </h3>
            <button type="button" className="vac-goce-daypanel-close" onClick={() => setDiaFocus(null)}>
              Cerrar
            </button>
          </div>
          {delDiaFocus.length === 0 ? (
            <p className="vac-goce-empty">Nadie de vacaciones este día.</p>
          ) : (
            <ul className="vac-goce-daylist">
              {delDiaFocus.map((p) => (
                <li key={`${p.key}-${diaFocus}`}>
                  <button
                    type="button"
                    className="vac-goce-daylist-btn"
                    onClick={() => onSelectUsuario?.(p.idUsuario)}
                  >
                    <i style={{ background: colorForUser(p.idUsuario) }} />
                    <div>
                      <strong>{p.nombre}</strong>
                      <span>
                        {p.fecha_desde} → {p.fecha_hasta} · {p.dias} d · {p.fuente}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}

export default VacacionesCalendarioGoce
