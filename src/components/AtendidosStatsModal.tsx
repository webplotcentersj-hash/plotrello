import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import apiService from '../services/api'
import {
  getArgentinaDateString,
  isoToArgentinaDateKey,
  isoToArgentinaTime
} from '../utils/dateUtils'
import './AtendidosStatsModal.css'

type Props = {
  open: boolean
  onClose: () => void
}

type TabId = 'calendario' | 'hora' | 'flujos' | 'resumen'
type VistaCal = 'mes' | 'semana' | 'dia'

type VentaLite = { fecha_venta: string; estado_pago?: string | null }
type AtencionLite = { fecha_atencion: string; tipo: string }
type DiaCount = { fecha: string; presencial: number; virtual: number; total: number }

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]
const TABS: { id: TabId; label: string }[] = [
  { id: 'calendario', label: 'Calendario' },
  { id: 'hora', label: 'Por hora' },
  { id: 'flujos', label: 'Flujos' },
  { id: 'resumen', label: 'Estadísticas' }
]
const PIE_COLORS = ['#38bdf8', '#a78bfa', '#fbbf24', '#34d399']

function addCalendarDaysToYMD(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  u.setUTCDate(u.getUTCDate() + deltaDays)
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`
}

function ymdParts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  return { y, m, d }
}

function ymdLabel(ymd: string): string {
  if (ymd.length < 10) return ymd
  const { d, m } = ymdParts(ymd)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

function monthTitle(ymd: string): string {
  const { y, m } = ymdParts(ymd)
  return `${MONTH_NAMES[m - 1] || ''} ${y}`
}

function startOfMonth(ymd: string): string {
  const { y, m } = ymdParts(ymd)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

function endOfMonth(ymd: string): string {
  const { y, m } = ymdParts(ymd)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

/** Lunes de la semana (Lun–Dom) para un YYYY-MM-DD civil. */
function startOfWeekMonday(ymd: string): string {
  const { y, m, d } = ymdParts(ymd)
  const u = new Date(Date.UTC(y, m - 1, d))
  const dow = u.getUTCDay() // 0 Dom … 6 Sáb
  const delta = dow === 0 ? -6 : 1 - dow
  u.setUTCDate(u.getUTCDate() + delta)
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`
}

function endOfWeekSunday(ymd: string): string {
  return addCalendarDaysToYMD(startOfWeekMonday(ymd), 6)
}

function daysBetweenInclusive(desde: string, hasta: string): string[] {
  const out: string[] = []
  let cur = desde
  while (cur <= hasta) {
    out.push(cur)
    cur = addCalendarDaysToYMD(cur, 1)
    if (out.length > 62) break
  }
  return out
}

function monthGrid(ymd: string): Array<Array<string | null>> {
  const start = startOfMonth(ymd)
  const end = endOfMonth(ymd)
  const firstDow = (() => {
    const { y, m, d } = ymdParts(start)
    const u = new Date(Date.UTC(y, m - 1, d))
    const dow = u.getUTCDay()
    return dow === 0 ? 6 : dow - 1 // Lun=0
  })()
  const cells: Array<string | null> = []
  for (let i = 0; i < firstDow; i += 1) cells.push(null)
  for (const day of daysBetweenInclusive(start, end)) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: Array<Array<string | null>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function argentinaHourFromIso(iso: string): number | null {
  const t = isoToArgentinaTime(iso)
  if (!t || t.length < 2) return null
  const h = Number(t.slice(0, 2))
  return Number.isFinite(h) ? h : null
}

function shiftAncla(ancla: string, vista: VistaCal, dir: -1 | 1): string {
  if (vista === 'mes') {
    const { y, m, d } = ymdParts(ancla)
    const u = new Date(Date.UTC(y, m - 1 + dir, Math.min(d, 28)))
    return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`
  }
  if (vista === 'semana') return addCalendarDaysToYMD(ancla, dir * 7)
  return addCalendarDaysToYMD(ancla, dir)
}

export default function AtendidosStatsModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  const [tab, setTab] = useState<TabId>('calendario')
  const [vistaCal, setVistaCal] = useState<VistaCal>('mes')
  const [ancla, setAncla] = useState(hoy)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ventas, setVentas] = useState<VentaLite[]>([])
  const [atenciones, setAtenciones] = useState<AtencionLite[]>([])

  const rango = useMemo(() => {
    if (vistaCal === 'mes') {
      return { desde: startOfMonth(ancla), hasta: endOfMonth(ancla) }
    }
    if (vistaCal === 'semana') {
      return { desde: startOfWeekMonday(ancla), hasta: endOfWeekSunday(ancla) }
    }
    return { desde: ancla, hasta: ancla }
  }, [vistaCal, ancla])

  const tituloNav = useMemo(() => {
    if (vistaCal === 'mes') return monthTitle(ancla)
    if (vistaCal === 'semana') {
      return `${ymdLabel(rango.desde)} – ${ymdLabel(rango.hasta)}`
    }
    const { d, m, y } = ymdParts(ancla)
    return `${d} de ${MONTH_NAMES[m - 1] || ''} ${y}`
  }, [vistaCal, ancla, rango])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // Mes: cargar grilla completa; semana/día: mismo rango. Extra buffer 0.
    const { desde, hasta } = rango
    const atenDesde = `${desde}T00:00:00-03:00`
    const atenHasta = `${hasta}T23:59:59.999-03:00`

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [ventasRes, atenRes] = await Promise.all([
          apiService.obtenerVentas(undefined, desde, hasta, 'todos'),
          apiService.obtenerAtencionesMostrador(atenDesde, atenHasta)
        ])
        if (cancelled) return
        const ventasOk =
          ventasRes.success && ventasRes.data
            ? ventasRes.data
                .filter((v) => v.estado_pago !== 'Cancelado')
                .map((v) => ({
                  fecha_venta: String(v.fecha_venta || ''),
                  estado_pago: v.estado_pago
                }))
                .filter((v) => {
                  const key = isoToArgentinaDateKey(v.fecha_venta)
                  return key >= desde && key <= hasta
                })
            : []
        const atenOk =
          atenRes.success && atenRes.data
            ? atenRes.data.map((a) => ({
                fecha_atencion: String(a.fecha_atencion || ''),
                tipo: String(a.tipo || '')
              }))
            : []
        setVentas(ventasOk)
        setAtenciones(atenOk)
        if (!ventasRes.success && !atenRes.success) {
          setError('No se pudieron cargar las estadísticas.')
        }
      } catch {
        if (!cancelled) setError('Error de conexión al cargar estadísticas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, rango])

  const countsByDay = useMemo(() => {
    const map = new Map<string, DiaCount>()
    const ensure = (fecha: string) => {
      let row = map.get(fecha)
      if (!row) {
        row = { fecha, presencial: 0, virtual: 0, total: 0 }
        map.set(fecha, row)
      }
      return row
    }
    for (const v of ventas) {
      const fecha = isoToArgentinaDateKey(v.fecha_venta)
      if (!fecha) continue
      const row = ensure(fecha)
      row.presencial += 1
      row.total += 1
    }
    for (const a of atenciones) {
      if (a.tipo !== 'virtual') continue
      const fecha = isoToArgentinaDateKey(a.fecha_atencion)
      if (!fecha) continue
      const row = ensure(fecha)
      row.virtual += 1
      row.total += 1
    }
    return map
  }, [ventas, atenciones])

  const diasSerie = useMemo(() => {
    return daysBetweenInclusive(rango.desde, rango.hasta).map((fecha) => {
      const row = countsByDay.get(fecha)
      return {
        fecha,
        label: ymdLabel(fecha),
        presencial: row?.presencial || 0,
        virtual: row?.virtual || 0,
        total: row?.total || 0
      }
    })
  }, [rango, countsByDay])

  const horasSerie = useMemo(() => {
    const dia = vistaCal === 'dia' ? ancla : ancla
    const presencialByH: number[] = Array.from({ length: 24 }, () => 0)
    const virtualByH: number[] = Array.from({ length: 24 }, () => 0)
    for (const v of ventas) {
      if (isoToArgentinaDateKey(v.fecha_venta) !== dia) continue
      const h = argentinaHourFromIso(v.fecha_venta)
      if (h == null) continue
      presencialByH[h] += 1
    }
    for (const a of atenciones) {
      if (a.tipo !== 'virtual') continue
      if (isoToArgentinaDateKey(a.fecha_atencion) !== dia) continue
      const h = argentinaHourFromIso(a.fecha_atencion)
      if (h == null) continue
      virtualByH[h] += 1
    }
    return Array.from({ length: 24 }, (_, h) => ({
      hora: `${String(h).padStart(2, '0')}:00`,
      presencial: presencialByH[h],
      virtual: virtualByH[h],
      total: presencialByH[h] + virtualByH[h]
    })).filter((r) => r.hora >= '07:00' && r.hora <= '21:00')
  }, [ventas, atenciones, ancla, vistaCal])

  const resumen = useMemo(() => {
    const presencial = diasSerie.reduce((s, d) => s + d.presencial, 0)
    const virtual = diasSerie.reduce((s, d) => s + d.virtual, 0)
    const consulta = atenciones.filter((a) => a.tipo === 'consulta').length
    const ventaAten = atenciones.filter((a) => a.tipo === 'venta').length
    const total = presencial + virtual
    const diasConDatos = diasSerie.filter((d) => d.total > 0).length || 1
    const pico = [...diasSerie].sort((a, b) => b.total - a.total)[0] || null
    const promedio = total / Math.max(diasSerie.length, 1)
    const horaPico = [...horasSerie].sort((a, b) => b.total - a.total)[0] || null
    return {
      presencial,
      virtual,
      consulta,
      ventaAten,
      total,
      pico,
      promedio,
      diasConDatos,
      horaPico,
      pctPresencial: total > 0 ? (presencial / total) * 100 : 0,
      pctVirtual: total > 0 ? (virtual / total) * 100 : 0
    }
  }, [diasSerie, atenciones, horasSerie])

  const flujoMix = useMemo(
    () =>
      [
        { name: 'Presencial (ventas)', value: resumen.presencial, color: PIE_COLORS[0] },
        { name: 'Virtual', value: resumen.virtual, color: PIE_COLORS[1] }
      ].filter((x) => x.value > 0),
    [resumen.presencial, resumen.virtual]
  )

  const flujoTipos = useMemo(
    () =>
      [
        { name: 'Virtual', value: resumen.virtual, color: PIE_COLORS[1] },
        { name: 'Consulta', value: resumen.consulta, color: PIE_COLORS[2] },
        { name: 'Venta (manual)', value: resumen.ventaAten, color: PIE_COLORS[3] }
      ].filter((x) => x.value > 0),
    [resumen.virtual, resumen.consulta, resumen.ventaAten]
  )

  const maxDayTotal = useMemo(
    () => Math.max(1, ...diasSerie.map((d) => d.total)),
    [diasSerie]
  )

  const weekDays = useMemo(() => daysBetweenInclusive(startOfWeekMonday(ancla), endOfWeekSunday(ancla)), [ancla])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="atendidos-stats-modal" role="dialog" aria-modal="true" aria-label="Estadísticas de atendidos">
      <button type="button" className="atendidos-stats-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="atendidos-stats-modal__panel">
        <header className="atendidos-stats-modal__head">
          <div>
            <p className="atendidos-stats-modal__kicker">Mostrador</p>
            <h2>Atendidos · estadísticas</h2>
            <p className="atendidos-stats-modal__sub">
              Presencial = ventas · Virtual = atenciones cargadas a mano
            </p>
          </div>
          <button type="button" className="atendidos-stats-modal__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="atendidos-stats-modal__toolbar">
          <div className="atendidos-stats-modal__periodos" role="group" aria-label="Vista de calendario">
            {([
              { id: 'mes' as const, label: 'Mes' },
              { id: 'semana' as const, label: 'Semana' },
              { id: 'dia' as const, label: 'Día' }
            ]).map((v) => (
              <button
                key={v.id}
                type="button"
                className={`atendidos-stats-modal__chip${vistaCal === v.id ? ' is-active' : ''}`}
                onClick={() => {
                  setVistaCal(v.id)
                  setTab('calendario')
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <nav className="atendidos-stats-modal__tabs" aria-label="Vistas">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`atendidos-stats-modal__tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="atendidos-stats-modal__cal-nav" aria-label="Navegación de fechas">
          <button type="button" onClick={() => setAncla(shiftAncla(ancla, vistaCal, -1))} aria-label="Anterior">
            ←
          </button>
          <div className="atendidos-stats-modal__cal-nav-title">
            <strong>{tituloNav}</strong>
            <button type="button" className="atendidos-stats-modal__hoy" onClick={() => setAncla(hoy)}>
              Hoy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAncla(shiftAncla(ancla, vistaCal, 1))}
            aria-label="Siguiente"
            disabled={
              vistaCal === 'mes'
                ? startOfMonth(ancla) >= startOfMonth(hoy)
                : vistaCal === 'semana'
                  ? startOfWeekMonday(ancla) >= startOfWeekMonday(hoy)
                  : ancla >= hoy
            }
          >
            →
          </button>
        </div>

        <div className="atendidos-stats-modal__body">
          {loading ? (
            <p className="atendidos-stats-modal__loading">Cargando…</p>
          ) : error ? (
            <p className="atendidos-stats-modal__error">{error}</p>
          ) : (
            <>
              {tab === 'calendario' && (
                <section className="atendidos-stats-modal__section">
                  {vistaCal === 'mes' && (
                    <>
                      <div className="atendidos-cal-month" role="grid" aria-label={`Calendario ${tituloNav}`}>
                        <div className="atendidos-cal-month__head">
                          {WEEKDAYS.map((w) => (
                            <span key={w}>{w}</span>
                          ))}
                        </div>
                        {monthGrid(ancla).map((week, wi) => (
                          <div key={wi} className="atendidos-cal-month__week" role="row">
                            {week.map((fecha, di) => {
                              if (!fecha) {
                                return <div key={`e-${di}`} className="atendidos-cal-day atendidos-cal-day--empty" />
                              }
                              const row = countsByDay.get(fecha)
                              const total = row?.total || 0
                              const intensity = total / maxDayTotal
                              const isHoy = fecha === hoy
                              const isFuture = fecha > hoy
                              return (
                                <button
                                  key={fecha}
                                  type="button"
                                  role="gridcell"
                                  disabled={isFuture}
                                  className={`atendidos-cal-day${isHoy ? ' is-today' : ''}${fecha === ancla ? ' is-selected' : ''}${total > 0 ? ' has-data' : ''}`}
                                  style={
                                    total > 0
                                      ? {
                                          ['--cal-heat' as string]: String(0.12 + intensity * 0.55)
                                        }
                                      : undefined
                                  }
                                  onClick={() => {
                                    setAncla(fecha)
                                    setVistaCal('dia')
                                  }}
                                >
                                  <span className="atendidos-cal-day__num">{Number(fecha.slice(8, 10))}</span>
                                  {total > 0 ? (
                                    <span className="atendidos-cal-day__count">{total}</span>
                                  ) : (
                                    <span className="atendidos-cal-day__count atendidos-cal-day__count--zero">·</span>
                                  )}
                                  {total > 0 && (
                                    <span className="atendidos-cal-day__mini">
                                      <i className="is-p" title="Presencial">
                                        {row?.presencial || 0}
                                      </i>
                                      <i className="is-v" title="Virtual">
                                        {row?.virtual || 0}
                                      </i>
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="atendidos-stats-modal__chart atendidos-stats-modal__chart--compact">
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={diasSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={2} />
                            <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={28} />
                            <Tooltip
                              contentStyle={{
                                background: '#0f172a',
                                border: '1px solid rgba(148,163,184,0.25)',
                                borderRadius: 10
                              }}
                            />
                            <Bar dataKey="presencial" name="Presencial" stackId="a" fill="#38bdf8" />
                            <Bar dataKey="virtual" name="Virtual" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {vistaCal === 'semana' && (
                    <>
                      <div className="atendidos-cal-week" role="list">
                        {weekDays.map((fecha) => {
                          const row = countsByDay.get(fecha)
                          const total = row?.total || 0
                          const isHoy = fecha === hoy
                          const isFuture = fecha > hoy
                          const p = ymdParts(fecha)
                          const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
                          const dow = WEEKDAYS[wd === 0 ? 6 : wd - 1]
                          return (
                            <button
                              key={fecha}
                              type="button"
                              role="listitem"
                              disabled={isFuture}
                              className={`atendidos-cal-week-day${isHoy ? ' is-today' : ''}${fecha === ancla ? ' is-selected' : ''}`}
                              onClick={() => {
                                setAncla(fecha)
                                setVistaCal('dia')
                              }}
                            >
                              <span className="atendidos-cal-week-day__dow">{dow}</span>
                              <span className="atendidos-cal-week-day__num">{p.d}</span>
                              <strong className="atendidos-cal-week-day__total">{total}</strong>
                              <span className="atendidos-cal-week-day__split">
                                <em>P {row?.presencial || 0}</em>
                                <em>V {row?.virtual || 0}</em>
                              </span>
                              <span
                                className="atendidos-cal-week-day__bar"
                                style={{ height: `${Math.max(4, (total / maxDayTotal) * 72)}px` }}
                              />
                            </button>
                          )
                        })}
                      </div>
                      <div className="atendidos-stats-modal__chart atendidos-stats-modal__chart--compact">
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={diasSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={28} />
                            <Tooltip
                              contentStyle={{
                                background: '#0f172a',
                                border: '1px solid rgba(148,163,184,0.25)',
                                borderRadius: 10
                              }}
                            />
                            <Bar dataKey="presencial" name="Presencial" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="virtual" name="Virtual" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {vistaCal === 'dia' && (
                    <>
                      <div className="atendidos-cal-day-kpis">
                        <article>
                          <strong>{(countsByDay.get(ancla)?.total || 0)}</strong>
                          <span>Total</span>
                        </article>
                        <article>
                          <strong>{countsByDay.get(ancla)?.presencial || 0}</strong>
                          <span>Presencial</span>
                        </article>
                        <article>
                          <strong>{countsByDay.get(ancla)?.virtual || 0}</strong>
                          <span>Virtual</span>
                        </article>
                      </div>
                      <div className="atendidos-stats-modal__chart">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={horasSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                            <XAxis dataKey="hora" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={1} />
                            <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={28} />
                            <Tooltip
                              contentStyle={{
                                background: '#0f172a',
                                border: '1px solid rgba(148,163,184,0.25)',
                                borderRadius: 10
                              }}
                            />
                            <Bar dataKey="presencial" name="Presencial" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="virtual" name="Virtual" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </section>
              )}

              {tab === 'hora' && (
                <section className="atendidos-stats-modal__section">
                  <div className="atendidos-stats-modal__hora-head">
                    <h3>Por hora · {ymdLabel(ancla)}</h3>
                    <label>
                      Día
                      <input
                        type="date"
                        value={ancla}
                        max={hoy}
                        onChange={(e) => {
                          const v = e.target.value || hoy
                          setAncla(v)
                          setVistaCal('dia')
                        }}
                      />
                    </label>
                  </div>
                  <div className="atendidos-stats-modal__chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={horasSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                        <XAxis dataKey="hora" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={1} />
                        <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={28} />
                        <Tooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.25)',
                            borderRadius: 10
                          }}
                        />
                        <Bar dataKey="presencial" name="Presencial" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="virtual" name="Virtual" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {tab === 'flujos' && (
                <section className="atendidos-stats-modal__section atendidos-stats-modal__flujos">
                  <h3>Flujos · {tituloNav}</h3>
                  <div className="atendidos-stats-modal__pies">
                    <div className="atendidos-stats-modal__pie-card">
                      <h4>Canal</h4>
                      {flujoMix.length === 0 ? (
                        <p className="atendidos-stats-modal__empty">Sin datos</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={flujoMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                              {flujoMix.map((e) => (
                                <Cell key={e.name} fill={e.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: '#0f172a',
                                border: '1px solid rgba(148,163,184,0.25)',
                                borderRadius: 10
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                      <ul className="atendidos-stats-modal__legend">
                        {flujoMix.map((e) => (
                          <li key={e.name}>
                            <span style={{ background: e.color }} />
                            {e.name}: <strong>{e.value}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="atendidos-stats-modal__pie-card">
                      <h4>Atenciones manuales</h4>
                      {flujoTipos.length === 0 ? (
                        <p className="atendidos-stats-modal__empty">Sin atenciones cargadas</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={flujoTipos} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                              {flujoTipos.map((e) => (
                                <Cell key={e.name} fill={e.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: '#0f172a',
                                border: '1px solid rgba(148,163,184,0.25)',
                                borderRadius: 10
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                      <ul className="atendidos-stats-modal__legend">
                        {flujoTipos.map((e) => (
                          <li key={e.name}>
                            <span style={{ background: e.color }} />
                            {e.name}: <strong>{e.value}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="atendidos-stats-modal__funnel" aria-label="Mix presencial / virtual">
                    <div className="atendidos-stats-modal__funnel-track">
                      <div
                        className="atendidos-stats-modal__funnel-presencial"
                        style={{ width: `${Math.max(resumen.pctPresencial, resumen.total ? 2 : 0)}%` }}
                      />
                      <div
                        className="atendidos-stats-modal__funnel-virtual"
                        style={{ width: `${Math.max(resumen.pctVirtual, resumen.total ? 2 : 0)}%` }}
                      />
                    </div>
                    <p>
                      {resumen.pctPresencial.toFixed(0)}% presencial · {resumen.pctVirtual.toFixed(0)}% virtual
                    </p>
                  </div>
                </section>
              )}

              {tab === 'resumen' && (
                <section className="atendidos-stats-modal__section">
                  <h3>Estadísticas · {tituloNav}</h3>
                  <div className="atendidos-stats-modal__kpis">
                    <article>
                      <strong>{resumen.total}</strong>
                      <span>Total atendidos</span>
                    </article>
                    <article>
                      <strong>{resumen.presencial}</strong>
                      <span>Presencial</span>
                    </article>
                    <article>
                      <strong>{resumen.virtual}</strong>
                      <span>Virtual</span>
                    </article>
                    <article>
                      <strong>{resumen.promedio.toFixed(1)}</strong>
                      <span>Promedio / día</span>
                    </article>
                    <article>
                      <strong>{resumen.pico ? resumen.pico.total : 0}</strong>
                      <span>Pico diario{resumen.pico ? ` (${resumen.pico.label})` : ''}</span>
                    </article>
                    <article>
                      <strong>{resumen.horaPico && resumen.horaPico.total > 0 ? resumen.horaPico.hora : '—'}</strong>
                      <span>Hora pico ({ymdLabel(ancla)})</span>
                    </article>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="atendidos-stats-modal__foot">
          <button
            type="button"
            className="atendidos-stats-modal__link"
            onClick={() => {
              onClose()
              navigate('/mostrador/reportes')
            }}
          >
            Abrir reportes de mostrador
          </button>
          <button type="button" className="atendidos-stats-modal__done" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
