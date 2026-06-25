import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { Venta } from '../types/api'
import { formatArgentinaDate } from '../utils/dateUtils'
import { VENTAS } from '../utils/ventasRoutes'
import { idVendedorParaConsulta } from '../utils/ventasCajaScope'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './ReportesVentasPage.css'

const ReportesVentasPage = () => {
  const navigate = useNavigate()
  const { canAccessMostradorViews, isAdmin, isPresupuestos, usuario, loading: authLoading } = useAuth()
  const idVendedorScope = idVendedorParaConsulta(isAdmin, isPresupuestos, usuario?.id)
  const [loading, setLoading] = useState(true)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [fechaDesde, setFechaDesde] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    // Esperar a que termine de cargar el usuario antes de verificar permisos
    if (authLoading) return
    
    if (!canAccessMostradorViews) {
      console.log('Sin permisos para ver reportes, redirigiendo...')
      navigate(VENTAS)
      return
    }
  }, [canAccessMostradorViews, navigate, authLoading])

  useEffect(() => {
    // Solo cargar datos si tiene permisos y ya se cargó el usuario
    if (authLoading) return

    if (canAccessMostradorViews) {
      loadVentas()
    }
  }, [canAccessMostradorViews, fechaDesde, fechaHasta, authLoading, idVendedorScope])

  const loadVentas = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerVentas(
        idVendedorScope,
        fechaDesde || undefined,
        fechaHasta || undefined,
        'todos'
      )
      
      if (response.success && response.data) {
        setVentas(response.data)
      } else {
        console.error('Error cargando ventas:', response.error)
        setVentas([])
      }
    } catch (error: any) {
      console.error('Error cargando ventas:', error)
      setVentas([])
    } finally {
      setLoading(false)
    }
  }

  const getEstadisticas = () => {
    const totalVentas = ventas.length
    const totalIngresos = ventas.reduce((sum, v) => sum + v.valor_total, 0)
    const ventasPagadas = ventas.filter(v => v.estado_pago === 'Pagado')
    const ingresosPagados = ventasPagadas.reduce((sum, v) => sum + v.valor_total, 0)
    const ventasPendientes = ventas.filter(v => v.estado_pago === 'Pendiente')
    const ingresosPendientes = ventasPendientes.reduce((sum, v) => sum + v.valor_total, 0)
    const ventasParciales = ventas.filter(v => v.estado_pago === 'Parcial')
    const ingresosParciales = ventasParciales.reduce((sum, v) => sum + v.valor_total, 0)
    const ventasCanceladas = ventas.filter(v => v.estado_pago === 'Cancelado')
    const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0

    // Ventas por método de pago
    const porMetodoPago = ventas.reduce((acc, v) => {
      const metodo = v.metodo_pago || 'No especificado'
      acc[metodo] = (acc[metodo] || 0) + v.valor_total
      return acc
    }, {} as Record<string, number>)

    // Ventas por día (con cantidad y monto)
    const porDia = ventas.reduce((acc, v) => {
      const fecha = v.fecha_venta
      if (!acc[fecha]) {
        acc[fecha] = { cantidad: 0, total: 0 }
      }
      acc[fecha].cantidad += 1
      acc[fecha].total += v.valor_total
      return acc
    }, {} as Record<string, { cantidad: number; total: number }>)

    const datosPorDia = Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, datos]) => ({
        fecha: formatArgentinaDate(fecha, 'dd/MM'),
        cantidad: datos.cantidad,
        total: Number(datos.total)
      }))

    const datosPorMetodo = Object.entries(porMetodoPago).map(([metodo, total]) => ({
      name: metodo,
      value: Number(total)
    }))

    // Ventas por estado de pago (con montos)
    const porEstado = ventas.reduce((acc, v) => {
      if (!acc[v.estado_pago]) {
        acc[v.estado_pago] = { cantidad: 0, monto: 0 }
      }
      acc[v.estado_pago].cantidad += 1
      acc[v.estado_pago].monto += v.valor_total
      return acc
    }, {} as Record<string, { cantidad: number; monto: number }>)

    const datosPorEstado = Object.entries(porEstado).map(([estado, datos]) => ({
      name: estado,
      cantidad: datos.cantidad,
      monto: Number(datos.monto)
    }))

    // Top vendedores (con cantidad de ventas)
    const porVendedor = ventas.reduce((acc, v) => {
      if (!acc[v.nombre_vendedor]) {
        acc[v.nombre_vendedor] = { total: 0, cantidad: 0 }
      }
      acc[v.nombre_vendedor].total += v.valor_total
      acc[v.nombre_vendedor].cantidad += 1
      return acc
    }, {} as Record<string, { total: number; cantidad: number }>)

    const topVendedores = Object.entries(porVendedor)
      .map(([nombre, datos]) => ({ 
        nombre, 
        total: Number(datos.total),
        cantidad: datos.cantidad,
        promedio: datos.cantidad > 0 ? Number(datos.total) / datos.cantidad : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Ventas por semana
    const porSemana = ventas.reduce((acc, v) => {
      const fecha = new Date(v.fecha_venta)
      const semana = getSemana(fecha)
      if (!acc[semana]) {
        acc[semana] = { cantidad: 0, total: 0 }
      }
      acc[semana].cantidad += 1
      acc[semana].total += v.valor_total
      return acc
    }, {} as Record<string, { cantidad: number; total: number }>)

    const datosPorSemana = Object.entries(porSemana)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, datos]) => ({
        semana,
        cantidad: datos.cantidad,
        total: Number(datos.total)
      }))

    // Top clientes
    const porCliente = ventas.reduce((acc, v) => {
      if (!acc[v.cliente_nombre]) {
        acc[v.cliente_nombre] = { total: 0, cantidad: 0 }
      }
      acc[v.cliente_nombre].total += v.valor_total
      acc[v.cliente_nombre].cantidad += 1
      return acc
    }, {} as Record<string, { total: number; cantidad: number }>)

    const topClientes = Object.entries(porCliente)
      .map(([nombre, datos]) => ({
        nombre,
        total: Number(datos.total),
        cantidad: datos.cantidad
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Items más vendidos
    const itemsVendidos = ventas.reduce((acc, v) => {
      if (v.items && v.items.length > 0) {
        v.items.forEach(item => {
          const key = item.descripcion || item.codigo_articulo || 'Sin descripción'
          if (!acc[key]) {
            acc[key] = { cantidad: 0, ingresos: 0 }
          }
          acc[key].cantidad += item.cantidad
          acc[key].ingresos += item.precio_total
        })
      }
      return acc
    }, {} as Record<string, { cantidad: number; ingresos: number }>)

    const topItems = Object.entries(itemsVendidos)
      .map(([nombre, datos]) => ({
        nombre,
        cantidad: Number(datos.cantidad),
        ingresos: Number(datos.ingresos)
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 10)

    return {
      totalVentas,
      totalIngresos,
      ventasPagadas: ventasPagadas.length,
      ingresosPagados,
      ventasPendientes: ventasPendientes.length,
      ingresosPendientes,
      ventasParciales: ventasParciales.length,
      ingresosParciales,
      ventasCanceladas: ventasCanceladas.length,
      ticketPromedio,
      datosPorDia,
      datosPorMetodo,
      datosPorEstado,
      topVendedores,
      datosPorSemana,
      topClientes,
      topItems
    }
  }

  const getSemana = (fecha: Date): string => {
    const año = fecha.getFullYear()
    const inicioAño = new Date(año, 0, 1)
    const dias = Math.floor((fecha.getTime() - inicioAño.getTime()) / (24 * 60 * 60 * 1000))
    const semana = Math.ceil((dias + inicioAño.getDay() + 1) / 7)
    return `Sem ${semana}/${año}`
  }

  const estadisticas = getEstadisticas()

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  if (loading) {
    return (
      <div className="reportes-ventas-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando reportes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="reportes-ventas-page">
      <header className="reportes-header">
        <div className="header-content">
          <h1>📊 Reportes de Ventas</h1>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate(VENTAS)}>
              ← Volver a Ventas
            </button>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="filtros-section">
        <div className="filtro-group">
          <label>Desde:</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="filtro-input"
          />
        </div>
        <div className="filtro-group">
          <label>Hasta:</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="filtro-input"
          />
        </div>
      </div>

      {/* Métricas principales */}
      <div className="metricas-grid">
        <div className="metrica-card">
          <div className="metrica-icon">💰</div>
          <div className="metrica-content">
            <h3>Total Ingresos</h3>
            <p className="metrica-valor">${estadisticas.totalIngresos.toLocaleString()}</p>
            <p className="metrica-subtitle">{estadisticas.totalVentas} ventas</p>
          </div>
        </div>
        <div className="metrica-card">
          <div className="metrica-icon">✅</div>
          <div className="metrica-content">
            <h3>Ingresos Pagados</h3>
            <p className="metrica-valor">${estadisticas.ingresosPagados.toLocaleString()}</p>
            <p className="metrica-subtitle">{estadisticas.ventasPagadas} ventas</p>
          </div>
        </div>
        <div className="metrica-card">
          <div className="metrica-icon">⏳</div>
          <div className="metrica-content">
            <h3>Ingresos Pendientes</h3>
            <p className="metrica-valor">${estadisticas.ingresosPendientes.toLocaleString()}</p>
            <p className="metrica-subtitle">{estadisticas.ventasPendientes} ventas</p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="graficos-grid">
        <div className="grafico-card">
          <h3>Ventas por Día</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={estadisticas.datosPorDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Ingresos ($)" />
              <Line yAxisId="right" type="monotone" dataKey="cantidad" stroke="#10b981" strokeWidth={2} name="Cantidad" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grafico-card">
          <h3>Ventas por Semana</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={estadisticas.datosPorSemana}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="total" fill="#3b82f6" name="Ingresos ($)" />
              <Bar yAxisId="right" dataKey="cantidad" fill="#10b981" name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grafico-card">
          <h3>Distribución por Método de Pago</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={estadisticas.datosPorMetodo}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {estadisticas.datosPorMetodo.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grafico-card">
          <h3>Ventas por Estado de Pago</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={estadisticas.datosPorEstado}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="cantidad" fill="#10b981" name="Cantidad" />
              <Bar yAxisId="right" dataKey="monto" fill="#f59e0b" name="Monto ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grafico-card">
          <h3>Top 10 Vendedores</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={estadisticas.topVendedores} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="nombre" type="category" width={120} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#8b5cf6" name="Ingresos ($)" />
              <Bar dataKey="cantidad" fill="#ec4899" name="Ventas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grafico-card">
          <h3>Top 10 Clientes</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={estadisticas.topClientes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="nombre" type="category" width={120} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#10b981" name="Ingresos ($)" />
              <Bar dataKey="cantidad" fill="#3b82f6" name="Compras" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grafico-card">
          <h3>Top 10 Artículos Más Vendidos</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={estadisticas.topItems} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="nombre" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="ingresos" fill="#f59e0b" name="Ingresos ($)" />
              <Bar dataKey="cantidad" fill="#ef4444" name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default ReportesVentasPage

