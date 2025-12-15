import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import RegistrarAtencionModal from '../components/RegistrarAtencionModal'
import type { OrdenTrabajo } from '../types/api'
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
  const { isAdmin } = useAuth()
  const [ordenesCreadasCount, setOrdenesCreadasCount] = useState(0)
  
  const handleRegistrarAtencionSuccess = () => {
    loadAtencionesHoy()
    if (isAdmin) {
      loadMetricas(ordenesCreadasCount)
    }
  }
  const [loading, setLoading] = useState(true)
  const [ordenesListas, setOrdenesListas] = useState<OrdenTrabajo[]>([])
  const [ordenesPendientesHoy, setOrdenesPendientesHoy] = useState<OrdenTrabajo[]>([])
  const [atencionesHoy, setAtencionesHoy] = useState<Atencion[]>([])
  const [, setOrdenesCreadasHoy] = useState<OrdenTrabajo[]>([])
  const [ordenesActivas, setOrdenesActivas] = useState<OrdenTrabajo[]>([])
  const [showRegistrarAtencion, setShowRegistrarAtencion] = useState(false)
  
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

  const loadAtencionesHoy = async () => {
    try {
      // Por ahora usar localStorage hasta crear la tabla en Supabase
      const atencionesGuardadas = localStorage.getItem('atenciones_mostrador')
      if (atencionesGuardadas) {
        const todasAtenciones: Atencion[] = JSON.parse(atencionesGuardadas)
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        
        const atencionesHoy = todasAtenciones.filter((atencion) => {
          const fechaAtencion = new Date(atencion.timestamp)
          fechaAtencion.setHours(0, 0, 0, 0)
          return fechaAtencion.getTime() === hoy.getTime()
        })
        setAtencionesHoy(atencionesHoy)
      }
    } catch (error) {
      console.error('Error cargando atenciones:', error)
    }
  }

  const loadMetricas = async (ordenesCreadasCount: number = 0) => {
    try {
      const atencionesGuardadas = localStorage.getItem('atenciones_mostrador')
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      let atencionesHoy: Atencion[] = []
      if (atencionesGuardadas) {
        const todasAtenciones: Atencion[] = JSON.parse(atencionesGuardadas)
        atencionesHoy = todasAtenciones.filter((atencion) => {
          const fechaAtencion = new Date(atencion.timestamp)
          fechaAtencion.setHours(0, 0, 0, 0)
          return fechaAtencion.getTime() === hoy.getTime()
        })
      }

      setMetricas({
        totalAtenciones: atencionesHoy.length,
        atencionesVirtuales: atencionesHoy.filter(a => a.tipo === 'virtual').length,
        consultas: atencionesHoy.filter(a => a.tipo === 'consulta').length,
        ventasConcretadas: atencionesHoy.filter(a => a.tipo === 'venta').length,
        ordenesCreadas: ordenesCreadasCount,
        ordenesEntregadas: 0 // Se calculará cuando implementemos entregas
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
              onClick={() => navigate('/board')}
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

      {/* Acciones Rápidas */}
      <section className="acciones-rapidas-section">
        <h2>⚡ Acciones Rápidas</h2>
        <div className="acciones-grid">
          <button 
            className="accion-card"
            onClick={() => setShowRegistrarAtencion(true)}
          >
            <div className="accion-icon">📝</div>
            <div className="accion-label">Registrar Atención</div>
          </button>
          <button 
            className="accion-card"
            onClick={() => navigate('/board')}
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
    </div>
  )
}

export default MostradorDashboardPage

