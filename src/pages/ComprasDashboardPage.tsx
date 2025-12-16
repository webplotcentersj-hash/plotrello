import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './ComprasDashboardPage.css'

const ComprasDashboardPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [datosGraficos, setDatosGraficos] = useState({
    pedidosPorEstado: [] as Array<{ name: string; value: number; color: string }>,
    pedidosPorDia: [] as Array<{ fecha: string; pendientes: number; aprobados: number; completados: number }>,
    pedidosPorPrioridad: [] as Array<{ name: string; value: number; color: string }>,
    costosPorMes: [] as Array<{ mes: string; total: number }>
  })
  const [, setAlertas] = useState<Array<{
    tipo: 'stock_bajo' | 'pedido_pendiente' | 'entrega_proxima' | 'presupuesto_vencido'
    titulo: string
    descripcion: string
    severidad: 'alta' | 'media' | 'baja'
    accion?: { url: string; texto: string }
  }>>([])

  useEffect(() => {
    if (authLoading) return // Esperar a que termine la carga de autenticación
    
    if (!canManageCompras) {
      navigate('/')
      return
    }
    loadPedidos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, canManageCompras, navigate, authLoading])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (filtroEstado !== 'todos') {
        filters.estado = filtroEstado
      }
      const response = await apiService.getPedidosCompra(filters)
      if (response.success && response.data) {
        setPedidos(response.data)
        loadDatosGraficos(response.data)
        await loadAlertas(response.data)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAlertas = async (todosPedidos: PedidoCompra[]) => {
    const nuevasAlertas: Array<{
      tipo: 'stock_bajo' | 'pedido_pendiente' | 'entrega_proxima' | 'presupuesto_vencido'
      titulo: string
      descripcion: string
      severidad: 'alta' | 'media' | 'baja'
      accion?: { url: string; texto: string }
    }> = []

    // Alertas de pedidos pendientes (más de 3 días sin aprobar)
    const pedidosPendientes = todosPedidos.filter(p => 
      p.estado === 'Pendiente' && 
      p.fecha_solicitud && 
      (Date.now() - new Date(p.fecha_solicitud).getTime()) > 3 * 24 * 60 * 60 * 1000
    )
    pedidosPendientes.forEach(pedido => {
      const diasPendiente = Math.floor((Date.now() - new Date(pedido.fecha_solicitud!).getTime()) / (24 * 60 * 60 * 1000))
      nuevasAlertas.push({
        tipo: 'pedido_pendiente',
        titulo: `Pedido ${pedido.numero_pedido} pendiente`,
        descripcion: `El pedido lleva ${diasPendiente} días sin aprobar`,
        severidad: diasPendiente > 7 ? 'alta' : diasPendiente > 5 ? 'media' : 'baja',
        accion: {
          url: `/compras/pedidos/${pedido.id}`,
          texto: 'Ver pedido'
        }
      })
    })

    // Alertas de entregas próximas (menos de 3 días)
    const pedidosConEntrega = todosPedidos.filter(p => 
      p.estado === 'Aprobado' && 
      p.fecha_entrega_estimada
    )
    pedidosConEntrega.forEach(pedido => {
      const diasHastaEntrega = Math.floor((new Date(pedido.fecha_entrega_estimada!).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      if (diasHastaEntrega >= 0 && diasHastaEntrega <= 3) {
        nuevasAlertas.push({
          tipo: 'entrega_proxima',
          titulo: `Entrega próxima: ${pedido.numero_pedido}`,
          descripcion: `La entrega está programada para ${diasHastaEntrega === 0 ? 'hoy' : `en ${diasHastaEntrega} día${diasHastaEntrega > 1 ? 's' : ''}`}`,
          severidad: diasHastaEntrega === 0 ? 'alta' : diasHastaEntrega === 1 ? 'alta' : 'media',
          accion: {
            url: `/compras/pedidos/${pedido.id}`,
            texto: 'Ver pedido'
          }
        })
      }
    })

    // Alertas de presupuestos vencidos
    try {
      const presupuestosResponse = await apiService.getPresupuestos({ estado: 'Vencido' })
      if (presupuestosResponse.success && presupuestosResponse.data) {
        presupuestosResponse.data.forEach((presupuesto: any) => {
          nuevasAlertas.push({
            tipo: 'presupuesto_vencido',
            titulo: `Presupuesto vencido: ${presupuesto.numero_presupuesto}`,
            descripcion: `El presupuesto del proveedor ${presupuesto.proveedor?.nombre || 'desconocido'} ha vencido`,
            severidad: 'media',
            accion: presupuesto.id_pedido_compra ? {
              url: `/compras/presupuestos/${presupuesto.id_pedido_compra}`,
              texto: 'Ver presupuestos'
            } : undefined
          })
        })
      }
    } catch (error) {
      console.error('Error cargando presupuestos vencidos:', error)
    }

    // Alertas de stock bajo (si hay integración con stock)
    // Esto se puede implementar cuando haya integración con el sistema de stock

    setAlertas(nuevasAlertas)
  }

  const loadDatosGraficos = (todosPedidos: PedidoCompra[]) => {
    // Pedidos por estado (Pie Chart)
    const estados = ['Pendiente', 'En Revisión', 'Aprobado', 'En Compra', 'Completado', 'Rechazado']
    const coloresEstados: Record<string, string> = {
      'Pendiente': '#f59e0b',
      'En Revisión': '#3b82f6',
      'Aprobado': '#10b981',
      'En Compra': '#8b5cf6',
      'Completado': '#059669',
      'Rechazado': '#ef4444'
    }
    const pedidosPorEstado = estados.map(estado => ({
      name: estado,
      value: todosPedidos.filter(p => p.estado === estado).length,
      color: coloresEstados[estado]
    })).filter(item => item.value > 0)

    // Pedidos por día (últimos 7 días) - Line Chart
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
        } catch (e) {
          return false
        }
      })

      ultimos7Dias.push({
        fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        pendientes: pedidosDia.filter(p => p.estado === 'Pendiente').length,
        aprobados: pedidosDia.filter(p => p.estado === 'Aprobado').length,
        completados: pedidosDia.filter(p => p.estado === 'Completado').length
      })
    }

    // Pedidos por prioridad (Bar Chart)
    const prioridades = ['Baja', 'Normal', 'Alta', 'Urgente']
    const coloresPrioridad: Record<string, string> = {
      'Baja': '#6b7280',
      'Normal': '#3b82f6',
      'Alta': '#f59e0b',
      'Urgente': '#ef4444'
    }
    const pedidosPorPrioridad = prioridades.map(prioridad => ({
      name: prioridad,
      value: todosPedidos.filter(p => p.prioridad === prioridad).length,
      color: coloresPrioridad[prioridad]
    }))

    // Costos por mes (últimos 6 meses) - Bar Chart
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
        } catch (e) {
          return false
        }
      })

      const totalMes = pedidosMes.reduce((sum, pedido) => {
        const totalItems = pedido.items?.reduce((itemSum, item) => {
          return itemSum + (item.precio_total || 0)
        }, 0) || 0
        return sum + totalItems
      }, 0)

      ultimos6Meses.push({
        mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
        total: totalMes
      })
    }

    setDatosGraficos({
      pedidosPorEstado,
      pedidosPorDia: ultimos7Dias,
      pedidosPorPrioridad,
      costosPorMes: ultimos6Meses
    })
  }

  const getEstadisticas = () => {
    const total = pedidos.length
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente').length
    const enRevision = pedidos.filter(p => p.estado === 'En Revisión').length
    const aprobados = pedidos.filter(p => p.estado === 'Aprobado').length
    const enCompra = pedidos.filter(p => p.estado === 'En Compra').length
    const completados = pedidos.filter(p => p.estado === 'Completado').length
    const rechazados = pedidos.filter(p => p.estado === 'Rechazado').length

    return {
      total,
      pendientes,
      enRevision,
      aprobados,
      enCompra,
      completados,
      rechazados
    }
  }

  const stats = getEstadisticas()

  const getEstadoColor = (estado: string) => {
    const colores: Record<string, string> = {
      'Pendiente': '#f59e0b',
      'En Revisión': '#3b82f6',
      'Aprobado': '#10b981',
      'Rechazado': '#ef4444',
      'En Compra': '#8b5cf6',
      'Completado': '#059669',
      'Cancelado': '#6b7280'
    }
    return colores[estado] || '#6b7280'
  }

  const getPrioridadColor = (prioridad: string) => {
    const colores: Record<string, string> = {
      'Baja': '#6b7280',
      'Normal': '#3b82f6',
      'Alta': '#f59e0b',
      'Urgente': '#ef4444'
    }
    return colores[prioridad] || '#6b7280'
  }

  if (authLoading || loading) {
    return (
      <div className="compras-dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="compras-dashboard-page">
        <div className="error-container">
          <p>No tienes permiso para acceder a esta página.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Volver al Tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="compras-dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>🛒 Dashboard de Compras</h1>
            <p className="subtitle">Gestión de pedidos y stock</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={() => navigate('/compras/pedidos')}
            >
              Ver Todos los Pedidos
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate('/compras/gestion-stock')}
            >
              📦 Gestión Stock
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate('/compras/reportes')}
            >
              📊 Reportes y Exportación
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate('/compras/proveedores')}
            >
              🏢 Proveedores
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/')}
            >
              Ver Tablero
            </button>
          </div>
        </div>
      </header>

      {/* Estadísticas */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Pedidos</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.pendientes}</div>
            <div className="stat-label">Pendientes</div>
          </div>
          <div className="stat-card info">
            <div className="stat-value">{stats.enRevision}</div>
            <div className="stat-label">En Revisión</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{stats.aprobados}</div>
            <div className="stat-label">Aprobados</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-value">{stats.enCompra}</div>
            <div className="stat-label">En Compra</div>
          </div>
          <div className="stat-card completed">
            <div className="stat-value">{stats.completados}</div>
            <div className="stat-label">Completados</div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="filters-section">
        <div className="filters">
          <button
            className={`filter-btn ${filtroEstado === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('todos')}
          >
            Todos
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'Pendiente' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('Pendiente')}
          >
            Pendientes
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'En Revisión' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('En Revisión')}
          >
            En Revisión
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'Aprobado' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('Aprobado')}
          >
            Aprobados
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'En Compra' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('En Compra')}
          >
            En Compra
          </button>
        </div>
      </section>

      {/* Gráficos */}
      {pedidos.length > 0 && (
        <section className="graficos-section">
          <h2>📊 Análisis y Métricas</h2>
          <div className="graficos-grid">
            {/* Gráfico de distribución por estado */}
            <div className="grafico-card">
              <h3>Distribución por Estado</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={datosGraficos.pedidosPorEstado}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {datosGraficos.pedidosPorEstado.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de pedidos por día */}
            <div className="grafico-card">
              <h3>Pedidos por Día (Últimos 7 días)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={datosGraficos.pedidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pendientes" stroke="#f59e0b" name="Pendientes" />
                  <Line type="monotone" dataKey="aprobados" stroke="#10b981" name="Aprobados" />
                  <Line type="monotone" dataKey="completados" stroke="#059669" name="Completados" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de pedidos por prioridad */}
            <div className="grafico-card">
              <h3>Pedidos por Prioridad</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosGraficos.pedidosPorPrioridad}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6">
                    {datosGraficos.pedidosPorPrioridad.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de costos por mes */}
            <div className="grafico-card">
              <h3>Costos por Mes (Últimos 6 meses)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosGraficos.costosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="total" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Lista de Pedidos */}
      <section className="pedidos-section">
        <h2>Pedidos Recientes</h2>
        {pedidos.length === 0 ? (
          <div className="empty-state">
            <p>No hay pedidos para mostrar</p>
          </div>
        ) : (
          <div className="pedidos-list">
            {pedidos.slice(0, 10).map((pedido) => (
              <div
                key={pedido.id}
                className="pedido-card"
                onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
              >
                <div className="pedido-header">
                  <div className="pedido-numero">
                    <strong>{pedido.numero_pedido}</strong>
                  </div>
                  <div
                    className="pedido-estado"
                    style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                  >
                    {pedido.estado}
                  </div>
                </div>
                <div className="pedido-info">
                  <div className="info-row">
                    <span className="label">Solicitante:</span>
                    <span>{pedido.nombre_solicitante}</span>
                  </div>
                  {pedido.sector_solicitante && (
                    <div className="info-row">
                      <span className="label">Sector:</span>
                      <span>{pedido.sector_solicitante}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="label">Prioridad:</span>
                    <span
                      className="prioridad-badge"
                      style={{ color: getPrioridadColor(pedido.prioridad) }}
                    >
                      {pedido.prioridad}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="label">Items:</span>
                    <span>{pedido.items?.length || 0} productos</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Fecha:</span>
                    <span>{new Date(pedido.fecha_solicitud).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>
                {pedido.motivo && (
                  <div className="pedido-motivo">
                    <strong>Motivo:</strong> {pedido.motivo}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ComprasDashboardPage

