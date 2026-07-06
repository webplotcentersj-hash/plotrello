import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { etiquetaOperarioAsignado } from '../utils/etiquetaUsuarioNombre'
import type { OrdenTrabajo } from '../types/api'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import PlotCenterDesignToolsGrid from '../components/diseno/PlotCenterDesignToolsGrid'
import './DisenoDashboardPage.css'

const DisenoDashboardPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ordenesEnProceso, setOrdenesEnProceso] = useState<OrdenTrabajo[]>([])
  const [ordenesPendientes, setOrdenesPendientes] = useState<OrdenTrabajo[]>([])
  
  const [metricas, setMetricas] = useState({
    proyectosIniciados: 0,
    proyectosEnProceso: 0,
    proyectosCompletados: 0,
    proyectosPendientes: 0,
    tiempoPromedio: 0,
    proyectosPorDiseñador: {} as Record<string, number>
  })

  const [datosGraficos, setDatosGraficos] = useState<{
    proyectosPorDia: Array<{ fecha: string; iniciados: number; completados: number }>
    distribucionEstados: Array<{ name: string; value: number; color: string }>
    proyectosPorDiseñador: Array<{ nombre: string; cantidad: number }>
  }>({
    proyectosPorDia: [],
    distribucionEstados: [],
    proyectosPorDiseñador: []
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const ordenesResponse = await apiService.getOrdenes()
      if (ordenesResponse.success && ordenesResponse.data) {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)

        // Filtrar órdenes de diseño gráfico
        const ordenesDisenoFiltradas = ordenesResponse.data.filter((orden) => {
          const sector = orden.sector || ''
          return sector === 'Diseño Gráfico' || sector === 'Diseño en Proceso' || 
                 orden.sectores?.includes('Diseño Gráfico') || 
                 orden.sectores?.includes('Diseño en Proceso')
        })

        // Órdenes en proceso
        const enProceso = ordenesDisenoFiltradas.filter(
          (orden) => orden.estado === 'Diseño en Proceso'
        )
        setOrdenesEnProceso(enProceso)

        // Órdenes pendientes (Diseño Gráfico)
        const pendientes = ordenesDisenoFiltradas.filter(
          (orden) => orden.estado === 'Diseño Gráfico'
        )
        setOrdenesPendientes(pendientes)

        // Órdenes completadas hoy
        const completadasHoy = ordenesDisenoFiltradas.filter((orden) => {
          // Consideramos completadas las que pasaron a otro sector hoy
          if (!orden.fecha_creacion) return false
          const fechaCreacion = new Date(orden.fecha_creacion)
          fechaCreacion.setHours(0, 0, 0, 0)
          return fechaCreacion.getTime() === hoy.getTime() && 
                 orden.estado !== 'Diseño Gráfico' && 
                 orden.estado !== 'Diseño en Proceso'
        })

        // Calcular métricas
        const proyectosPorDiseñador: Record<string, number> = {}
        ordenesDisenoFiltradas.forEach((orden) => {
          const diseñador = etiquetaOperarioAsignado(
            orden.operario_asignado || orden.usuario_trabajando_nombre
          )
          proyectosPorDiseñador[diseñador] = (proyectosPorDiseñador[diseñador] || 0) + 1
        })

        setMetricas({
          proyectosIniciados: ordenesDisenoFiltradas.length,
          proyectosEnProceso: enProceso.length,
          proyectosCompletados: completadasHoy.length,
          proyectosPendientes: pendientes.length,
          tiempoPromedio: 0, // Se calculará cuando implementemos tiempo de trabajo
          proyectosPorDiseñador
        })

        // Preparar datos para gráficos (últimos 7 días)
        const ultimos7Dias = []
        for (let i = 6; i >= 0; i--) {
          const fecha = new Date()
          fecha.setDate(fecha.getDate() - i)
          fecha.setHours(0, 0, 0, 0)
          
          const proyectosDia = ordenesDisenoFiltradas.filter((orden) => {
            if (!orden.fecha_creacion) return false
            try {
              const fechaCreacion = new Date(orden.fecha_creacion)
              fechaCreacion.setHours(0, 0, 0, 0)
              return fechaCreacion.getTime() === fecha.getTime()
            } catch (e) {
              return false
            }
          })

          const completadosDia = ordenesDisenoFiltradas.filter((orden) => {
            // Consideramos completados los que pasaron a otro sector ese día
            if (!orden.fecha_creacion) return false
            try {
              const fechaCreacion = new Date(orden.fecha_creacion)
              fechaCreacion.setHours(0, 0, 0, 0)
              return fechaCreacion.getTime() === fecha.getTime() && 
                     orden.estado !== 'Diseño Gráfico' && 
                     orden.estado !== 'Diseño en Proceso'
            } catch (e) {
              return false
            }
          })

          ultimos7Dias.push({
            fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
            iniciados: proyectosDia.length,
            completados: completadosDia.length
          })
        }

        // Distribución de estados
        const distribucionEstados = [
          { name: 'Pendientes', value: pendientes.length, color: '#f97316' },
          { name: 'En Proceso', value: enProceso.length, color: '#ef4444' },
          { name: 'Completados', value: completadasHoy.length, color: '#10b981' }
        ].filter(item => item.value > 0)

        // Proyectos por diseñador
        const proyectosPorDiseñadorArray = Object.entries(proyectosPorDiseñador)
          .map(([nombre, cantidad]) => ({ nombre, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 5)

        setDatosGraficos({
          proyectosPorDia: ultimos7Dias,
          distribucionEstados,
          proyectosPorDiseñador: proyectosPorDiseñadorArray
        })
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="diseno-dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="diseno-dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🎨 Dashboard de Diseño Gráfico</h1>
          <div className="header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/diseno/plot-ai')}
            >
              Plot AI Studio
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/plot-design')}
            >
              Plot Design
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              Ver Tablero
            </button>
          </div>
        </div>
      </header>

      <section className="herramientas-diseno-section" id="herramientas">
        <h2>🔧 Herramientas Plot Center</h2>
        <p className="herramientas-diseno-intro">
          Accesos directos a las herramientas web del equipo de diseño.
        </p>
        <PlotCenterDesignToolsGrid />
      </section>

      {/* Métricas */}
      <section className="metricas-section">
        <h2>📊 Métricas del Día</h2>
        <div className="metricas-grid">
          <div className="metrica-card">
            <div className="metrica-icon">📝</div>
            <div className="metrica-content">
              <div className="metrica-value">{metricas.proyectosIniciados}</div>
              <div className="metrica-label">Proyectos Totales</div>
            </div>
          </div>
          <div className="metrica-card proceso">
            <div className="metrica-icon">🔄</div>
            <div className="metrica-content">
              <div className="metrica-value">{metricas.proyectosEnProceso}</div>
              <div className="metrica-label">En Proceso</div>
            </div>
          </div>
          <div className="metrica-card pendiente">
            <div className="metrica-icon">⏸️</div>
            <div className="metrica-content">
              <div className="metrica-value">{metricas.proyectosPendientes}</div>
              <div className="metrica-label">Pendientes</div>
            </div>
          </div>
          <div className="metrica-card completado">
            <div className="metrica-icon">✅</div>
            <div className="metrica-content">
              <div className="metrica-value">{metricas.proyectosCompletados}</div>
              <div className="metrica-label">Completados Hoy</div>
            </div>
          </div>
        </div>
      </section>

      {/* Gráficos Estadísticos */}
      <section className="graficos-section">
        <h2>📈 Estadísticas y Gráficos</h2>
        <div className="graficos-grid">
          {/* Gráfico de líneas - Proyectos iniciados vs completados */}
          {datosGraficos.proyectosPorDia.length > 0 && (
            <div className="grafico-card">
              <h3>Proyectos Iniciados vs Completados (Últimos 7 Días)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={datosGraficos.proyectosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="iniciados" stroke="#f97316" name="Iniciados" strokeWidth={2} />
                  <Line type="monotone" dataKey="completados" stroke="#10b981" name="Completados" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico circular - Distribución de estados */}
          {datosGraficos.distribucionEstados.length > 0 && (
            <div className="grafico-card">
              <h3>Distribución de Estados</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={datosGraficos.distribucionEstados}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {datosGraficos.distribucionEstados.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico de barras - Proyectos por diseñador */}
          {datosGraficos.proyectosPorDiseñador.length > 0 && (
            <div className="grafico-card">
              <h3>Proyectos por Diseñador</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosGraficos.proyectosPorDiseñador}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Proyectos Pendientes */}
      <section className="proyectos-section">
        <div className="section-header">
          <h2>📋 Proyectos Pendientes</h2>
          <button 
            className="btn-link"
            onClick={() => navigate('/')}
          >
            Ver todas →
          </button>
        </div>
        {ordenesPendientes.length === 0 ? (
          <div className="empty-state">
            <p>No hay proyectos pendientes en este momento</p>
          </div>
        ) : (
          <div className="proyectos-grid">
            {ordenesPendientes.slice(0, 6).map((orden) => (
              <div key={orden.id} className="proyecto-card pendiente">
                <div className="proyecto-header">
                  <h3>OP #{orden.numero_op}</h3>
                  <span className="badge pendiente-badge">Pendiente</span>
                </div>
                <div className="proyecto-cliente">{orden.cliente}</div>
                {orden.fecha_entrega && (
                  <div className="proyecto-fecha">
                    Entrega: {new Date(orden.fecha_entrega).toLocaleDateString('es-AR')}
                  </div>
                )}
                <button 
                  className="btn-small"
                  onClick={() => navigate(`/op/${orden.numero_op}`)}
                >
                  Ver Detalles
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Proyectos en Proceso */}
      {ordenesEnProceso.length > 0 && (
        <section className="proyectos-section">
          <h2>🔄 Proyectos en Proceso</h2>
          <div className="proyectos-grid">
            {ordenesEnProceso.slice(0, 6).map((orden) => (
              <div key={orden.id} className="proyecto-card proceso">
                <div className="proyecto-header">
                  <h3>OP #{orden.numero_op}</h3>
                  <span className="badge proceso-badge">En Proceso</span>
                </div>
                <div className="proyecto-cliente">{orden.cliente}</div>
                {orden.operario_asignado && (
                  <div className="proyecto-diseñador">
                    Diseñador: {etiquetaOperarioAsignado(orden.operario_asignado)}
                  </div>
                )}
                <button 
                  className="btn-small"
                  onClick={() => navigate(`/op/${orden.numero_op}`)}
                >
                  Ver Detalles
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default DisenoDashboardPage

