import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
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
import './ComprasEstadisticasPage.css'

function buildChartData(todosPedidos: PedidoCompra[]) {
  const estados = ['Pendiente', 'En Revisión', 'Aprobado', 'En Compra', 'En Viaje', 'Completado', 'Rechazado']
  const coloresEstados: Record<string, string> = {
    Pendiente: '#f59e0b',
    'En Revisión': '#3b82f6',
    Aprobado: '#10b981',
    'En Compra': '#8b5cf6',
    'En Viaje': '#22c55e',
    Completado: '#059669',
    Rechazado: '#ef4444'
  }
  const pedidosPorEstado = estados
    .map((estado) => ({
      name: estado,
      value: todosPedidos.filter((p) => p.estado === estado).length,
      color: coloresEstados[estado]
    }))
    .filter((item) => item.value > 0)

  const ultimos7Dias = []
  for (let i = 6; i >= 0; i--) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - i)
    fecha.setHours(0, 0, 0, 0)

    const pedidosDia = todosPedidos.filter((pedido) => {
      try {
        const fechaPedido = new Date(pedido.fecha_solicitud)
        fechaPedido.setHours(0, 0, 0, 0)
        return fechaPedido.getTime() === fecha.getTime()
      } catch {
        return false
      }
    })

    ultimos7Dias.push({
      fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      pendientes: pedidosDia.filter((p) => p.estado === 'Pendiente').length,
      aprobados: pedidosDia.filter((p) => p.estado === 'Aprobado').length,
      completados: pedidosDia.filter((p) => p.estado === 'Completado').length
    })
  }

  const prioridades = ['Baja', 'Normal', 'Alta', 'Urgente']
  const coloresPrioridad: Record<string, string> = {
    Baja: '#6b7280',
    Normal: '#3b82f6',
    Alta: '#f59e0b',
    Urgente: '#ef4444'
  }
  const pedidosPorPrioridad = prioridades.map((prioridad) => ({
    name: prioridad,
    value: todosPedidos.filter((p) => p.prioridad === prioridad).length,
    color: coloresPrioridad[prioridad]
  }))

  const ultimos6Meses = []
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date()
    fecha.setMonth(fecha.getMonth() - i)
    fecha.setDate(1)
    fecha.setHours(0, 0, 0, 0)

    const pedidosMes = todosPedidos.filter((pedido) => {
      try {
        const fechaPedido = new Date(pedido.fecha_solicitud)
        fechaPedido.setDate(1)
        fechaPedido.setHours(0, 0, 0, 0)
        return fechaPedido.getTime() === fecha.getTime() && pedido.estado === 'Completado'
      } catch {
        return false
      }
    })

    const totalMes = pedidosMes.reduce((sum, pedido) => {
      const totalItems =
        pedido.items?.reduce((itemSum, item) => itemSum + (item.precio_total || 0), 0) || 0
      return sum + totalItems
    }, 0)

    ultimos6Meses.push({
      mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      total: totalMes
    })
  }

  return { pedidosPorEstado, pedidosPorDia: ultimos7Dias, pedidosPorPrioridad, costosPorMes: ultimos6Meses }
}

export default function ComprasEstadisticasPage() {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/')
      return
    }
    void (async () => {
      setLoading(true)
      try {
        const response = await apiService.getPedidosCompra({})
        if (response.success && response.data) setPedidos(response.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, canManageCompras, navigate])

  const stats = useMemo(() => {
    const total = pedidos.length
    return {
      total,
      pendientes: pedidos.filter((p) => p.estado === 'Pendiente').length,
      enRevision: pedidos.filter((p) => p.estado === 'En Revisión').length,
      aprobados: pedidos.filter((p) => p.estado === 'Aprobado').length,
      enCompra: pedidos.filter((p) => p.estado === 'En Compra').length,
      enViaje: pedidos.filter((p) => p.estado === 'En Viaje').length,
      completados: pedidos.filter((p) => p.estado === 'Completado').length,
      rechazados: pedidos.filter((p) => p.estado === 'Rechazado').length
    }
  }, [pedidos])

  const datosGraficos = useMemo(() => buildChartData(pedidos), [pedidos])

  if (authLoading || loading) {
    return (
      <div className="compras-stats-page">
        <div className="compras-stats-loading">
          <div className="compras-stats-spinner" />
          <span>Cargando estadísticas…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="compras-stats-page">
      <header className="compras-stats-header">
        <div className="compras-stats-header__brand">
          <div className="compras-stats-header__icon" aria-hidden>
            📊
          </div>
          <div>
            <p className="compras-stats-header__eyebrow">Compras</p>
            <h1>Estadísticas y métricas</h1>
            <p className="compras-stats-header__sub">Análisis de pedidos, estados, prioridades y costos</p>
          </div>
        </div>
        <div className="compras-stats-header__actions">
          <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/compras/dashboard')}>
            ← Pedidos
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/reportes')}>
            Exportar reportes
          </button>
        </div>
      </header>

      <div className="compras-stats-kpis">
        <article className="compras-stats-kpi">
          <span className="compras-stats-kpi__value">{stats.total}</span>
          <span className="compras-stats-kpi__label">Total</span>
        </article>
        <article className="compras-stats-kpi compras-stats-kpi--warn">
          <span className="compras-stats-kpi__value">{stats.pendientes}</span>
          <span className="compras-stats-kpi__label">Pendientes</span>
        </article>
        <article className="compras-stats-kpi compras-stats-kpi--info">
          <span className="compras-stats-kpi__value">{stats.enRevision}</span>
          <span className="compras-stats-kpi__label">En revisión</span>
        </article>
        <article className="compras-stats-kpi compras-stats-kpi--ok">
          <span className="compras-stats-kpi__value">{stats.aprobados}</span>
          <span className="compras-stats-kpi__label">Aprobados</span>
        </article>
        <article className="compras-stats-kpi compras-stats-kpi--purple">
          <span className="compras-stats-kpi__value">{stats.enCompra}</span>
          <span className="compras-stats-kpi__label">En compra</span>
        </article>
        <article className="compras-stats-kpi compras-stats-kpi--ok">
          <span className="compras-stats-kpi__value">{stats.enViaje}</span>
          <span className="compras-stats-kpi__label">En viaje</span>
        </article>
        <article className="compras-stats-kpi compras-stats-kpi--done">
          <span className="compras-stats-kpi__value">{stats.completados}</span>
          <span className="compras-stats-kpi__label">Completados</span>
        </article>
        <article className="compras-stats-kpi compras-stats-kpi--bad">
          <span className="compras-stats-kpi__value">{stats.rechazados}</span>
          <span className="compras-stats-kpi__label">Rechazados</span>
        </article>
      </div>

      {pedidos.length === 0 ? (
        <div className="compras-stats-empty">No hay pedidos para analizar.</div>
      ) : (
        <div className="compras-stats-charts">
          <article className="compras-stats-chart">
            <h3>Distribución por estado</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={datosGraficos.pedidosPorEstado}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={90}
                  dataKey="value"
                >
                  {datosGraficos.pedidosPorEstado.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </article>

          <article className="compras-stats-chart">
            <h3>Pedidos por día (últimos 7 días)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={datosGraficos.pedidosPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="fecha" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="pendientes" stroke="#f59e0b" name="Pendientes" />
                <Line type="monotone" dataKey="aprobados" stroke="#10b981" name="Aprobados" />
                <Line type="monotone" dataKey="completados" stroke="#059669" name="Completados" />
              </LineChart>
            </ResponsiveContainer>
          </article>

          <article className="compras-stats-chart">
            <h3>Pedidos por prioridad</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosGraficos.pedidosPorPrioridad}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value">
                  {datosGraficos.pedidosPorPrioridad.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className="compras-stats-chart">
            <h3>Costos por mes (completados, últimos 6 meses)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosGraficos.costosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="mes" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => [`$${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 'Total']} />
                <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        </div>
      )}
    </div>
  )
}
