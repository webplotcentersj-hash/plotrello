import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenSeguimientoPublico } from '../types/api'
import './OpPublicPage.css'

const OpPublicPage = () => {
  const { opNumber } = useParams<{ opNumber: string }>()
  const [orden, setOrden] = useState<OrdenSeguimientoPublico | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publicUrl = typeof window !== 'undefined' ? window.location.href : ''

  const loadOrden = async (isRefresh = false) => {
    if (!opNumber) {
      setError('Número de OP no proporcionado')
      setLoading(false)
      return
    }
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const response = await apiService.getOrdenSeguimientoPublico(opNumber)
      if (response.success && response.data) {
        setOrden(response.data)
      } else {
        setError('No se encontró la orden de trabajo')
      }
    } catch (err) {
      setError('Error al cargar la orden')
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadOrden()
  }, [opNumber])

  // Estado mostrado al cliente: texto corto y personalizado ("tu orden")
  const estadoDisplay = useMemo(() => {
    if (!orden) return 'No disponible'
    
    const estadosMap: Record<string, string> = {
      'Pendiente': 'Recibimos tu pedido',
      'Asesor Técnico': 'Revisando tu pedido',
      'Presupuestos': 'Preparando tu presupuesto',
      'Finalizado Asesor Presupuestos': 'Tu presupuesto está listo',
      'Diseño Gráfico': 'Diseñando tu trabajo',
      'Diseño en Proceso': 'Diseñando tu trabajo',
      'En Espera': 'En cola de producción',
      'Imprenta (Área de Impresión)': 'Imprimiendo tu trabajo',
      'Taller de Imprenta': 'En taller de impresión',
      'Taller Gráfico': 'En taller gráfico',
      'Instalaciones': 'Instalando tu trabajo',
      'Metalúrgica': 'Fabricando estructuras',
      'Finalizado en Taller': 'Listo en taller',
      'Almacén de Entrega': 'Listo para retirar',
      'Entregado o Instalado': 'Entregado'
    }
    
    return estadosMap[orden.estado] || orden.estado
  }, [orden])

  // Mapeo de estados a colores de sectores (igual que en el programa)
  const estadoColor = useMemo(() => {
    if (!orden) return '#6B7280'
    
    const colorMap: Record<string, string> = {
      'Pendiente': '#6B7280',
      'Asesor Técnico': '#8b5cf6', // Violeta
      'Presupuestos': '#8b5cf6',
      'Finalizado Asesor Presupuestos': '#10b981',
      'Diseño Gráfico': '#f97316', // Naranja
      'Diseño en Proceso': '#f97316',
      'En Espera': '#6B7280',
      'Imprenta (Área de Impresión)': '#0ea5e9', // Azul claro
      'Taller de Imprenta': '#0ea5e9',
      'Taller Gráfico': '#6366f1', // Índigo
      'Instalaciones': '#a855f7', // Púrpura
      'Metalúrgica': '#ec4899', // Rosa
      'Finalizado en Taller': '#10b981', // Verde
      'Almacén de Entrega': '#10b981',
      'Mostrador': '#10b981',
      'Caja': '#facc15', // Amarillo
      'Entregado o Instalado': '#16a34a' // Verde oscuro
    }
    
    return colorMap[orden.estado] || '#6B7280'
  }, [orden])

  // Descripción personalizada para el cliente (tuteo, mensaje claro)
  const estadoDescripcion = useMemo(() => {
    if (!orden) return ''
    
    const descripcionesMap: Record<string, string> = {
      'Pendiente': 'Tu pedido fue recibido. Pronto lo asignaremos a producción.',
      'Asesor Técnico': 'Estamos revisando las especificaciones de tu trabajo para planificar los siguientes pasos.',
      'Presupuestos': 'Estamos preparando tu presupuesto. Te contactaremos cuando esté listo.',
      'Finalizado Asesor Presupuestos': 'Tu presupuesto está listo. Podés aprobarlo para que avancemos con la producción.',
      'Diseño Gráfico': 'Estamos diseñando tu pieza y preparando los archivos para imprimir.',
      'Diseño en Proceso': 'Seguimos trabajando en el diseño. Cualquier cambio lo coordinamos con vos.',
      'En Espera': 'Tu trabajo está en cola. En breve lo tomamos para producción.',
      'Imprenta (Área de Impresión)': 'Tu trabajo se está imprimiendo en nuestros equipos.',
      'Taller de Imprenta': 'Estamos en la etapa de impresión y acabados.',
      'Taller Gráfico': 'Estamos con corte, ploteo o acabados de tu trabajo.',
      'Instalaciones': 'Estamos instalando o colocando tu trabajo en el lugar acordado.',
      'Metalúrgica': 'Estamos fabricando las estructuras o soportes de tu trabajo.',
      'Finalizado en Taller': 'El trabajo en taller ya está terminado. Próximo paso: entrega o instalación.',
      'Almacén de Entrega': '¡Tu pedido está listo! Podés pasar a retirarlo o coordinamos la entrega.',
      'Mostrador': 'Tu pedido está en mostrador. Podés acercarte a retirarlo.',
      'Caja': 'Tu pedido está en caja. Podés pasar a retirarlo y abonar.',
      'Entregado o Instalado': 'Tu pedido fue entregado o instalado. ¡Gracias por confiar en nosotros!'
    }
    
    return descripcionesMap[orden.estado] || 'Te mantendremos informado sobre el avance de tu pedido.'
  }, [orden])

  if (loading) {
    return (
      <div className="op-public-page">
        <div className="op-public-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando información de la orden...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !orden) {
    return (
      <div className="op-public-page">
        <div className="op-public-container">
          <div className="error-message">
            <h2>OP {opNumber}</h2>
            <p>{error || 'No se encontró la orden de trabajo'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="op-public-page">
      <div className="op-public-container">
        <div className="op-public-header">
          <div className="logo-section">
            <img 
              src="https://www.plotcenterlab.com.ar/Group%20187.png" 
              alt="Plot Center Logo" 
              className="logo-img"
            />
          </div>
          <div className="op-info">
            <h1 className="op-number">OP {orden.numero_op}</h1>
            <h2 className="cliente-name">{orden.cliente}</h2>
          </div>
        </div>

        <div className="op-public-content">
          <div className="estado-section">
            <div className="estado-badge" style={{ backgroundColor: `${estadoColor}20`, borderColor: estadoColor }}>
              <span className="estado-label" style={{ color: '#1f2937' }}>Tu pedido:</span>
              <span className="estado-value" style={{ color: estadoColor, fontWeight: '700' }}>{estadoDisplay}</span>
            </div>
            {estadoDescripcion && (
              <p className="estado-descripcion">{estadoDescripcion}</p>
            )}
            <p className="estado-ayuda">Este enlace muestra el estado actual de tu orden. Podés actualizar cuando quieras para ver los cambios.</p>
            <div className="op-public-actions">
              <button
                type="button"
                className="btn-actualizar-estado"
                onClick={() => loadOrden(true)}
                disabled={refreshing}
              >
                {refreshing ? 'Actualizando...' : 'Actualizar estado'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Estado de mi orden ${orden.numero_op} (${orden.cliente}): ${estadoDisplay}\n${publicUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-compartir-whatsapp"
              >
                Compartir por WhatsApp
              </a>
            </div>
          </div>

          {orden.descripcion && (
            <div className="descripcion-section">
              <h3>Descripción</h3>
              <p>{orden.descripcion}</p>
            </div>
          )}

          <div className="info-grid">
            {orden.fecha_entrega && (
              <div className="info-item">
                <span className="info-label">Fecha de Entrega:</span>
                <span className="info-value">
                  {new Date(orden.fecha_entrega).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="footer-link">
            <a href="https://plotcenter.com.ar/" target="_blank" rel="noopener noreferrer" className="plotcenter-link">
              Visita nuestro sitio web: plotcenter.com.ar
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpPublicPage

