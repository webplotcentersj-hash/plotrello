import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import apiService from '../services/api'
import type { Asistencia, RrhhRelojReporteSemanal, UsuarioRecord } from '../types/api'
import { sanitizeHtml } from '../utils/sanitizeHtml'
import { exportReportesHorariosPdf } from '../utils/exportReportesHorariosPdf'
import {
  parseSnapshotReloj,
  type RelojResumenCompacto
} from '../utils/relojReporteSnapshot'
import { formatHoras } from '../services/relojBiometricoService'
import './RrhhHorariosReportesTab.css'

type RrhhHorariosReportesTabProps = {
  usuarios: UsuarioRecord[]
  asistencia: Asistencia[]
  fechaDesde: string
  fechaHasta: string
  usuarioSeleccionado: number | null
  onIrAReloj: (reporte?: RrhhRelojReporteSemanal) => void
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444']

const RrhhHorariosReportesTab = ({
  usuarios,
  asistencia,
  fechaDesde,
  fechaHasta,
  usuarioSeleccionado,
  onIrAReloj
}: RrhhHorariosReportesTabProps) => {
  const [reportes, setReportes] = useState<RrhhRelojReporteSemanal[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [soloConTardanzas, setSoloConTardanzas] = useState(false)
  const [informeIaVer, setInformeIaVer] = useState<{ periodo: string; html: string; titulo: string } | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    void apiService.listarRelojReportesSemanales(fechaDesde, fechaHasta).then((r) => {
      if (!cancel && r.success && r.data) setReportes(r.data)
      if (!cancel) setLoading(false)
    })
    return () => {
      cancel = true
    }
  }, [fechaDesde, fechaHasta])

  const nombreUsuario = useMemo(() => {
    const m = new Map<number, string>()
    usuarios.forEach((u) => m.set(u.id, u.nombre))
    return m
  }, [usuarios])

  const filasAgregadas = useMemo(() => {
    const map = new Map<string, RelojResumenCompacto>()
    for (const rep of reportes) {
      const snap = parseSnapshotReloj(rep.payload)
      if (!snap?.resumenesCompactos?.length) continue
      for (const r of snap.resumenesCompactos) {
        const prev = map.get(r.idUsuario)
        if (!prev) {
          map.set(r.idUsuario, { ...r })
        } else {
          map.set(r.idUsuario, {
            ...prev,
            totalHoras: prev.totalHoras + r.totalHoras,
            totalExtra: prev.totalExtra + r.totalExtra,
            tardanzas: prev.tardanzas + r.tardanzas,
            anomalias: prev.anomalias + r.anomalias,
            diasTrabajados: prev.diasTrabajados + r.diasTrabajados,
            puntualidadPct: Math.round((prev.puntualidadPct + r.puntualidadPct) / 2)
          })
        }
      }
    }
    return [...map.values()].sort((a, b) => b.totalHoras - a.totalHoras)
  }, [reportes])

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filasAgregadas.filter((r) => {
      if (soloConTardanzas && r.tardanzas === 0) return false
      if (!q) return true
      return r.nombre.toLowerCase().includes(q) || r.departamento.toLowerCase().includes(q)
    })
  }, [filasAgregadas, busqueda, soloConTardanzas])

  const kpis = useMemo(() => {
    const horasAsistencia = asistencia.reduce((s, a) => s + (a.horas_trabajadas || 0), 0)
    const agg = filasAgregadas.reduce(
      (acc, r) => {
        acc.horas += r.totalHoras
        acc.extra += r.totalExtra
        acc.tardanzas += r.tardanzas
        acc.anomalias += r.anomalias
        return acc
      },
      { horas: 0, extra: 0, tardanzas: 0, anomalias: 0 }
    )
    return {
      empleados: filasAgregadas.length,
      horas: agg.horas || horasAsistencia,
      extra: agg.extra,
      tardanzas: agg.tardanzas,
      anomalias: agg.anomalias,
      informesReloj: reportes.length,
      registrosAsistencia: asistencia.length
    }
  }, [filasAgregadas, asistencia, reportes.length])

  const chartHoras = useMemo(
    () =>
      filasFiltradas.slice(0, 12).map((r) => ({
        nombre: r.nombre.split(/\s+/).slice(0, 2).join(' '),
        Normales: Math.round((r.totalHoras - r.totalExtra) * 10) / 10,
        Extra: Math.round(r.totalExtra * 10) / 10
      })),
    [filasFiltradas]
  )

  const chartDistribucion = useMemo(() => {
    let puntual = 0
    let tarde = 0
    let anomalia = 0
    for (const r of filasAgregadas) {
      tarde += r.tardanzas
      anomalia += r.anomalias
      puntual += Math.max(0, r.diasTrabajados - r.tardanzas - r.anomalias)
    }
    return [
      { name: 'Puntual', value: puntual, color: COLORS[0] },
      { name: 'Tarde', value: tarde, color: COLORS[1] },
      { name: 'Anomalías', value: anomalia, color: COLORS[2] }
    ].filter((d) => d.value > 0)
  }, [filasAgregadas])

  const informesIa = useMemo(() => {
    const list: { reporte: RrhhRelojReporteSemanal; periodo: string; titulo: string; html: string }[] = []
    for (const rep of reportes) {
      const snap = parseSnapshotReloj(rep.payload)
      if (!snap?.informeIa?.trim()) continue
      list.push({
        reporte: rep,
        periodo: `${rep.periodo_desde} → ${rep.periodo_hasta}`,
        titulo: snap.fileName || rep.archivo_nombre || 'Informe reloj',
        html: marked.parse(snap.informeIa) as string
      })
    }
    return list
  }, [reportes])

  const exportPdf = () => {
    exportReportesHorariosPdf({
      periodoDesde: fechaDesde,
      periodoHasta: fechaHasta,
      kpis: {
        empleados: kpis.empleados,
        horas: kpis.horas,
        extra: kpis.extra,
        tardanzas: kpis.tardanzas,
        anomalias: kpis.anomalias,
        informesReloj: kpis.informesReloj
      },
      filas: filasFiltradas,
      informesIa: informesIa.map((i) => ({
        periodo: i.periodo,
        titulo: i.titulo,
        extracto: i.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }))
    })
  }

  return (
    <div className="rrhh-reportes-panel">
      <div className="rrhh-section-header">
        <div>
          <h2>📊 Reportes de asistencia</h2>
          <p className="rrhh-reportes-sub">
            Consolidado desde informes semanales del reloj biométrico ({fechaDesde} → {fechaHasta}).
            Incluye informes PlotAI guardados al importar.
          </p>
        </div>
        <div className="rrhh-reportes-actions">
          <button type="button" className="btn-secondary" onClick={() => onIrAReloj()}>
            🕒 Ir al reloj
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={exportPdf}
            disabled={!filasFiltradas.length && !reportes.length}
          >
            ⬇️ Exportar PDF
          </button>
        </div>
      </div>

      <div className="rrhh-reportes-toolbar">
        <input
          type="search"
          className="rrhh-reportes-search"
          placeholder="Buscar colaborador o área…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label className="rrhh-reportes-check">
          <input
            type="checkbox"
            checked={soloConTardanzas}
            onChange={(e) => setSoloConTardanzas(e.target.checked)}
          />
          Solo con tardanzas
        </label>
        {usuarioSeleccionado ? (
          <span className="rrhh-reportes-hint">
            Filtro global: {nombreUsuario.get(usuarioSeleccionado) ?? usuarioSeleccionado}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="rrhh-reportes-loading">Cargando informes del reloj…</p>
      ) : reportes.length === 0 ? (
        <div className="rrhh-info-box">
          <p>No hay informes del reloj en este período. Importá un Excel en la pestaña Reloj.</p>
          <button type="button" className="btn-primary" onClick={() => onIrAReloj()}>
            📂 Importar reloj
          </button>
        </div>
      ) : (
        <>
          <div className="rrhh-reportes-kpis">
            <article className="rrhh-reportes-kpi">
              <span className="rrhh-reportes-kpi-val">{kpis.empleados}</span>
              <span className="rrhh-reportes-kpi-lbl">Colaboradores</span>
            </article>
            <article className="rrhh-reportes-kpi">
              <span className="rrhh-reportes-kpi-val">{formatHoras(kpis.horas)}</span>
              <span className="rrhh-reportes-kpi-lbl">Horas totales</span>
            </article>
            <article className="rrhh-reportes-kpi rrhh-reportes-kpi--extra">
              <span className="rrhh-reportes-kpi-val">{formatHoras(kpis.extra)}</span>
              <span className="rrhh-reportes-kpi-lbl">Horas extra</span>
            </article>
            <article className="rrhh-reportes-kpi rrhh-reportes-kpi--tarde">
              <span className="rrhh-reportes-kpi-val">{kpis.tardanzas}</span>
              <span className="rrhh-reportes-kpi-lbl">Tardanzas</span>
            </article>
            <article className="rrhh-reportes-kpi rrhh-reportes-kpi--warn">
              <span className="rrhh-reportes-kpi-val">{kpis.anomalias}</span>
              <span className="rrhh-reportes-kpi-lbl">Anomalías</span>
            </article>
            <article className="rrhh-reportes-kpi">
              <span className="rrhh-reportes-kpi-val">{kpis.informesReloj}</span>
              <span className="rrhh-reportes-kpi-lbl">Informes semanales</span>
            </article>
          </div>

          <div className="rrhh-reportes-charts">
            {chartHoras.length > 0 ? (
              <div className="rrhh-reportes-chart">
                <h3>Horas por colaborador (top 12)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartHoras} margin={{ bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="nombre" angle={-30} textAnchor="end" height={50} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Normales" stackId="h" fill="#3b82f6" />
                    <Bar dataKey="Extra" stackId="h" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            {chartDistribucion.length > 0 ? (
              <div className="rrhh-reportes-chart">
                <h3>Distribución de marcaciones</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={chartDistribucion} dataKey="value" nameKey="name" outerRadius={90} label>
                      {chartDistribucion.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>

          <div className="rrhh-reportes-tabla-wrap">
            <h3>Detalle por colaborador</h3>
            <table className="rrhh-reportes-tabla">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Área</th>
                  <th>Horas</th>
                  <th>Extra</th>
                  <th>Tard.</th>
                  <th>Punt.</th>
                  <th>Anom.</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Sin resultados para el filtro.</td>
                  </tr>
                ) : (
                  filasFiltradas.map((r) => (
                    <tr key={r.idUsuario}>
                      <td>{r.nombre}</td>
                      <td>{r.departamento || '—'}</td>
                      <td>{formatHoras(r.totalHoras)}</td>
                      <td>{formatHoras(r.totalExtra)}</td>
                      <td>{r.tardanzas}</td>
                      <td>{r.puntualidadPct}%</td>
                      <td>{r.anomalias || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rrhh-reportes-semanas">
            <h3>Informes semanales guardados</h3>
            <ul className="rrhh-reportes-semanas-list">
              {reportes.map((rep) => (
                <li key={rep.id}>
                  <button type="button" className="rrhh-reportes-semana-btn" onClick={() => onIrAReloj(rep)}>
                    <span>
                      📅 {rep.periodo_desde} → {rep.periodo_hasta}
                    </span>
                    <span className="rrhh-reportes-semana-meta">
                      {rep.archivo_nombre || 'Importación reloj'}
                      {parseSnapshotReloj(rep.payload)?.informeIa ? ' · 🤖 PlotAI' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {informesIa.length > 0 ? (
            <div className="rrhh-reportes-ia">
              <h3>🤖 Informes PlotAI guardados</h3>
              <ul>
                {informesIa.map((ia, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      className="rrhh-reportes-ia-btn"
                      onClick={() => setInformeIaVer({ periodo: ia.periodo, html: ia.html, titulo: ia.titulo })}
                    >
                      <strong>{ia.periodo}</strong> — {ia.titulo}
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => onIrAReloj(ia.reporte)}>
                      Ver informe completo
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {informeIaVer ? (
        <div className="rrhh-reportes-ia-modal" role="dialog">
          <div className="rrhh-reportes-ia-modal-inner">
            <div className="rrhh-reportes-ia-modal-head">
              <h3>🤖 PlotAI — {informeIaVer.periodo}</h3>
              <button type="button" onClick={() => setInformeIaVer(null)}>
                ✕
              </button>
            </div>
            <div
              className="rrhh-reportes-ia-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(informeIaVer.html) }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default RrhhHorariosReportesTab
