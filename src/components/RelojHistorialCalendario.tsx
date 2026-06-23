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
import {
  diasEnSnapshot,
  fechaYmd,
  parseSnapshotReloj,
  periodoDesdeSnapshot,
  reporteTieneDiaConDatos,
  resumenDiaCalendario,
  tooltipDiaCalendario,
  type RelojDiaCalendarioResumen
} from '../utils/relojReporteSnapshot'

type RelojHistorialCalendarioProps = {
  mes: Date
  reportes: RrhhRelojReporteSemanal[]
  reporteActivoId: number | null
  onMesChange: (d: Date) => void
  onSeleccionarReporte: (r: RrhhRelojReporteSemanal) => void
}

type DiaCalendarioMeta = {
  reporte: RrhhRelojReporteSemanal
  resumen: RelojDiaCalendarioResumen
}

function reporteSolapaMes(r: RrhhRelojReporteSemanal, monthStart: Date, monthEnd: Date): boolean {
  const snap = parseSnapshotReloj(r.payload)
  const periodo = snap ? periodoDesdeSnapshot(snap) : { desde: fechaYmd(r.periodo_desde), hasta: fechaYmd(r.periodo_hasta) }
  if (!periodo.desde || !periodo.hasta) return false
  const mesDesde = format(monthStart, 'yyyy-MM-dd')
  const mesHasta = format(monthEnd, 'yyyy-MM-dd')
  return periodo.desde <= mesHasta && periodo.hasta >= mesDesde
}

function periodoEfectivoReporte(r: RrhhRelojReporteSemanal): { desde: string; hasta: string } {
  const snap = parseSnapshotReloj(r.payload)
  if (snap) return periodoDesdeSnapshot(snap)
  return { desde: fechaYmd(r.periodo_desde), hasta: fechaYmd(r.periodo_hasta) }
}

function formatPeriodoCorto(desde: string, hasta: string): string {
  const d0 = parseISO(fechaYmd(desde))
  const d1 = parseISO(fechaYmd(hasta))
  if (format(d0, 'yyyy-MM') === format(d1, 'yyyy-MM')) {
    return `${format(d0, 'd')}–${format(d1, 'd/M')}`
  }
  return `${format(d0, 'd/M')}–${format(d1, 'd/M')}`
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
    () => reportes.filter((r) => reporteSolapaMes(r, monthStart, monthEnd)),
    [reportes, monthStart, monthEnd]
  )

  const metaPorDia = useMemo(() => {
    const map = new Map<string, DiaCalendarioMeta>()
    for (const reporte of reportesDelMes) {
      const snap = parseSnapshotReloj(reporte.payload)
      if (!snap) continue
      const periodo = periodoDesdeSnapshot(snap)

      for (const dayStr of diasEnSnapshot(snap)) {
        if (!days.some((d) => format(d, 'yyyy-MM-dd') === dayStr)) continue
        const resumen = resumenDiaCalendario(snap, dayStr, periodo)
        if (!resumen) continue
        const prev = map.get(dayStr)
        if (!prev || reporte.id > prev.reporte.id) {
          map.set(dayStr, { reporte, resumen })
        }
      }
    }
    return map
  }, [reportesDelMes, days])

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
          const meta = metaPorDia.get(dayStr)
          const reporte = meta?.reporte ?? reportesDelMes.find((r) => reporteTieneDiaConDatos(r, dayStr))
          const resumen = meta?.resumen
          const activo = reporte?.id === reporteActivoId
          const finde = day.getDay() === 0 || day.getDay() === 6
          const tieneDatos = Boolean(resumen)

          return (
            <button
              key={dayStr}
              type="button"
              className={[
                'reloj-historial-day',
                reporte ? 'reloj-historial-day--reporte' : '',
                activo ? 'reloj-historial-day--active' : '',
                finde ? 'reloj-historial-day--finde' : '',
                resumen?.ausentes ? 'reloj-historial-day--alert' : '',
                resumen?.tardanzas ? 'reloj-historial-day--tarde' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!reporte}
              onClick={() => reporte && onSeleccionarReporte(reporte)}
              title={
                reporte && resumen
                  ? (() => {
                      const p = periodoEfectivoReporte(reporte)
                      return tooltipDiaCalendario(
                        dayStr,
                        { ...reporte, periodo_desde: p.desde, periodo_hasta: p.hasta },
                        resumen
                      )
                    })()
                  : reporte
                    ? (() => {
                        const p = periodoEfectivoReporte(reporte)
                        return `Informe ${p.desde} → ${p.hasta} (sin detalle diario)`
                      })()
                    : 'Sin informe guardado'
              }
            >
              <div className="reloj-historial-day-top">
                <span className="reloj-historial-day-num">{format(day, 'd')}</span>
                {resumen?.tieneInformeIa && resumen.esFinPeriodo ? (
                  <span className="reloj-historial-badge reloj-historial-badge--ia" title="Informe PlotAI">
                    IA
                  </span>
                ) : null}
              </div>

              {tieneDatos ? (
                <div className="reloj-historial-day-body">
                  <span className="reloj-historial-stat reloj-historial-stat--ok">
                    ✓ {resumen!.presentes}
                  </span>
                  {(resumen!.ausentes > 0 || resumen!.tardanzas > 0) && (
                    <span className="reloj-historial-stat-row">
                      {resumen!.ausentes > 0 ? (
                        <span className="reloj-historial-stat reloj-historial-stat--aus">
                          {resumen!.ausentes} aus
                        </span>
                      ) : null}
                      {resumen!.tardanzas > 0 ? (
                        <span className="reloj-historial-stat reloj-historial-stat--tarde">
                          {resumen!.tardanzas} tarde
                        </span>
                      ) : null}
                    </span>
                  )}
                  {resumen!.esInicioPeriodo && reporte ? (
                    <span className="reloj-historial-periodo">
                      {(() => {
                        const p = periodoEfectivoReporte(reporte)
                        return formatPeriodoCorto(p.desde, p.hasta)
                      })()}
                    </span>
                  ) : null}
                </div>
              ) : reporte ? (
                <span className="reloj-historial-day-sin-detalle">Informe</span>
              ) : finde ? (
                <span className="reloj-historial-day-vacio">—</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="reloj-historial-leyenda">
        <span>
          <i className="reloj-historial-leyenda-dot reloj-historial-leyenda-dot--ok" /> Presentes
        </span>
        <span>
          <i className="reloj-historial-leyenda-dot reloj-historial-leyenda-dot--aus" /> Ausentes
        </span>
        <span>
          <i className="reloj-historial-leyenda-dot reloj-historial-leyenda-dot--tarde" /> Tardanzas
        </span>
        <span>
          <span className="reloj-historial-badge reloj-historial-badge--ia">IA</span> Informe PlotAI
        </span>
      </div>

      <div className="reloj-historial-lista">
        <h4>Informes semanales del mes</h4>
        {reportesDelMes.length === 0 ? (
          <p className="reloj-historial-empty">No hay informes guardados en este mes.</p>
        ) : (
          <ul>
            {reportesDelMes.map((r) => {
              const snap = parseSnapshotReloj(r.payload)
              const periodo = snap ? periodoDesdeSnapshot(snap) : { desde: fechaYmd(r.periodo_desde), hasta: fechaYmd(r.periodo_hasta) }
              const desde = parseISO(periodo.desde)
              const hasta = parseISO(periodo.hasta)
              const label =
                isSameMonth(desde, hasta) && format(desde, 'yyyy-MM') === format(hasta, 'yyyy-MM')
                  ? `${format(desde, 'd/M')} – ${format(hasta, 'd/M/yyyy')}`
                  : `${format(desde, 'd/M/yyyy')} – ${format(hasta, 'd/M/yyyy')}`
              const compactos = snap?.resumenesCompactos ?? []
              const totalPresentes = compactos.reduce((a, c) => a + c.diasTrabajados, 0)
              const totalTardanzas = compactos.reduce((a, c) => a + c.tardanzas, 0)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`reloj-historial-item${r.id === reporteActivoId ? ' active' : ''}`}
                    onClick={() => onSeleccionarReporte(r)}
                  >
                    <span className="reloj-historial-item-fechas">📅 {label}</span>
                    <span className="reloj-historial-item-stats">
                      {compactos.length > 0
                        ? `${compactos.length} empleados · ${totalPresentes} días trab. · ${totalTardanzas} tardanzas`
                        : 'Sin resumen agregado'}
                      {snap?.informeIa ? ' · 🤖 PlotAI' : ''}
                    </span>
                    <span className="reloj-historial-item-meta">
                      {r.archivo_nombre || 'Importación reloj'}
                      {r.created_at ? ` · ${format(parseISO(fechaYmd(r.created_at)), 'd/M/yy')}` : ''}
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
