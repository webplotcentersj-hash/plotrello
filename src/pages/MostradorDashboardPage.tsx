import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import RegistrarAtencionModal from '../components/RegistrarAtencionModal'
import type { OrdenTrabajo } from '../types/api'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './MostradorDashboardPage.css'

type TipoAtencion = 'virtual' | 'consulta' | 'venta'
type Atencion = {
  id: number
  cliente_id?: number
  cliente_nombre: string
  tipo: TipoAtencion
  orden_id?: number
  usuario_id: number
  usuario_nombre: string
  timestamp: string
  notas?: string
}

const MostradorDashboardPage = () => {
  const navigate = useNavigate()
  const { isAdmin, usuario } = useAuth()
  const [ordenesCreadasCount, setOrdenesCreadasCount] = useState(0)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [registrandoRapido, setRegistrandoRapido] = useState(false)
  
  const handleRegistrarAtencionSuccess = async () => {
    await loadAtencionesHoy()
    if (isAdmin) {
      // Recalcular órdenes creadas hoy antes de cargar métricas
      try {
        const ordenesResponse = await apiService.getOrdenes()
        if (ordenesResponse.success && ordenesResponse.data) {
          const hoy = new Date()
          hoy.setHours(0, 0, 0, 0)
          const creadasHoy = ordenesResponse.data.filter((orden) => {
            if (!orden.fecha_creacion) return false
            const fechaCreacion = new Date(orden.fecha_creacion)
            fechaCreacion.setHours(0, 0, 0, 0)
            return fechaCreacion.getTime() === hoy.getTime()
          })
          await loadMetricas(creadasHoy.length)
        } else {
          await loadMetricas(ordenesCreadasCount)
        }
      } catch (error) {
        console.error('Error recalculando métricas:', error)
        await loadMetricas(ordenesCreadasCount)
      }
    }
  }
  const [loading, setLoading] = useState(true)
  const [ordenesListas, setOrdenesListas] = useState<OrdenTrabajo[]>([])
  const [ordenesPendientesHoy, setOrdenesPendientesHoy] = useState<OrdenTrabajo[]>([])
  const [atencionesHoy, setAtencionesHoy] = useState<Atencion[]>([])
  const [, setOrdenesCreadasHoy] = useState<OrdenTrabajo[]>([])
  const [ordenesActivas, setOrdenesActivas] = useState<OrdenTrabajo[]>([])
  const [showRegistrarAtencion, setShowRegistrarAtencion] = useState(false)
  const [datosGraficos, setDatosGraficos] = useState({
    atencionesPorDia: [] as Array<{ fecha: string; virtual: number; consulta: number; venta: number; total: number }>,
    distribucionTipos: [] as Array<{ name: string; value: number; color: string }>,
    ordenesPorDia: [] as Array<{ fecha: string; creadas: number; entregadas: number }>
  })
  
  // Métricas (solo admin)
  const [metricas, setMetricas] = useState({
    totalAtenciones: 0,
    atencionesVirtuales: 0,
    consultas: 0,
    ventasConcretadas: 0,
    ordenesCreadas: 0,
    ordenesEntregadas: 0
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Cargar órdenes listas para retirar
      const ordenesResponse = await apiService.getOrdenes()
      if (ordenesResponse.success && ordenesResponse.data) {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        
        // Órdenes listas para retirar (Finalizado en Taller o Almacén de Entrega)
        const listas = ordenesResponse.data.filter(
          (orden) => orden.estado === 'Finalizado en Taller' || orden.estado === 'Almacén de Entrega'
        )
        setOrdenesListas(listas)

        // Órdenes pendientes de entrega hoy
        const pendientesHoy = ordenesResponse.data.filter((orden) => {
          if (!orden.fecha_entrega) return false
          const fechaEntrega = new Date(orden.fecha_entrega)
          fechaEntrega.setHours(0, 0, 0, 0)
          return fechaEntrega.getTime() === hoy.getTime() && 
                 orden.estado !== 'Entregado o Instalado'
        })
        setOrdenesPendientesHoy(pendientesHoy)

        // Órdenes creadas hoy
        const creadasHoy = ordenesResponse.data.filter((orden) => {
          if (!orden.fecha_creacion) return false
          const fechaCreacion = new Date(orden.fecha_creacion)
          fechaCreacion.setHours(0, 0, 0, 0)
          return fechaCreacion.getTime() === hoy.getTime()
        })
        setOrdenesCreadasHoy(creadasHoy)
        setOrdenesCreadasCount(creadasHoy.length)

        // Órdenes activas (no finalizadas ni entregadas)
        const activas = ordenesResponse.data.filter(
          (orden) => 
            orden.estado !== 'Entregado o Instalado' &&
            orden.estado !== 'Finalizado en Taller' &&
            orden.estado !== 'Almacén de Entrega'
        )
        setOrdenesActivas(activas)

        // Cargar atenciones del día (si existe la tabla)
        await loadAtencionesHoy()

        // Cargar métricas si es admin (después de cargar todos los datos)
        if (isAdmin) {
          await loadMetricas(creadasHoy.length)
        }
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const registrarAtencionRapida = useCallback(
    async (tipo: TipoAtencion) => {
      if (!usuario) {
        alert('Debes estar autenticado para registrar la atención')
        return
      }
      setRegistrandoRapido(true)
      try {
        const resp = await apiService.crearAtencionMostrador({
          cliente_nombre: 'Cliente mostrador',
          tipo,
          usuario_id: Number(usuario.id),
          usuario_nombre: usuario.nombre || 'Mostrador',
          notas: 'Registro rápido'
        })
        if (!resp.success) {
          throw new Error(resp.error || 'No se pudo registrar')
        }
        await handleRegistrarAtencionSuccess()
        setShowFabMenu(false)
      } catch (error) {
        console.error('Error en registro rápido:', error)
        alert('No se pudo registrar la atención rápida')
      } finally {
        setRegistrandoRapido(false)
      }
    },
    [usuario, handleRegistrarAtencionSuccess]
  )

  // Atajos de teclado para registro rápido
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!usuario) return
      if (e.altKey && e.key === '1') {
        e.preventDefault()
        registrarAtencionRapida('virtual')
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault()
        registrarAtencionRapida('consulta')
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault()
        registrarAtencionRapida('venta')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [usuario, registrarAtencionRapida])

  const loadAtencionesHoy = async () => {
    try {
      // Obtener atenciones de hoy desde la base de datos
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const hoyInicio = hoy.toISOString()
      const hoyFin = new Date(hoy)
      hoyFin.setHours(23, 59, 59, 999)
      const hoyFinISO = hoyFin.toISOString()

      const response = await apiService.obtenerAtencionesMostrador(hoyInicio, hoyFinISO)
      
      if (response.success && response.data) {
        // Convertir formato de base de datos a formato de componente
        const atencionesHoy: Atencion[] = response.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
        setAtencionesHoy(atencionesHoy)
      } else {
        console.error('Error obteniendo atenciones:', response.error)
        setAtencionesHoy([])
      }
    } catch (error) {
      console.error('Error cargando atenciones:', error)
      setAtencionesHoy([])
    }
  }

  const loadMetricas = async (ordenesCreadasCount: number = 0) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      // Obtener atenciones de hoy desde la base de datos
      const hoyInicio = hoy.toISOString()
      const hoyFin = new Date(hoy)
      hoyFin.setHours(23, 59, 59, 999)
      const hoyFinISO = hoyFin.toISOString()

      const atencionesResponse = await apiService.obtenerAtencionesMostrador(hoyInicio, hoyFinISO)
      let atencionesHoy: Atencion[] = []
      
      if (atencionesResponse.success && atencionesResponse.data) {
        atencionesHoy = atencionesResponse.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
      }

      // Obtener todas las atenciones de los últimos 7 días para gráficos
      const sieteDiasAtras = new Date()
      sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7)
      sieteDiasAtras.setHours(0, 0, 0, 0)
      const todasAtencionesResponse = await apiService.obtenerAtencionesMostrador(
        sieteDiasAtras.toISOString(),
        undefined
      )
      let todasAtenciones: Atencion[] = []
      
      if (todasAtencionesResponse.success && todasAtencionesResponse.data) {
        todasAtenciones = todasAtencionesResponse.data.map((atencion) => ({
          id: atencion.id,
          cliente_id: atencion.cliente_id || undefined,
          cliente_nombre: atencion.cliente_nombre,
          tipo: atencion.tipo,
          orden_id: atencion.orden_id || undefined,
          usuario_id: atencion.usuario_id,
          usuario_nombre: atencion.usuario_nombre,
          timestamp: atencion.fecha_atencion,
          notas: atencion.notas || undefined
        }))
      }

      // Calcular órdenes entregadas hoy
      let ordenesEntregadasHoy = 0
      try {
        const ordenesResponse = await apiService.getOrdenes()
        if (ordenesResponse.success && ordenesResponse.data && Array.isArray(ordenesResponse.data)) {
          ordenesEntregadasHoy = ordenesResponse.data.filter((orden) => {
            if (!orden.fecha_entrega) return false
            try {
              const fechaEntrega = new Date(orden.fecha_entrega)
              fechaEntrega.setHours(0, 0, 0, 0)
              return fechaEntrega.getTime() === hoy.getTime() && orden.estado === 'Entregado o Instalado'
            } catch (e) {
              console.warn('Error procesando fecha de entrega:', e, orden)
              return false
            }
          }).length
        }
      } catch (error) {
        console.error('Error obteniendo órdenes entregadas:', error)
      }

      setMetricas({
        totalAtenciones: atencionesHoy.length,
        atencionesVirtuales: atencionesHoy.filter(a => a.tipo === 'virtual').length,
        consultas: atencionesHoy.filter(a => a.tipo === 'consulta').length,
        ventasConcretadas: atencionesHoy.filter(a => a.tipo === 'venta').length,
        ordenesCreadas: ordenesCreadasCount,
        ordenesEntregadas: ordenesEntregadasHoy
      })

      // Preparar datos para gráficos (últimos 7 días)
      const ultimos7Dias = []
      for (let i = 6; i >= 0; i--) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() - i)
        fecha.setHours(0, 0, 0, 0)
        
        const atencionesDia = todasAtenciones.filter((atencion) => {
          try {
            const fechaAtencion = new Date(atencion.timestamp)
            fechaAtencion.setHours(0, 0, 0, 0)
            return fechaAtencion.getTime() === fecha.getTime()
          } catch (e) {
            return false
          }
        })

        ultimos7Dias.push({
          fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
          virtual: atencionesDia.filter(a => a.tipo === 'virtual').length,
          consulta: atencionesDia.filter(a => a.tipo === 'consulta').length,
          venta: atencionesDia.filter(a => a.tipo === 'venta').length,
          total: atencionesDia.length
        })
      }

      // Distribución de tipos de atención
      const distribucionTipos = [
        { name: 'Virtual', value: atencionesHoy.filter(a => a.tipo === 'virtual').length, color: '#8b5cf6' },
        { name: 'Consulta', value: atencionesHoy.filter(a => a.tipo === 'consulta').length, color: '#f59e0b' },
        { name: 'Venta', value: atencionesHoy.filter(a => a.tipo === 'venta').length, color: '#10b981' }
      ].filter(item => item.value > 0)

      // Órdenes por día (últimos 7 días)
      let ordenesPorDia = []
      try {
        const ordenesResponse = await apiService.getOrdenes()
        if (ordenesResponse.success && ordenesResponse.data && Array.isArray(ordenesResponse.data)) {
          for (let i = 6; i >= 0; i--) {
            const fecha = new Date()
            fecha.setDate(fecha.getDate() - i)
            fecha.setHours(0, 0, 0, 0)
            
            const ordenesDia = ordenesResponse.data.filter((orden) => {
              if (!orden.fecha_creacion) return false
              try {
                const fechaCreacion = new Date(orden.fecha_creacion)
                fechaCreacion.setHours(0, 0, 0, 0)
                return fechaCreacion.getTime() === fecha.getTime()
              } catch (e) {
                return false
              }
            })

            const entregadasDia = ordenesResponse.data.filter((orden) => {
              if (!orden.fecha_entrega) return false
              try {
                const fechaEntrega = new Date(orden.fecha_entrega)
                fechaEntrega.setHours(0, 0, 0, 0)
                return fechaEntrega.getTime() === fecha.getTime() && orden.estado === 'Entregado o Instalado'
              } catch (e) {
                return false
              }
            })

            ordenesPorDia.push({
              fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
              creadas: ordenesDia.length,
              entregadas: entregadasDia.length
            })
          }
        } else {
          // Si no hay datos, crear array vacío con fechas
          for (let i = 6; i >= 0; i--) {
            const fecha = new Date()
            fecha.setDate(fecha.getDate() - i)
            ordenesPorDia.push({
              fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
              creadas: 0,
              entregadas: 0
            })
          }
        }
      } catch (error) {
        console.error('Error obteniendo órdenes para gráficos:', error)
        // Crear array vacío con fechas
        for (let i = 6; i >= 0; i--) {
          const fecha = new Date()
          fecha.setDate(fecha.getDate() - i)
          ordenesPorDia.push({
            fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
            creadas: 0,
            entregadas: 0
          })
        }
      }

      setDatosGraficos({
        atencionesPorDia: ultimos7Dias,
        distribucionTipos,
        ordenesPorDia
      })
    } catch (error) {
      console.error('Error cargando métricas:', error)
    }
  }

  // Función para registrar atenciones (se usará cuando implementemos el registro)
  // Se exportará o usará cuando se implemente el formulario de registro
  // const registrarAtencion = async (tipo: TipoAtencion, clienteNombre: string, ordenId?: number, notas?: string) => {
  //   if (!usuario) return
  //
  //   const nuevaAtencion: Atencion = {
  //     id: Date.now(),
  //     cliente_nombre: clienteNombre,
  //     tipo,
  //     orden_id: ordenId,
  //     usuario_id: usuario.id,
  //     usuario_nombre: usuario.nombre,
  //     timestamp: new Date().toISOString(),
  //     notas
  //   }
  //
  //   // Guardar en localStorage (temporal hasta crear tabla en Supabase)
  //   const atencionesGuardadas = localStorage.getItem('atenciones_mostrador')
  //   const todasAtenciones: Atencion[] = atencionesGuardadas 
  //     ? JSON.parse(atencionesGuardadas) 
  //     : []
  //   
  //   todasAtenciones.push(nuevaAtencion)
  //   localStorage.setItem('atenciones_mostrador', JSON.stringify(todasAtenciones))
  //
  //   await loadAtencionesHoy()
  //   if (isAdmin) {
  //     await loadMetricas()
  //   }
  // }

  if (loading) {
    return (
      <div className="mostrador-dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mostrador-dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>📋 Dashboard de Mostrador</h1>
          <div className="header-actions">
            <button 
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              Ver Tablero
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/mostrador/ordenes-listas')}
            >
              Órdenes Listas
            </button>
          </div>
        </div>
      </header>

      {/* Métricas (solo admin) */}
      {isAdmin && (
        <section className="metricas-section">
          <h2>📊 Métricas del Día</h2>
          <div className="metricas-grid">
            <div className="metrica-card">
              <div className="metrica-icon">👥</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.totalAtenciones}</div>
                <div className="metrica-label">Personas Atendidas</div>
              </div>
            </div>
            <div className="metrica-card virtual">
              <div className="metrica-icon">💻</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.atencionesVirtuales}</div>
                <div className="metrica-label">Atenciones Virtuales</div>
              </div>
            </div>
            <div className="metrica-card consulta">
              <div className="metrica-icon">❓</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.consultas}</div>
                <div className="metrica-label">Solo Consultas</div>
              </div>
            </div>
            <div className="metrica-card venta">
              <div className="metrica-icon">💰</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.ventasConcretadas}</div>
                <div className="metrica-label">Ventas Concretadas</div>
              </div>
            </div>
            <div className="metrica-card">
              <div className="metrica-icon">📝</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.ordenesCreadas}</div>
                <div className="metrica-label">Órdenes Creadas</div>
              </div>
            </div>
            <div className="metrica-card">
              <div className="metrica-icon">✅</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.ordenesEntregadas}</div>
                <div className="metrica-label">Órdenes Entregadas</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Gráficos Estadísticos */}
      {isAdmin && (
        <section className="graficos-section">
          <h2>📈 Estadísticas y Gráficos</h2>
          <div className="graficos-grid">
            {/* Gráfico de barras - Atenciones por tipo (últimos 7 días) */}
            <div className="grafico-card">
              <h3>Atenciones por Tipo (Últimos 7 Días)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosGraficos.atencionesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="virtual" fill="#8b5cf6" name="Virtual" />
                  <Bar dataKey="consulta" fill="#f59e0b" name="Consulta" />
                  <Bar dataKey="venta" fill="#10b981" name="Venta" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico circular - Distribución de tipos de atención */}
            {datosGraficos.distribucionTipos.length > 0 && (
              <div className="grafico-card">
                <h3>Distribución de Atenciones Hoy</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={datosGraficos.distribucionTipos}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {datosGraficos.distribucionTipos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Gráfico de líneas - Órdenes creadas vs entregadas */}
            <div className="grafico-card">
              <h3>Órdenes Creadas vs Entregadas (Últimos 7 Días)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={datosGraficos.ordenesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="creadas" stroke="#3b82f6" name="Creadas" strokeWidth={2} />
                  <Line type="monotone" dataKey="entregadas" stroke="#10b981" name="Entregadas" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de líneas - Total de atenciones por día */}
            <div className="grafico-card">
              <h3>Total de Atenciones (Últimos 7 Días)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={datosGraficos.atencionesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#8b5cf6" name="Total Atenciones" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Acciones Rápidas */}
      <section className="acciones-rapidas-section">
        <h2>⚡ Acciones Rápidas</h2>
        <div className="acciones-grid">
          <button 
            className="accion-card"
            onClick={() => navigate('/')}
          >
            <div className="accion-icon">➕</div>
            <div className="accion-label">Crear Nueva Orden</div>
          </button>
          <button 
            className="accion-card"
            onClick={() => navigate('/mostrador/ordenes-listas')}
          >
            <div className="accion-icon">📦</div>
            <div className="accion-label">Órdenes Listas para Retirar</div>
            {ordenesListas.length > 0 && (
              <span className="badge">{ordenesListas.length}</span>
            )}
          </button>
          <button 
            className="accion-card"
            onClick={() => navigate('/mostrador/buscar-cliente')}
          >
            <div className="accion-icon">🔍</div>
            <div className="accion-label">Buscar Cliente</div>
            {ordenesActivas.length > 0 && (
              <span className="badge">{ordenesActivas.length} activas</span>
            )}
          </button>
          <button 
            className="accion-card"
            onClick={() => navigate('/mostrador/calendario')}
          >
            <div className="accion-icon">📅</div>
            <div className="accion-label">Calendario de Entregas</div>
          </button>
          <button 
            className="accion-card"
            onClick={() => navigate('/mostrador/clientes-frecuentes')}
          >
            <div className="accion-icon">⭐</div>
            <div className="accion-label">Clientes Frecuentes</div>
          </button>
          {isAdmin && (
            <button 
              className="accion-card"
              onClick={() => navigate('/mostrador/reportes')}
            >
              <div className="accion-icon">📊</div>
              <div className="accion-label">Reportes</div>
            </button>
          )}
        </div>
      </section>

      {/* Órdenes Listas para Retirar */}
      <section className="ordenes-listas-section">
        <div className="section-header">
          <h2>📦 Órdenes Listas para Retirar</h2>
          <button 
            className="btn-link"
            onClick={() => navigate('/mostrador/ordenes-listas')}
          >
            Ver todas →
          </button>
        </div>
        {ordenesListas.length === 0 ? (
          <div className="empty-state">
            <p>No hay órdenes listas para retirar en este momento</p>
          </div>
        ) : (
          <div className="ordenes-grid">
            {ordenesListas.slice(0, 6).map((orden) => (
              <div key={orden.id} className="orden-card ready">
                <div className="orden-header">
                  <h3>OP #{orden.numero_op}</h3>
                  <span className="badge ready-badge">Listo</span>
                </div>
                <div className="orden-cliente">{orden.cliente}</div>
                {orden.fecha_entrega && (
                  <div className="orden-fecha">
                    Entrega: {new Date(orden.fecha_entrega).toLocaleDateString('es-AR')}
                  </div>
                )}
                <button 
                  className="btn-small"
                  onClick={() => navigate(`/mostrador/entrega/${orden.id}`)}
                >
                  Ver Detalles
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Órdenes Pendientes Hoy */}
      {ordenesPendientesHoy.length > 0 && (
        <section className="pendientes-section">
          <h2>⏰ Entregas Programadas para Hoy</h2>
          <div className="ordenes-grid">
            {ordenesPendientesHoy.slice(0, 4).map((orden) => (
              <div key={orden.id} className="orden-card pending">
                <div className="orden-header">
                  <h3>OP #{orden.numero_op}</h3>
                  <span className="badge pending-badge">Pendiente</span>
                </div>
                <div className="orden-cliente">{orden.cliente}</div>
                {orden.fecha_entrega && (
                  <div className="orden-fecha">
                    {new Date(orden.fecha_entrega).toLocaleTimeString('es-AR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Registro de Atenciones Recientes */}
      {atencionesHoy.length > 0 && (
        <section className="atenciones-section">
          <h2>👥 Atenciones de Hoy</h2>
          <div className="atenciones-list">
            {atencionesHoy.slice(0, 10).map((atencion) => (
              <div key={atencion.id} className={`atencion-item ${atencion.tipo}`}>
                <div className="atencion-icon">
                  {atencion.tipo === 'virtual' && '💻'}
                  {atencion.tipo === 'consulta' && '❓'}
                  {atencion.tipo === 'venta' && '💰'}
                </div>
                <div className="atencion-content">
                  <div className="atencion-cliente">{atencion.cliente_nombre}</div>
                  <div className="atencion-meta">
                    {atencion.usuario_nombre} • {new Date(atencion.timestamp).toLocaleTimeString('es-AR')}
                  </div>
                </div>
                {atencion.orden_id && (
                  <div className="atencion-op">
                    OP #{atencion.orden_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal de Registrar Atención */}
      {showRegistrarAtencion && (
        <RegistrarAtencionModal
          onClose={() => setShowRegistrarAtencion(false)}
          onSuccess={handleRegistrarAtencionSuccess}
        />
      )}

      {/* Botón flotante para registrar atención */}
      <div className="fab-container">
        <button
          className="fab-button"
          onClick={() => setShowFabMenu((prev) => !prev)}
          title="Registrar Atención (Alt+1 Virtual, Alt+2 Consulta, Alt+3 Venta)"
        >
          {registrandoRapido ? '...' : '📝'}
        </button>
        {showFabMenu && (
          <div className="fab-menu" onMouseLeave={() => setShowFabMenu(false)}>
            <p className="fab-hint">Atajos: Alt+1 / Alt+2 / Alt+3</p>
            <button
              className="fab-option virtual"
              onClick={() => registrarAtencionRapida('virtual')}
              disabled={registrandoRapido}
            >
              💻 Virtual
            </button>
            <button
              className="fab-option consulta"
              onClick={() => registrarAtencionRapida('consulta')}
              disabled={registrandoRapido}
            >
              ❓ Consulta
            </button>
            <button
              className="fab-option venta"
              onClick={() => registrarAtencionRapida('venta')}
              disabled={registrandoRapido}
            >
              💰 Venta Concretada
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MostradorDashboardPage

