import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import './RecursosHumanosEstadisticasPage.css'

const SECTORES_DISPONIBLES = [
  'Taller Gráfico',
  'Instalaciones',
  'Taller de Imprenta',
  'Metalúrgica',
  'Diseño Gráfico',
  'Mostrador',
  'Compras'
]

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

function diasPeriodoInclusivo(fechaDesde: string, fechaHasta: string): number {
  const a = new Date(`${fechaDesde}T12:00:00`)
  const b = new Date(`${fechaHasta}T12:00:00`)
  const diff = b.getTime() - a.getTime()
  return Math.max(1, Math.floor(diff / 86400000) + 1)
}

function pctLabel(num: number, den: number): string {
  if (!den || den <= 0) return '0,0 %'
  return `${((num / den) * 100).toFixed(1).replace('.', ',')} %`
}

function pctNumber(num: number, den: number): number {
  if (!den || den <= 0) return 0
  return Math.round((num / den) * 1000) / 10
}

function pendientesDerivado(total: number, completadas: number, enProceso: number): number {
  return Math.max(0, total - completadas - enProceso)
}

function movimientosPorOrden(movs: number, ordenes: number): string {
  if (!ordenes || ordenes <= 0) return '—'
  return (movs / ordenes).toFixed(2).replace('.', ',')
}

function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  } catch {
    return '—'
  }
}

function labelPeriodoClave(periodo: 'semana' | 'mes' | 'trimestre'): string {
  if (periodo === 'semana') return 'Última semana (7 días hacia atrás)'
  if (periodo === 'mes') return 'Último mes (30 días hacia atrás)'
  return 'Último trimestre (90 días hacia atrás)'
}

type UsuarioStatRow = {
  id_usuario?: number
  nombre_usuario?: string
  total_ordenes?: number
  ordenes_completadas?: number
  ordenes_en_proceso?: number
  ordenes_pendientes?: number
  movimientos_realizados?: number
  ultima_actividad?: string
  promedio_dias_completar?: number
  sector_principal?: string
}

type SortKey =
  | 'nombre_usuario'
  | 'total_ordenes'
  | 'ordenes_completadas'
  | 'movimientos_realizados'
  | 'tasa'
  | 'ultima_actividad'

const RecursosHumanosEstadisticasPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'trimestre'>('mes')
  const [estadisticasUsuarios, setEstadisticasUsuarios] = useState<UsuarioStatRow[]>([])
  const [estadisticasSectores, setEstadisticasSectores] = useState<any[]>([])
  const [estadisticasPeriodo, setEstadisticasPeriodo] = useState<any>(null)
  const [fechaDesdeActual, setFechaDesdeActual] = useState('')
  const [fechaHastaActual, setFechaHastaActual] = useState('')
  const [cargaError, setCargaError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('total_ordenes')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadData()
  }, [periodo, canManageRecursosHumanos, navigate, authLoading])

  const getFechaDesde = () => {
    if (periodo === 'semana') {
      const hace7Dias = new Date()
      hace7Dias.setDate(hace7Dias.getDate() - 7)
      return hace7Dias.toISOString().split('T')[0]
    }
    if (periodo === 'mes') {
      const haceUnMes = new Date()
      haceUnMes.setMonth(haceUnMes.getMonth() - 1)
      return haceUnMes.toISOString().split('T')[0]
    }
    const hace3Meses = new Date()
    hace3Meses.setMonth(hace3Meses.getMonth() - 3)
    return hace3Meses.toISOString().split('T')[0]
  }

  const getFechaHasta = () => new Date().toISOString().split('T')[0]

  const loadData = async () => {
    setLoading(true)
    setCargaError(null)
    const fechaDesde = getFechaDesde()
    const fechaHasta = getFechaHasta()
    setFechaDesdeActual(fechaDesde)
    setFechaHastaActual(fechaHasta)

    try {
      const [periodoResponse, usuariosResponse] = await Promise.all([
        apiService.getEstadisticasPeriodo(fechaDesde, fechaHasta),
        apiService.getUsuarios()
      ])

      if (periodoResponse.success && periodoResponse.data) {
        setEstadisticasPeriodo(periodoResponse.data)
      } else {
        setEstadisticasPeriodo(null)
      }

      const statsSectoresPromises = SECTORES_DISPONIBLES.map(async (sector) => {
        const response = await apiService.getEstadisticasSector(sector, fechaDesde, fechaHasta)
        return response.success && response.data ? { ...response.data, sector } : null
      })
      const statsSectores = (await Promise.all(statsSectoresPromises)).filter((s) => s !== null)
      setEstadisticasSectores(statsSectores)

      if (usuariosResponse.success && usuariosResponse.data?.length) {
        const statsPromises = usuariosResponse.data.map(async (usuario) => {
          const response = await apiService.getEstadisticasUsuario(usuario.id, fechaDesde, fechaHasta)
          return response.success && response.data ? (response.data as UsuarioStatRow) : null
        })
        const statsUsuarios = (await Promise.all(statsPromises)).filter(
          (s): s is UsuarioStatRow => s !== null
        )
        setEstadisticasUsuarios(statsUsuarios)
      } else {
        setEstadisticasUsuarios([])
        if (!usuariosResponse.success) {
          setCargaError(usuariosResponse.error || 'No se pudo cargar la lista de usuarios')
        }
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
      setCargaError('Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }

  const diasCalendario = useMemo(() => {
    if (!fechaDesdeActual || !fechaHastaActual) return 0
    return diasPeriodoInclusivo(fechaDesdeActual, fechaHastaActual)
  }, [fechaDesdeActual, fechaHastaActual])

  const usuariosConActividad = useMemo(
    () =>
      estadisticasUsuarios.filter(
        (u) => (Number(u.total_ordenes) || 0) > 0 || (Number(u.movimientos_realizados) || 0) > 0
      ),
    [estadisticasUsuarios]
  )

  const filasTablaUsuarios = useMemo(() => {
    return estadisticasUsuarios.map((u) => {
      const t = Number(u.total_ordenes) || 0
      const c = Number(u.ordenes_completadas) || 0
      const p = Number(u.ordenes_en_proceso) || 0
      const mov = Number(u.movimientos_realizados) || 0
      return {
        ...u,
        _t: t,
        _c: c,
        _p: p,
        _pendDer: pendientesDerivado(t, c, p),
        _tasa: pctNumber(c, t),
        _movOp: movimientosPorOrden(mov, t)
      }
    })
  }, [estadisticasUsuarios])

  const filasOrdenadas = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filasTablaUsuarios].sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      if (sortKey === 'nombre_usuario') {
        va = (a.nombre_usuario || '').toLowerCase()
        vb = (b.nombre_usuario || '').toLowerCase()
        return va < vb ? -dir : va > vb ? dir : 0
      }
      if (sortKey === 'ultima_actividad') {
        const ta = a.ultima_actividad ? new Date(a.ultima_actividad).getTime() : 0
        const tb = b.ultima_actividad ? new Date(b.ultima_actividad).getTime() : 0
        return (ta - tb) * dir
      }
      if (sortKey === 'total_ordenes') {
        va = a._t
        vb = b._t
      } else if (sortKey === 'ordenes_completadas') {
        va = a._c
        vb = b._c
      } else if (sortKey === 'movimientos_realizados') {
        va = Number(a.movimientos_realizados) || 0
        vb = Number(b.movimientos_realizados) || 0
      } else {
        va = a._tasa
        vb = b._tasa
      }
      return (Number(va) - Number(vb)) * dir
    })
  }, [filasTablaUsuarios, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(key === 'nombre_usuario' ? 'asc' : 'desc')
      return key
    })
  }

  const datosProductividadUsuarios = useMemo(
    () =>
      [...usuariosConActividad]
        .map((u) => ({
          nombre: u.nombre_usuario || 'N/A',
          completadas: u.ordenes_completadas || 0,
          enProceso: u.ordenes_en_proceso || 0,
          pendientes: u.ordenes_pendientes ?? pendientesDerivado(
            Number(u.total_ordenes) || 0,
            Number(u.ordenes_completadas) || 0,
            Number(u.ordenes_en_proceso) || 0
          ),
          total: u.total_ordenes || 0
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    [usuariosConActividad]
  )

  const datosMovimientosUsuarios = useMemo(
    () =>
      [...usuariosConActividad]
        .map((u) => ({
          nombre: u.nombre_usuario || 'N/A',
          movimientos: Number(u.movimientos_realizados) || 0
        }))
        .filter((r) => r.movimientos > 0)
        .sort((a, b) => b.movimientos - a.movimientos)
        .slice(0, 12),
    [usuariosConActividad]
  )

  const datosTasaUsuarios = useMemo(
    () =>
      [...usuariosConActividad]
        .map((u) => {
          const t = Number(u.total_ordenes) || 0
          const c = Number(u.ordenes_completadas) || 0
          return {
            nombre: u.nombre_usuario || 'N/A',
            tasa: pctNumber(c, t),
            total: t
          }
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.tasa - a.tasa)
        .slice(0, 12),
    [usuariosConActividad]
  )

  const datosProductividadSectores = estadisticasSectores.map((s, index) => ({
    sector: s.sector || 'N/A',
    completadas: s.ordenes_completadas || 0,
    enProceso: s.ordenes_en_proceso || 0,
    total: s.total_ordenes || 0,
    color: COLORS[index % COLORS.length]
  }))

  const datosDistribucionSectores = estadisticasSectores.map((s, index) => ({
    name: s.sector || 'N/A',
    value: s.total_ordenes || 0,
    color: COLORS[index % COLORS.length]
  }))

  const datosTasaCompletitud = estadisticasSectores
    .map((s, index) => {
      const t = Number(s.total_ordenes) || 0
      const c = Number(s.ordenes_completadas) || 0
      const tasa =
        s.tasa_completitud !== null && s.tasa_completitud !== undefined
          ? parseFloat(Number(s.tasa_completitud).toFixed(1))
          : pctNumber(c, t)
      return {
        sector: s.sector || 'N/A',
        tasa,
        total: t,
        color: COLORS[index % COLORS.length]
      }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.tasa - a.tasa)

  const resumenPeriodoDerivado = useMemo(() => {
    if (!estadisticasPeriodo || !fechaDesdeActual || !fechaHastaActual) return null
    const t = Number(estadisticasPeriodo.total_ordenes) || 0
    const c = Number(estadisticasPeriodo.ordenes_completadas) || 0
    const p = Number(estadisticasPeriodo.ordenes_en_proceso) || 0
    const mov = Number(estadisticasPeriodo.movimientos_totales) || 0
    const dias = diasPeriodoInclusivo(fechaDesdeActual, fechaHastaActual)
    return {
      pendientesDerivado: pendientesDerivado(t, c, p),
      tasaPct: pctLabel(c, t),
      movPorDia: dias > 0 ? (mov / dias).toFixed(2).replace('.', ',') : '—',
      ordenesPorDiaAprox: dias > 0 ? (t / dias).toFixed(2).replace('.', ',') : '—'
    }
  }, [estadisticasPeriodo, fechaDesdeActual, fechaHastaActual])

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  if (loading) {
    return (
      <div className="rrhh-estadisticas-loading">
        <div className="spinner"></div>
        <p>Cargando estadísticas...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-estadisticas-page">
      <header className="rrhh-estadisticas-header">
        <div className="rrhh-header-content">
          <h1>📈 Estadísticas Avanzadas</h1>
          <div className="rrhh-header-actions">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as 'semana' | 'mes' | 'trimestre')}
              className="rrhh-periodo-select"
            >
              <option value="semana">Última Semana</option>
              <option value="mes">Último Mes</option>
              <option value="trimestre">Último Trimestre</option>
            </select>
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-estadisticas-content">
        {fechaDesdeActual && fechaHastaActual && (
          <div className="rrhh-estadisticas-context">
            <p className="rrhh-estadisticas-context-title">Período analizado</p>
            <p className="rrhh-estadisticas-context-text">
              <strong>{labelPeriodoClave(periodo)}</strong>
              {' · '}
              Desde{' '}
              <strong>
                {new Date(fechaDesdeActual + 'T12:00:00').toLocaleDateString('es-AR')}
              </strong>{' '}
              hasta{' '}
              <strong>
                {new Date(fechaHastaActual + 'T12:00:00').toLocaleDateString('es-AR')}
              </strong>
              {' · '}
              {diasCalendario} día{diasCalendario !== 1 ? 's' : ''} calendario (inclusive)
            </p>
            <p className="rrhh-estadisticas-context-hint">
              Usuarios: órdenes donde figura como creador, operario o usuario trabajando; movimientos del
              historial filtrados por fecha. Sectores: órdenes cuyo sector coincide con el nombre del sector.
            </p>
          </div>
        )}

        {cargaError && (
          <div className="rrhh-estadisticas-warn" role="status">
            {cargaError}. El resumen por período y por sector se muestra igual; el detalle por usuario puede
            faltar.
          </div>
        )}

        {estadisticasUsuarios.length > 0 && (
          <div className="rrhh-estadisticas-user-meta">
            <span>
              <strong>{estadisticasUsuarios.length}</strong> usuario
              {estadisticasUsuarios.length !== 1 ? 's' : ''} en listado
            </span>
            <span className="rrhh-estadisticas-user-meta-sep">·</span>
            <span>
              <strong>{usuariosConActividad.length}</strong> con órdenes o movimientos en el período
            </span>
          </div>
        )}

        {estadisticasPeriodo && resumenPeriodoDerivado && (
          <div className="rrhh-stats-summary">
            <div className="rrhh-summary-card">
              <h3>Total de Órdenes</h3>
              <p className="rrhh-summary-value">{estadisticasPeriodo.total_ordenes || 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Completadas</h3>
              <p className="rrhh-summary-value success">{estadisticasPeriodo.ordenes_completadas || 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>En Proceso</h3>
              <p className="rrhh-summary-value warning">{estadisticasPeriodo.ordenes_en_proceso || 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Pendientes (derivado)</h3>
              <p className="rrhh-summary-value">{resumenPeriodoDerivado.pendientesDerivado}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Tasa completitud</h3>
              <p className="rrhh-summary-value">{resumenPeriodoDerivado.tasaPct}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Usuarios Activos</h3>
              <p className="rrhh-summary-value">{estadisticasPeriodo.usuarios_activos || 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Movimientos (historial)</h3>
              <p className="rrhh-summary-value">{estadisticasPeriodo.movimientos_totales ?? 0}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Movimientos / día</h3>
              <p className="rrhh-summary-value">{resumenPeriodoDerivado.movPorDia}</p>
            </div>
            <div className="rrhh-summary-card">
              <h3>Órdenes / día (aprox.)</h3>
              <p className="rrhh-summary-value">{resumenPeriodoDerivado.ordenesPorDiaAprox}</p>
            </div>
            {estadisticasPeriodo.ordenes_por_dia != null && (
              <div className="rrhh-summary-card">
                <h3>Órdenes por Día (RPC)</h3>
                <p className="rrhh-summary-value">
                  {Number(estadisticasPeriodo.ordenes_por_dia).toFixed(1).replace('.', ',')}
                </p>
              </div>
            )}
            {estadisticasPeriodo.promedio_dias_completar != null && (
              <div className="rrhh-summary-card">
                <h3>Promedio días completar</h3>
                <p className="rrhh-summary-value">
                  {Number(estadisticasPeriodo.promedio_dias_completar).toFixed(1).replace('.', ',')}
                </p>
              </div>
            )}
          </div>
        )}

        {datosProductividadUsuarios.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Órdenes por usuario (Top 10 con actividad)</h3>
            <p className="rrhh-chart-subtitle">
              Completadas, en proceso y pendientes (diseño) en el período seleccionado.
            </p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={datosProductividadUsuarios}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <Legend />
                <Bar dataKey="completadas" fill="#10b981" name="Completadas" />
                <Bar dataKey="enProceso" fill="#f59e0b" name="En proceso" />
                <Bar dataKey="pendientes" fill="#64748b" name="Pendientes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {datosMovimientosUsuarios.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Movimientos en historial por usuario (Top 12)</h3>
            <p className="rrhh-chart-subtitle">Registros de historial con fecha dentro del período.</p>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={datosMovimientosUsuarios} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                <XAxis type="number" stroke="var(--text-muted)" />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={120}
                  tick={{ fontSize: 11 }}
                  stroke="var(--text-muted)"
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <Bar dataKey="movimientos" fill="#3b82f6" name="Movimientos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {datosTasaUsuarios.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Tasa de completitud por usuario (Top 12, con órdenes &gt; 0)</h3>
            <p className="rrhh-chart-subtitle">Completadas / total de órdenes del usuario en el período.</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={datosTasaUsuarios}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} stroke="var(--text-muted)" />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <Bar dataKey="tasa" fill="#8b5cf6" name="Tasa (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {filasOrdenadas.length > 0 && (
          <div className="rrhh-estadisticas-tabla-section">
            <h3 className="rrhh-estadisticas-tabla-title">Detalle por usuario</h3>
            <p className="rrhh-chart-subtitle">
              Clic en encabezado para ordenar. Incluye todos los usuarios del sistema (con o sin actividad en
              el período).
            </p>
            <div className="rrhh-estadisticas-tabla-wrap">
              <table className="rrhh-estadisticas-tabla">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="rrhh-th-btn" onClick={() => toggleSort('nombre_usuario')}>
                        Usuario{sortIndicator('nombre_usuario')}
                      </button>
                    </th>
                    <th>ID</th>
                    <th>
                      <button type="button" className="rrhh-th-btn" onClick={() => toggleSort('total_ordenes')}>
                        Total{sortIndicator('total_ordenes')}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="rrhh-th-btn"
                        onClick={() => toggleSort('ordenes_completadas')}
                      >
                        Compl.{sortIndicator('ordenes_completadas')}
                      </button>
                    </th>
                    <th>Proc.</th>
                    <th>Pend. BD</th>
                    <th>Pend. deriv.</th>
                    <th>
                      <button type="button" className="rrhh-th-btn" onClick={() => toggleSort('tasa')}>
                        Tasa %{sortIndicator('tasa')}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="rrhh-th-btn"
                        onClick={() => toggleSort('movimientos_realizados')}
                      >
                        Mov.{sortIndicator('movimientos_realizados')}
                      </button>
                    </th>
                    <th>Mov/OP</th>
                    <th>Prom. días</th>
                    <th>Sector</th>
                    <th>
                      <button
                        type="button"
                        className="rrhh-th-btn"
                        onClick={() => toggleSort('ultima_actividad')}
                      >
                        Última act.{sortIndicator('ultima_actividad')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filasOrdenadas.map((row) => (
                    <tr key={row.id_usuario ?? row.nombre_usuario}>
                      <td>{row.nombre_usuario || '—'}</td>
                      <td>{row.id_usuario ?? '—'}</td>
                      <td>{row._t}</td>
                      <td>{row._c}</td>
                      <td>{row._p}</td>
                      <td>{row.ordenes_pendientes ?? '—'}</td>
                      <td>{row._pendDer}</td>
                      <td>{pctLabel(row._c, row._t)}</td>
                      <td>{row.movimientos_realizados ?? 0}</td>
                      <td>{row._movOp}</td>
                      <td>
                        {row.promedio_dias_completar != null
                          ? Number(row.promedio_dias_completar).toFixed(1).replace('.', ',')
                          : '—'}
                      </td>
                      <td>{row.sector_principal || '—'}</td>
                      <td>{fmtFechaHora(row.ultima_actividad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {datosProductividadSectores.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Productividad por Sector</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={datosProductividadSectores}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                <XAxis dataKey="sector" angle={-45} textAnchor="end" height={100} stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <Legend />
                <Bar dataKey="completadas" fill="#10b981" name="Completadas" />
                <Bar dataKey="enProceso" fill="#f59e0b" name="En Proceso" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {datosDistribucionSectores.some((d) => d.value > 0) && (
          <div className="rrhh-chart-card">
            <h3>Distribución de Órdenes por Sector</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={datosDistribucionSectores.filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {datosDistribucionSectores.filter((d) => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {datosTasaCompletitud.length > 0 && (
          <div className="rrhh-chart-card">
            <h3>Tasa de Completitud por Sector (%)</h3>
            <p className="rrhh-chart-subtitle">Sectores con al menos una orden en el período.</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={datosTasaCompletitud}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                <XAxis dataKey="sector" angle={-45} textAnchor="end" height={100} stroke="var(--text-muted)" />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <Bar dataKey="tasa" fill="#3b82f6" name="Tasa de Completitud (%)">
                  {datosTasaCompletitud.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecursosHumanosEstadisticasPage
