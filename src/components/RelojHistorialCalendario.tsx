import { useMemo } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { RrhhRelojReporteSemanal } from '../types/api'

type RelojHistorialCalendarioProps = {
  mes: Date
  reportes: RrhhRelojReporteSemanal[]
  reporteActivoId: number | null
  onMesChange: (d: Date) => void
  onSeleccionarReporte: (r: RrhhRelojReporteSemanal) => void
}

function reporteContieneDia(r: RrhhRelojReporteSemanal, dayStr: string): boolean {
  return r.periodo_desde <= dayStr && r.periodo_hasta >= dayStr
}

const RelojHistorialCalendario = ({
  mes,
  reportes,
  reporteActivoId,
  onMesChange,
  onSeleccionarReporte
}: RelojHistorialCalendarioProps) => {
  const monthStart = startOfMonth(mes)
  const monthEnd = endOfMonth(mes)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const padStart = (monthStart.getDay() + 6) % 7

  const reportesDelMes = useMemo(
    () =>
      reportes.filter(
        (r) => r.periodo_desde <= format(monthEnd, 'yyyy-MM-dd') && r.periodo_hasta >= format(monthStart, 'yyyy-MM-dd')
      ),
    [reportes, monthStart, monthEnd]
  )

  return (
    <div className="reloj-historial">
      <div className="reloj-historial-head">
        <button type="button" className="reloj-historial-nav" onClick={() => onMesChange(subMonths(mes, 1))}>
          ←
        </button>
        <h3>{format(mes, 'MMMM yyyy', { locale: es })}</h3>
        <button type="button" className="reloj-historial-nav" onClick={() => onMesChange(addMonths(mes, 1))}>
          →
        </button>
      </div>

      <div className="reloj-historial-weekdays">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="reloj-historial-grid">
        {Array.from({ length: padStart }).map((_, i) => (
          <div key={`pad-${i}`} className="reloj-historial-day reloj-historial-day--empty" />
        ))}
        {days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const reporte = reportesDelMes.find((r) => reporteContieneDia(r, dayStr))
          const activo = reporte?.id === reporteActivoId
          return (
            <button
              key={dayStr}
              type="button"
              className={`reloj-historial-day${reporte ? ' reloj-historial-day--reporte' : ''}${activo ? ' reloj-historial-day--active' : ''}`}
              disabled={!reporte}
              onClick={() => reporte && onSeleccionarReporte(reporte)}
              title={
                reporte
                  ? `Informe ${reporte.periodo_desde} → ${reporte.periodo_hasta}`
                  : 'Sin informe guardado'
              }
            >
              <span className="reloj-historial-day-num">{format(day, 'd')}</span>
              {reporte ? <span className="reloj-historial-dot" aria-hidden /> : null}
            </button>
          )
        })}
      </div>

      <div className="reloj-historial-lista">
        <h4>Informes semanales del mes</h4>
        {reportesDelMes.length === 0 ? (
          <p className="reloj-historial-empty">No hay informes guardados en este mes.</p>
        ) : (
          <ul>
            {reportesDelMes.map((r) => {
              const desde = parseISO(r.periodo_desde)
              const hasta = parseISO(r.periodo_hasta)
              const label =
                isSameMonth(desde, hasta) && format(desde, 'yyyy-MM') === format(hasta, 'yyyy-MM')
                  ? `${format(desde, 'd/M')} – ${format(hasta, 'd/M/yyyy')}`
                  : `${format(desde, 'd/M/yyyy')} – ${format(hasta, 'd/M/yyyy')}`
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`reloj-historial-item${r.id === reporteActivoId ? ' active' : ''}`}
                    onClick={() => onSeleccionarReporte(r)}
                  >
                    <span className="reloj-historial-item-fechas">📅 {label}</span>
                    <span className="reloj-historial-item-meta">
                      {r.archivo_nombre || 'Importación reloj'}
                      {r.created_at ? ` · ${format(parseISO(r.created_at.slice(0, 10)), 'd/M/yy')}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default RelojHistorialCalendario
