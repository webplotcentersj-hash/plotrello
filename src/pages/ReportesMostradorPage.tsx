import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { OrdenTrabajo } from '../types/api'
import {
  getArgentinaDateString,
  isoToArgentinaDateKey
} from '../utils/dateUtils'
import './ReportesMostradorPage.css'

type TipoAtencion = 'virtual' | 'consulta' | 'venta'
type PeriodoId = 'hoy' | 'semana' | 'mes' | 'custom'

type Atencion = {
  id: number
  cliente_nombre: string
  tipo: TipoAtencion
  orden_id?: number
  usuario_id: number
  usuario_nombre: string
  timestamp: string
  notas?: string
}

type EmpleadoRendimiento = {
  usuario_id: number
  nombre: string
  total: number
  virtual: number
  consulta: number
  venta: number
  /** Promedio estimado entre clientes (minutos). */
  demoraPromedioMin: number | null
  muestrasDemora: number
}

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

const DEMora_MIN_SEG = 30
const DEMora_MAX_SEG = 45 * 60

function ymdParts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  return { y: y || 0, m: m || 1, d: d || 1 }
}

function addCalendarDaysToYMD(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  u.setUTCDate(u.getUTCDate() + deltaDays)
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(
    u.getUTCDate()
  ).padStart(2, '0')}`
}

function startOfWeekMonday(ymd: string): string {
  const { y, m, d } = ymdParts(ymd)
  const u = new Date(Date.UTC(y, m - 1, d))
  const dow = u.getUTCDay()
  const delta = dow === 0 ? -6 : 1 - dow
  u.setUTCDate(u.getUTCDate() + delta)
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(
    u.getUTCDate()
  ).padStart(2, '0')}`
}

function endOfWeekSunday(ymd: string): string {
  return addCalendarDaysToYMD(startOfWeekMonday(ymd), 6)
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

function labelYmd(ymd: string): string {
  const { y, m, d } = ymdParts(ymd)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

function rangoDesdePeriodo(periodo: PeriodoId, ancla: string): { desde: string; hasta: string } {
  if (periodo === 'hoy') return { desde: ancla, hasta: ancla }
  if (periodo === 'semana') return { desde: startOfWeekMonday(ancla), hasta: endOfWeekSunday(ancla) }
  if (periodo === 'mes') return { desde: startOfMonth(ancla), hasta: endOfMonth(ancla) }
  return { desde: ancla, hasta: ancla }
}

function fmtDemora(min: number | null): string {
  if (min == null || !Number.isFinite(min)) return '—'
  if (min < 1) return `${Math.round(min * 60)} s`
  if (min < 60) return `${min.toFixed(1)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}h ${m}m`
}

function fmtFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function rendimientoPorEmpleado(atenciones: Atencion[]): EmpleadoRendimiento[] {
  const byUser = new Map<number, Atencion[]>()
  for (const a of atenciones) {
    const list = byUser.get(a.usuario_id) || []
    list.push(a)
    byUser.set(a.usuario_id, list)
  }

  const out: EmpleadoRendimiento[] = []
  for (const [usuario_id, list] of byUser) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    const gaps: number[] = []
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const delta =
        (new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) /
        1000
      if (delta >= DEMora_MIN_SEG && delta <= DEMora_MAX_SEG) gaps.push(delta)
    }
    const demoraPromedioMin =
      gaps.length > 0 ? gaps.reduce((s, x) => s + x, 0) / gaps.length / 60 : null
    out.push({
      usuario_id,
      nombre: sorted[0]?.usuario_nombre || `Usuario #${usuario_id}`,
      total: sorted.length,
      virtual: sorted.filter((a) => a.tipo === 'virtual').length,
      consulta: sorted.filter((a) => a.tipo === 'consulta').length,
      venta: sorted.filter((a) => a.tipo === 'venta').length,
      demoraPromedioMin,
      muestrasDemora: gaps.length
    })
  }
  return out.sort((a, b) => b.total - a.total)
}

const ReportesMostradorPage = () => {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  const [periodo, setPeriodo] = useState<PeriodoId>('hoy')
  const [ancla, setAncla] = useState(hoy)
  const [fechaInicio, setFechaInicio] = useState(hoy)
  const [fechaFin, setFechaFin] = useState(hoy)
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [ventasCount, setVentasCount] = useState(0)
  const [reporteRef, setReporteRef] = useState<HTMLDivElement | null>(null)

  const rango = useMemo(() => {
    if (periodo === 'custom') return { desde: fechaInicio, hasta: fechaFin }
    return rangoDesdePeriodo(periodo, ancla)
  }, [periodo, ancla, fechaInicio, fechaFin])

  const tituloPeriodo = useMemo(() => {
    if (periodo === 'hoy') return `Hoy · ${labelYmd(rango.desde)}`
    if (periodo === 'semana') return `Semana · ${labelYmd(rango.desde)} – ${labelYmd(rango.hasta)}`
    if (periodo === 'mes') {
      const { y, m } = ymdParts(rango.desde)
      return `Mes · ${MONTH_NAMES[m - 1] || ''} ${y}`
    }
    return `Personalizado · ${labelYmd(rango.desde)} – ${labelYmd(rango.hasta)}`
  }, [periodo, rango])

  const loadDatos = useCallback(async () => {
    setLoading(true)
    try {
      const atenDesde = `${rango.desde}T00:00:00-03:00`
      const atenHasta = `${rango.hasta}T23:59:59.999-03:00`

      const [ordenesResponse, atencionesResponse, ventasResponse] = await Promise.all([
        apiService.getOrdenes({ skipInFlightDedupe: true, soloActivasEnTablero: false }),
        apiService.obtenerAtencionesMostrador(atenDesde, atenHasta),
        apiService.obtenerVentas(undefined, rango.desde, rango.hasta, 'todos')
      ])

      if (ordenesResponse.success && ordenesResponse.data) {
        const ordenesFiltradas = ordenesResponse.data.filter((orden) => {
          if (!orden.fecha_creacion) return false
          const key = isoToArgentinaDateKey(String(orden.fecha_creacion))
          return key >= rango.desde && key <= rango.hasta
        })
        setOrdenes(ordenesFiltradas)
      } else {
        setOrdenes([])
      }

      if (atencionesResponse.success && atencionesResponse.data) {
        setAtenciones(
          atencionesResponse.data.map((atencion) => ({
            id: atencion.id,
            cliente_nombre: atencion.cliente_nombre,
            tipo: atencion.tipo,
            orden_id: atencion.orden_id || undefined,
            usuario_id: atencion.usuario_id,
            usuario_nombre: atencion.usuario_nombre,
            timestamp: atencion.fecha_atencion,
            notas: atencion.notas || undefined
          }))
        )
      } else {
        setAtenciones([])
      }

      if (ventasResponse.success && ventasResponse.data) {
        setVentasCount(
          ventasResponse.data.filter((v) => {
            if (v.estado_pago === 'Cancelado') return false
            const key = isoToArgentinaDateKey(String(v.fecha_venta || ''))
            return key >= rango.desde && key <= rango.hasta
          }).length
        )
      } else {
        setVentasCount(0)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      setOrdenes([])
      setAtenciones([])
      setVentasCount(0)
    } finally {
      setLoading(false)
    }
  }, [rango.desde, rango.hasta])

  useEffect(() => {
    void loadDatos()
  }, [loadDatos])

  const metricas = useMemo(() => {
    const ordenesCreadas = ordenes.length
    const ordenesEntregadas = ordenes.filter((o) => o.estado === 'Entregado o Instalado').length
    const totalAtenciones = atenciones.length
    const atencionesVirtuales = atenciones.filter((a) => a.tipo === 'virtual').length
    const consultas = atenciones.filter((a) => a.tipo === 'consulta').length
    const ventasManuales = atenciones.filter((a) => a.tipo === 'venta').length
    return {
      ordenesCreadas,
      ordenesEntregadas,
      totalAtenciones,
      atencionesVirtuales,
      consultas,
      ventasManuales,
      ventasSistema: ventasCount,
      enProceso: Math.max(0, ordenesCreadas - ordenesEntregadas),
      tasaEntrega:
        ordenesCreadas > 0 ? ((ordenesEntregadas / ordenesCreadas) * 100).toFixed(1) : '0'
    }
  }, [ordenes, atenciones, ventasCount])

  const porEmpleado = useMemo(() => rendimientoPorEmpleado(atenciones), [atenciones])

  const demoraEquipo = useMemo(() => {
    const conDatos = porEmpleado.filter((e) => e.demoraPromedioMin != null && e.muestrasDemora > 0)
    if (conDatos.length === 0) return null
    const weighted =
      conDatos.reduce((s, e) => s + (e.demoraPromedioMin || 0) * e.muestrasDemora, 0) /
      conDatos.reduce((s, e) => s + e.muestrasDemora, 0)
    return weighted
  }, [porEmpleado])

  const aplicarPeriodo = (id: PeriodoId) => {
    const base = getArgentinaDateString()
    setPeriodo(id)
    setAncla(base)
    if (id !== 'custom') {
      const r = rangoDesdePeriodo(id, base)
      setFechaInicio(r.desde)
      setFechaFin(r.hasta)
    }
  }

  const generarReportePDF = async () => {
    if (!reporteRef) return
    try {
      const canvas = await html2canvas(reporteRef, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a'
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height)
      const imgScaledWidth = canvas.width * ratio
      const imgScaledHeight = canvas.height * ratio
      pdf.addImage(
        imgData,
        'PNG',
        (pdfWidth - imgScaledWidth) / 2,
        8,
        imgScaledWidth,
        imgScaledHeight
      )
      pdf.save(`Reporte_Mostrador_${rango.desde}_${rango.hasta}.pdf`)
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el reporte PDF')
    }
  }

  if (loading) {
    return (
      <div className="reportes-mostrador-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Cargando reportes…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="reportes-mostrador-page">
      <header className="rm-header">
        <div>
          <p className="rm-header__eyebrow">Mostrador</p>
          <h1>Reportes de atención</h1>
          <p className="rm-header__sub">{tituloPeriodo}</p>
        </div>
        <div className="rm-header__actions">
          <button type="button" className="rm-btn rm-btn--ghost" onClick={() => navigate('/mostrador/dashboard')}>
            ← Dashboard
          </button>
          <button type="button" className="rm-btn rm-btn--primary" onClick={() => void generarReportePDF()}>
            Descargar PDF
          </button>
        </div>
      </header>

      <section className="rm-period" aria-label="Período del reporte">
        <div className="rm-period__tabs" role="tablist">
          {(
            [
              ['hoy', 'Hoy'],
              ['semana', 'Semana'],
              ['mes', 'Mes'],
              ['custom', 'Personalizado']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={periodo === id}
              className={`rm-period__tab${periodo === id ? ' is-on' : ''}`}
              onClick={() => aplicarPeriodo(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {periodo === 'custom' ? (
          <div className="rm-period__custom">
            <label>
              Desde
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </label>
          </div>
        ) : periodo !== 'hoy' ? (
          <div className="rm-period__nav">
            <button
              type="button"
              className="rm-btn rm-btn--ghost rm-btn--sm"
              onClick={() => {
                const next =
                  periodo === 'semana'
                    ? addCalendarDaysToYMD(ancla, -7)
                    : addCalendarDaysToYMD(startOfMonth(ancla), -1)
                setAncla(next)
              }}
            >
              ← Anterior
            </button>
            <span>{tituloPeriodo}</span>
            <button
              type="button"
              className="rm-btn rm-btn--ghost rm-btn--sm"
              onClick={() => {
                const next =
                  periodo === 'semana'
                    ? addCalendarDaysToYMD(ancla, 7)
                    : (() => {
                        const { y, m } = ymdParts(ancla)
                        const nm = m === 12 ? 1 : m + 1
                        const ny = m === 12 ? y + 1 : y
                        return `${ny}-${String(nm).padStart(2, '0')}-01`
                      })()
                setAncla(next)
              }}
            >
              Siguiente →
            </button>
          </div>
        ) : null}
      </section>

      <div ref={setReporteRef} className="rm-report">
        <section className="rm-kpis" aria-label="Métricas principales">
          <article className="rm-kpi rm-kpi--accent">
            <span className="rm-kpi__label">Personas atendidas</span>
            <strong className="rm-kpi__value">{metricas.totalAtenciones}</strong>
            <em className="rm-kpi__hint">Registros de atención en el período</em>
          </article>
          <article className="rm-kpi rm-kpi--violet">
            <span className="rm-kpi__label">Virtual</span>
            <strong className="rm-kpi__value">{metricas.atencionesVirtuales}</strong>
            <em className="rm-kpi__hint">Atenciones cargadas como virtual</em>
          </article>
          <article className="rm-kpi rm-kpi--amber">
            <span className="rm-kpi__label">Consultas</span>
            <strong className="rm-kpi__value">{metricas.consultas}</strong>
            <em className="rm-kpi__hint">Solo consulta</em>
          </article>
          <article className="rm-kpi rm-kpi--green">
            <span className="rm-kpi__label">Ventas (manual + sistema)</span>
            <strong className="rm-kpi__value">
              {metricas.ventasManuales}
              <small> / {metricas.ventasSistema}</small>
            </strong>
            <em className="rm-kpi__hint">Manual · ventas CRM</em>
          </article>
          <article className="rm-kpi rm-kpi--sky">
            <span className="rm-kpi__label">Órdenes creadas</span>
            <strong className="rm-kpi__value">{metricas.ordenesCreadas}</strong>
            <em className="rm-kpi__hint">{metricas.ordenesEntregadas} entregadas · {metricas.tasaEntrega}%</em>
          </article>
          <article className="rm-kpi rm-kpi--rose">
            <span className="rm-kpi__label">Demora media equipo</span>
            <strong className="rm-kpi__value">{fmtDemora(demoraEquipo)}</strong>
            <em className="rm-kpi__hint">Entre cliente y cliente (hasta 45 min)</em>
          </article>
        </section>

        <section className="rm-empleados" aria-labelledby="rm-emp-title">
          <header className="rm-section-head">
            <div>
              <h2 id="rm-emp-title">Rendimiento por empleado</h2>
              <p>Promedio estimado de demora entre atenciones consecutivas del mismo operador.</p>
            </div>
          </header>
          {porEmpleado.length === 0 ? (
            <p className="rm-empty">Sin atenciones en este período.</p>
          ) : (
            <div className="rm-empleados__table-wrap">
              <table className="rm-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th className="num">Atenciones</th>
                    <th className="num">Virtual</th>
                    <th className="num">Consulta</th>
                    <th className="num">Venta</th>
                    <th className="num">Demora promedio</th>
                    <th className="num">Muestras</th>
                  </tr>
                </thead>
                <tbody>
                  {porEmpleado.map((e) => (
                    <tr key={e.usuario_id}>
                      <td>
                        <strong>{e.nombre}</strong>
                      </td>
                      <td className="num">{e.total}</td>
                      <td className="num">{e.virtual}</td>
                      <td className="num">{e.consulta}</td>
                      <td className="num">{e.venta}</td>
                      <td className="num">
                        <span className="rm-demora">{fmtDemora(e.demoraPromedioMin)}</span>
                      </td>
                      <td className="num">{e.muestrasDemora || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rm-detalle" aria-labelledby="rm-det-title">
          <header className="rm-section-head">
            <div>
              <h2 id="rm-det-title">Detalle de atenciones ({atenciones.length})</h2>
              <p>Listado del período seleccionado · ordenado del más reciente al más antiguo.</p>
            </div>
          </header>
          {atenciones.length === 0 ? (
            <p className="rm-empty">No hay atenciones para mostrar.</p>
          ) : (
            <div className="rm-detalle__table-wrap">
              <table className="rm-table">
                <thead>
                  <tr>
                    <th>Fecha/Hora</th>
                    <th>Tipo</th>
                    <th>Cliente</th>
                    <th>OP</th>
                    <th>Usuario</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {[...atenciones]
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    )
                    .map((atencion) => (
                      <tr key={atencion.id}>
                        <td className="rm-nowrap">{fmtFechaHora(atencion.timestamp)}</td>
                        <td>
                          <span className={`rm-badge rm-badge--${atencion.tipo}`}>
                            {atencion.tipo === 'virtual' && 'Virtual'}
                            {atencion.tipo === 'consulta' && 'Consulta'}
                            {atencion.tipo === 'venta' && 'Venta'}
                          </span>
                        </td>
                        <td>{atencion.cliente_nombre}</td>
                        <td>{atencion.orden_id ? `OP ${atencion.orden_id}` : '—'}</td>
                        <td>{atencion.usuario_nombre}</td>
                        <td className="rm-notas">{atencion.notas || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default ReportesMostradorPage
