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
  diasEntreInclusive,
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
  /** Rango elegido para cargar período (desde / hasta). */
  rangoSeleccionado?: { desde: string; hasta: string | null } | null
  onSelectUsuario?: (idUsuario: number) => void
  /** Click en un día de la temporada: permite armar desde/hasta. */
  onPickDia?: (iso: string) => void
}

const VacacionesCalendarioGoce = ({
  anioLiquidado,
  periodos,
  filtroUsuarioId = null,
  rangoSeleccionado = null,
  onSelectUsuario,
  onPickDia
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

  const enRangoPick = (iso: string) => {
    if (!rangoSeleccionado?.desde) return false
    const hasta = rangoSeleccionado.hasta || rangoSeleccionado.desde
    const a = rangoSeleccionado.desde <= hasta ? rangoSeleccionado.desde : hasta
    const b = rangoSeleccionado.desde <= hasta ? hasta : rangoSeleccionado.desde
    return iso >= a && iso <= b
  }

  const diasRango =
    rangoSeleccionado?.desde && rangoSeleccionado.hasta
      ? diasEntreInclusive(rangoSeleccionado.desde, rangoSeleccionado.hasta)
      : rangoSeleccionado?.desde
        ? 1
        : 0

  const handleDayClick = (iso: string, enVentana: boolean) => {
    if (!enVentana) return
    if (filtroUsuarioId != null && onPickDia) {
      onPickDia(iso)
      setDiaFocus(iso)
      return
    }
    setDiaFocus((prev) => (prev === iso ? null : iso))
  }

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
            {filtroUsuarioId != null ? (
              <>
                Seleccioná en el calendario el <strong>desde</strong> y el <strong>hasta</strong> del
                período (dos clics). El rango queda listo en el panel del empleado.
                {rangoSeleccionado?.desde ? (
                  <>
                    {' '}
                    Actual:{' '}
                    <strong>
                      {rangoSeleccionado.desde}
                      {rangoSeleccionado.hasta ? ` → ${rangoSeleccionado.hasta}` : ' (elegí hasta)'}
                    </strong>
                    {diasRango > 0 ? ` · ${diasRango} d` : ''}
                  </>
                ) : null}
              </>
            ) : (
              <>
                Períodos tomados en la ventana habitual de vacaciones. Elegí un empleado en la tabla
                o leyenda para marcar fechas en el calendario.
              </>
            )}
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
        <p className="vac-goce-empty">
          {filtroUsuarioId != null
            ? 'Este colaborador aún no tiene vacaciones en la temporada. Marcá el período en el calendario.'
            : 'Todavía no hay vacaciones cargadas en esta temporada de goce.'}
        </p>
      )}

      <div className="vac-goce-months">
        {meses.map(({ anio, mes }) => {
          const monthDate = new Date(anio, mes, 1, 12, 0, 0)
          const start = startOfMonth(monthDate)
          const end = endOfMonth(monthDate)
          const days = eachDayOfInterval({ start, end })
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
                  const isPick = enRangoPick(iso)
                  const isPickEdge =
                    rangoSeleccionado?.desde === iso || rangoSeleccionado?.hasta === iso
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
                        isPick ? 'vac-goce-cell--pick' : '',
                        isPickEdge ? 'vac-goce-cell--pick-edge' : '',
                        !enVentana ? 'vac-goce-cell--out' : '',
                        isSameDay(day, new Date()) ? 'vac-goce-cell--today' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleDayClick(iso, enVentana)}
                      title={
                        filtroUsuarioId != null
                          ? `Elegir ${format(day, "d 'de' MMMM", { locale: es })}`
                          : has
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

      {diaFocus && filtroUsuarioId == null ? (
        <div className="vac-goce-daypanel">
          <div className="vac-goce-daypanel-head">
            <h3>{format(parseISO(diaFocus), "EEEE d 'de' MMMM yyyy", { locale: es })}</h3>
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
