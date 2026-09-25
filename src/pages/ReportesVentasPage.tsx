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

    const topItemsAll = Object.entries(itemsVendidos)
      .map(([nombre, datos]) => ({
        nombre,
        cantidad: Number(datos.cantidad),
        ingresos: Number(datos.ingresos)
      }))
      .sort((a, b) => b.ingresos - a.ingresos)

    const topItems = topItemsAll.slice(0, 10)
    const ingresosArticulos = topItemsAll.reduce((sum, item) => sum + item.ingresos, 0)
    const unidadesVendidas = topItemsAll.reduce((sum, item) => sum + item.cantidad, 0)

    const porOperario = ventas.reduce((acc, v) => {
      const nombre = v.nombre_vendedor?.trim() || 'Sin vendedor'
      if (!acc[nombre]) {
        acc[nombre] = { unidades: 0, ingresos: 0, ventas: 0, articulos: new Set<string>() }
      }
      acc[nombre].ventas += 1
      for (const item of v.items ?? []) {
        const qty = Number(item.cantidad) || 0
        acc[nombre].unidades += qty
        acc[nombre].ingresos += Number(item.precio_total) || 0
        const key = (item.descripcion || item.codigo_articulo || '').trim()
        if (key) acc[nombre].articulos.add(key)
      }
      return acc
    }, {} as Record<string, { unidades: number; ingresos: number; ventas: number; articulos: Set<string> }>)

    const articulosPorOperario = Object.entries(porOperario)
      .map(([nombre, datos]) => ({
        nombre,
        unidades: datos.unidades,
        ingresos: datos.ingresos,
        ventas: datos.ventas,
        articulos: datos.articulos.size
      }))
      .sort((a, b) => b.unidades - a.unidades || b.ingresos - a.ingresos)

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
      topItems,
      articulosDistintos: topItemsAll.length,
      ingresosArticulos,
      unidadesVendidas,
      articulosPorOperario
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

        <div className="grafico-card grafico-card--articulos">
          <div className="articulos-rank__head">
            <div>
              <h3>Artículos por operario</h3>
              <p>Unidades vendidas por quien registró la venta, en el período</p>
            </div>
          </div>
          {estadisticas.articulosPorOperario.length === 0 ? (
            <p className="articulos-rank__empty">No hay ventas en este período.</p>
          ) : (
            <ol className="articulos-rank">
              {estadisticas.articulosPorOperario.map((op) => {
                const maxUnidades = estadisticas.articulosPorOperario[0]?.unidades || 1
                return (
                  <li key={op.nombre} className="articulos-rank__row articulos-rank__row--operario">
                    <div className="articulos-rank__main">
                      <div className="articulos-rank__name" title={op.nombre}>{op.nombre}</div>
                      <div className="articulos-rank__bar" aria-hidden>
                        <span style={{ width: `${Math.max(4, (op.unidades / maxUnidades) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="articulos-rank__stat">
                      <span>Ventas</span>
                      <strong>{op.ventas}</strong>
                    </div>
                    <div className="articulos-rank__stat">
                      <span>Artículos distintos</span>
                      <strong>{op.articulos}</strong>
                    </div>
                    <div className="articulos-rank__stat articulos-rank__stat--money">
                      <span>Unidades</span>
                      <strong>{op.unidades.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="articulos-rank__stat">
                      <span>Ingresos</span>
                      <strong>
                        ${op.ingresos.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="grafico-card grafico-card--articulos">
          <div className="articulos-rank__head">
            <div>
              <h3>Artículos más vendidos</h3>
              <p>Top 10 por ingresos en el período</p>
            </div>
          </div>
          <div className="articulos-kpis">
            <div className="articulos-kpi">
              <span>Artículos distintos</span>
              <strong>{estadisticas.articulosDistintos}</strong>
            </div>
            <div className="articulos-kpi">
              <span>Unidades</span>
              <strong>
                {estadisticas.unidadesVendidas.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="articulos-kpi">
              <span>Ingresos en artículos</span>
              <strong>
                ${estadisticas.ingresosArticulos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="articulos-kpi">
              <span>Líder del período</span>
              <strong>
                {estadisticas.ingresosArticulos > 0 && estadisticas.topItems[0]
                  ? `${((estadisticas.topItems[0].ingresos / estadisticas.ingresosArticulos) * 100).toFixed(1)}%`
                  : '—'}
              </strong>
            </div>
          </div>
          {estadisticas.topItems.length === 0 ? (
            <p className="articulos-rank__empty">No hay artículos vendidos en este período.</p>
          ) : (
            <ol className="articulos-rank">
              {estadisticas.topItems.map((item, index) => {
                const maxIngresos = estadisticas.topItems[0]?.ingresos || 1
                const share = estadisticas.ingresosArticulos > 0
                  ? (item.ingresos / estadisticas.ingresosArticulos) * 100
                  : 0
                const promedio = item.cantidad > 0 ? item.ingresos / item.cantidad : 0
                return (
                  <li key={item.nombre} className="articulos-rank__row">
                    <span className="articulos-rank__pos">{index + 1}</span>
                    <div className="articulos-rank__main">
                      <div className="articulos-rank__name" title={item.nombre}>{item.nombre}</div>
                      <div className="articulos-rank__bar" aria-hidden>
                        <span style={{ width: `${Math.max(4, (item.ingresos / maxIngresos) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="articulos-rank__stat">
                      <span>Cantidad</span>
                      <strong>{item.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="articulos-rank__stat">
                      <span>Precio prom.</span>
                      <strong>
                        ${promedio.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                    <div className="articulos-rank__stat articulos-rank__stat--money">
                      <span>Ingresos</span>
                      <strong>
                        ${item.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div className="articulos-rank__share">{share.toFixed(1)}%</div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportesVentasPage

