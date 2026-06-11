import { useMemo } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import {
  buildMonthGrid,
  dayHasActivity,
  filterFechasCalendario,
  labelMesAnio,
  parseYearMonth,
  shiftYearMonth,
  type CalendarioCajasIndex
} from '../calendarioCajasData'
import { fmtArs } from '../format'
import type { CajaRegistro } from '../types'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Props = {
  yearMonth: string
  onYearMonthChange: (ym: string) => void
  selectedFecha: string
  onSelectFecha: (fecha: string) => void
  index: CalendarioCajasIndex
  cajas: CajaRegistro[]
  search: string
  onSearchChange: (q: string) => void
}

export default function CajaCalendarioAdmin({
  yearMonth,
  onYearMonthChange,
  selectedFecha,
  onSelectFecha,
  index,
  cajas,
  search,
  onSearchChange
}: Props) {
  const hoy = getArgentinaDateString()
  const { year, month } = parseYearMonth(yearMonth)
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month])

  const matchFechas = useMemo(
    () => filterFechasCalendario(index, search, search.trim() ? undefined : yearMonth),
    [index, search, yearMonth]
  )
  const matchSet = useMemo(() => new Set(matchFechas), [matchFechas])

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  const selectedDay = index[selectedFecha]

  return (
    <div className="caja-cc-card caja-cc-calendario">
      <div className="caja-cc-calendario-head">
        <div>
          <h3>Calendario de cajas</h3>
          <p className="caja-cc-sub">Elegí un día para ver ingresos, egresos y cierres por caja.</p>
        </div>
        <div className="caja-cc-calendario-nav">
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => onYearMonthChange(shiftYearMonth(yearMonth, -1))}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <strong className="caja-cc-calendario-month">{labelMesAnio(year, month)}</strong>
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => onYearMonthChange(shiftYearMonth(yearMonth, 1))}
            aria-label="Mes siguiente"
          >
            ›
          </button>
          <button
            type="button"
            className="btn-link btn-small"
            onClick={() => {
              onYearMonthChange(hoy.slice(0, 7))
              onSelectFecha(hoy)
            }}
          >
            Hoy
          </button>
        </div>
      </div>

      <label className="caja-cc-search caja-cc-calendario-search">
        <span className="caja-cc-search-icon" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          className="caja-cc-search-input"
          placeholder="Buscar por fecha, caja, cajera o monto…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar en calendario de cajas"
        />
      </label>

      {search.trim() && matchFechas.length > 0 && (
        <ul className="caja-cc-calendario-hits">
          {matchFechas.slice(0, 8).map((f) => {
            const d = index[f]
            return (
              <li key={f}>
                <button
                  type="button"
                  className={`caja-cc-calendario-hit${f === selectedFecha ? ' is-active' : ''}`}
                  onClick={() => {
                    onYearMonthChange(f.slice(0, 7))
                    onSelectFecha(f)
                  }}
                >
                  <span>{f.split('-').reverse().join('/')}</span>
                  {d && (
                    <span className="caja-cc-calendario-hit-meta">
                      {d.cierresTurno > 0 && `${d.cierresTurno} cierre(s)`}
                      {d.ingreso > 0 && ` · ing $ ${fmtArs(d.ingreso)}`}
                      {d.cajasSlugs.length > 0 &&
                        ` · ${d.cajasSlugs.map(cajaNombre).join(', ')}`}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
          {matchFechas.length > 8 && (
            <li className="caja-cc-muted">+{matchFechas.length - 8} día(s) más…</li>
          )}
        </ul>
      )}

      {search.trim() && matchFechas.length === 0 && (
        <p className="caja-cc-muted caja-cc-calendario-no-hits">Sin coincidencias para «{search}».</p>
      )}

      <div className="caja-cc-calendario-grid-wrap">
        <div className="caja-cc-calendario-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="caja-cc-calendario-grid" role="grid" aria-label={labelMesAnio(year, month)}>
          {cells.map((fecha, i) => {
            if (!fecha) {
              return <span key={`pad-${i}`} className="caja-cc-cal-day caja-cc-cal-day--pad" />
            }
            const day = index[fecha]
            const active = dayHasActivity(day)
            const dimmed = search.trim() && !matchSet.has(fecha)
            const isSelected = fecha === selectedFecha
            const isToday = fecha === hoy
            const dayNum = Number(fecha.slice(8, 10))

            return (
              <button
                key={fecha}
                type="button"
                role="gridcell"
                className={[
                  'caja-cc-cal-day',
                  active ? 'has-activity' : '',
                  isSelected ? 'is-selected' : '',
                  isToday ? 'is-today' : '',
                  dimmed ? 'is-dimmed' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectFecha(fecha)}
                title={
                  active && day
                    ? `Ingreso $ ${fmtArs(day.ingreso)} · Egreso $ ${fmtArs(day.egreso)}`
                    : undefined
                }
              >
                <span className="caja-cc-cal-day-num">{dayNum}</span>
                {active && day && (
                  <span className="caja-cc-cal-dots" aria-hidden>
                    {day.cierresTurno > 0 && <i className="dot cierre" />}
                    {day.planillas > 0 && <i className="dot planilla" />}
                    {day.arqueos > 0 && <i className="dot arqueo" />}
                    {day.egresosPendientes > 0 && <i className="dot pendiente" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="caja-cc-calendario-legend">
        <span>
          <i className="dot cierre" /> Cierre turno
        </span>
        <span>
          <i className="dot planilla" /> Planilla
        </span>
        <span>
          <i className="dot arqueo" /> Arqueo
        </span>
        <span>
          <i className="dot pendiente" /> Egreso pendiente
        </span>
      </div>

      {selectedDay && dayHasActivity(selectedDay) && (
        <div className="caja-cc-calendario-day-cajas">
          <strong>Cajas del {selectedFecha.split('-').reverse().join('/')}:</strong>{' '}
          {selectedDay.cajasSlugs.length > 0
            ? selectedDay.cajasSlugs.map(cajaNombre).join(' · ')
            : '—'}
        </div>
      )}
    </div>
  )
}
