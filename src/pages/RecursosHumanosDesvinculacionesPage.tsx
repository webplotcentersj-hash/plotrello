import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioBajaLog } from '../types/api'
import {
  calcularEstadisticasDesvinculaciones,
  labelPeriodoDesvinculaciones,
  type LegajoContextoBaja,
  type PeriodoDesvinculaciones
} from '../utils/rrhhDesvinculacionesStats'
import { calcularIndicadoresPersonal, fmtRotacion } from '../utils/rrhhPersonalStats'
import './RecursosHumanosDesvinculacionesPage.css'

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

const RecursosHumanosDesvinculacionesPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [loading, setLoading] = useState(true)
  const [bajas, setBajas] = useState<UsuarioBajaLog[]>([])
  const [legajos, setLegajos] = useState<Record<number, LegajoContextoBaja>>({})
  const [activos, setActivos] = useState(0)
  const [periodo, setPeriodo] = useState<PeriodoDesvinculaciones>('12m')
  const [cargaError, setCargaError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh/dashboard')
      return
    }
    void loadData()
  }, [canAccess, navigate, authLoading])

  const loadData = async () => {
    setLoading(true)
    setCargaError(null)
    try {
      const [bajasRes, legajosRes, usuariosRes] = await Promise.all([
        apiService.getUsuariosBajasLog(),
        apiService.obtenerLegajosBasico(),
        apiService.getUsuarios()
      ])

      if (bajasRes.success && bajasRes.data) {
        setBajas(bajasRes.data)
      } else {
        setCargaError(bajasRes.error || 'No se pudieron cargar las bajas')
      }

      if (legajosRes.success && legajosRes.data) {
        const map: Record<number, LegajoContextoBaja> = {}
        for (const [id, row] of Object.entries(legajosRes.data)) {
          map[Number(id)] = {
            sector: row.sector,
            fecha_ingreso: row.fecha_ingreso
          }
        }
        setLegajos(map)
      }

      if (usuariosRes.success && usuariosRes.data) {
        setActivos(usuariosRes.data.length)
      }
    } catch (e) {
      console.error(e)
      setCargaError('Error al cargar el historial de desvinculaciones')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(
    () => calcularEstadisticasDesvinculaciones(bajas, legajos, periodo),
    [bajas, legajos, periodo]
  )

  const indicadores = useMemo(
    () => calcularIndicadoresPersonal(activos, bajas),
    [activos, bajas]
  )

  if (loading) {
    return (
      <div className="rrhh-desv-loading">
        <div className="spinner" />
        <p>Cargando historial de desvinculaciones…</p>
      </div>
    )
  }

  return (
    <div className="rrhh-desv-page">
      <header className="rrhh-desv-header">
        <div className="rrhh-desv-header-row">
          <div>
            <p className="rrhh-desv-breadcrumb">Recursos Humanos / Historial de desvinculaciones</p>
            <h1>📉 Historial de desvinculaciones</h1>
            <p className="rrhh-desv-subtitle">
              Tendencias de bajas, antigüedad y sectores para decisiones de liderazgo y clima laboral.
            </p>
          </div>
          <div className="rrhh-desv-header-actions">
            <select
              className="rrhh-desv-periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoDesvinculaciones)}
            >
              <option value="12m">Últimos 12 meses</option>
              <option value="24m">Últimos 24 meses</option>
              <option value="36m">Últimos 36 meses</option>
              <option value="todo">Histórico completo</option>
            </select>
            <button type="button" className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-desv-content">
        {cargaError ? <p className="rrhh-desv-error">{cargaError}</p> : null}

        <p className="rrhh-desv-context">
          Período: <strong>{labelPeriodoDesvinculaciones(periodo)}</strong>
          {' · '}
          {stats.totalBajas} baja{stats.totalBajas === 1 ? '' : 's'} en el período
          {' · '}
          Rotación anual actual: {fmtRotacion(indicadores.rotacionAnual)}
        </p>

        <section className="rrhh-desv-kpis" aria-label="Indicadores de desvinculación">
          <article className="rrhh-desv-kpi">
            <span className="rrhh-desv-kpi-value">{stats.totalBajas}</span>
            <span className="rrhh-desv-kpi-label">Bajas en el período</span>
          </article>
          <article className="rrhh-desv-kpi">
            <span className="rrhh-desv-kpi-value">{stats.antiguedadPromedioLabel}</span>
            <span className="rrhh-desv-kpi-label">Antigüedad promedio al egreso</span>
          </article>
          <article className="rrhh-desv-kpi">
            <span className="rrhh-desv-kpi-value">{stats.tipoMasFrecuente ?? '—'}</span>
            <span className="rrhh-desv-kpi-label">Tipo más frecuente</span>
          </article>
          <article className="rrhh-desv-kpi">
            <span className="rrhh-desv-kpi-value">{stats.sectorMasAfectado ?? '—'}</span>
            <span className="rrhh-desv-kpi-label">Sector con más bajas</span>
          </article>
        </section>

        {stats.totalBajas === 0 ? (
          <div className="rrhh-desv-empty">
            <p>No hay desvinculaciones registradas en el período seleccionado.</p>
            <button type="button" className="btn-secondary" onClick={() => navigate('/rrhh/usuarios')}>
              Ir a gestión de usuarios
            </button>
          </div>
        ) : (
          <>
            <div className="rrhh-desv-charts">
              <div className="rrhh-desv-chart-card rrhh-desv-chart-card--wide">
                <h2>Evolución mensual de desvinculaciones</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={stats.evolucionMensual}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="mesLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cantidad"
                      name="Bajas"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rrhh-desv-chart-card">
                <h2>Motivos (tipo de desvinculación)</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats.porTipo}
                      dataKey="cantidad"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) =>
                        `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                    >
                      {stats.porTipo.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="rrhh-desv-chart-card">
                <h2>Sector de procedencia</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.porSector} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="sector"
                      width={120}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8
                      }}
                    />
                    <Bar dataKey="cantidad" name="Bajas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <section className="rrhh-desv-tipos-table-section">
              <h2>Detalle por tipo de desvinculación</h2>
              <div className="rrhh-desv-table-wrap">
                <table className="rrhh-desv-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                      <th>% del período</th>
                      <th>Distribución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.porTipo.map((t) => (
                      <tr key={t.tipo}>
                        <td>{t.label}</td>
                        <td>{t.cantidad}</td>
                        <td>{t.pct.toFixed(1).replace('.', ',')}%</td>
                        <td>
                          <div className="rrhh-desv-bar">
                            <div className="rrhh-desv-bar-fill" style={{ width: `${t.pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rrhh-desv-detalle-section">
              <div className="rrhh-desv-detalle-head">
                <h2>Registro detallado</h2>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('/rrhh/usuarios')}
                >
                  Ver personal de baja
                </button>
              </div>
              <div className="rrhh-desv-table-wrap">
                <table className="rrhh-desv-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Colaborador</th>
                      <th>Sector</th>
                      <th>Tipo</th>
                      <th>Antigüedad</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.filasDetalle.map((f) => (
                      <tr key={f.id}>
                        <td>{f.fechaDesvinculacion}</td>
                        <td>{f.nombre}</td>
                        <td>{f.sector}</td>
                        <td>{f.tipoLabel}</td>
                        <td>{f.antiguedadLabel}</td>
                        <td className="rrhh-desv-motivo">{f.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default RecursosHumanosDesvinculacionesPage
