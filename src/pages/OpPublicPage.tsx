import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import './OpPublicPage.css'

const OpPublicPage = () => {
  const { opNumber } = useParams<{ opNumber: string }>()
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadOrden = async () => {
      if (!opNumber) {
        setError('Número de OP no proporcionado')
        setLoading(false)
        return
      }

      try {
        const response = await apiService.getOrdenByOpNumber(opNumber)
        if (response.success && response.data) {
          const ordenData = response.data as OrdenTrabajo
          setOrden(ordenData)
        } else {
          setError('No se encontró la orden de trabajo')
        }
      } catch (err) {
        setError('Error al cargar la orden')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadOrden()
  }, [opNumber])

  const estadoDisplay = useMemo(() => {
    if (!orden) return 'No disponible'
    
    const estadosMap: Record<string, string> = {
      'Pendiente': 'Pendiente',
      'Diseño Gráfico': 'En Diseño',
      'Diseño en Proceso': 'En Diseño',
      'En Espera': 'En Espera',
      'Imprenta (Área de Impresión)': 'En Imprenta',
      'Taller de Imprenta': 'En Taller',
      'Taller Gráfico': 'En Taller Gráfico',
      'Instalaciones': 'En Instalaciones',
      'Metalúrgica': 'En Metalúrgica',
      'Finalizado en Taller': 'Finalizado',
      'Almacén de Entrega': 'Listo para Entrega',
      'Entregado o Instalado': 'Entregado'
    }
    
    return estadosMap[orden.estado] || orden.estado
  }, [orden])

  // Mapeo de estados a colores de sectores (igual que en el programa)
  const estadoColor = useMemo(() => {
    if (!orden) return '#6B7280'
    
    const colorMap: Record<string, string> = {
      'Pendiente': '#6B7280',
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

  // Descripción del estado/sector - explica qué función cumple cada sector
  const estadoDescripcion = useMemo(() => {
    if (!orden) return ''
    
    const descripcionesMap: Record<string, string> = {
      'Pendiente': 'La orden está pendiente de asignación a un sector',
      'Diseño Gráfico': 'Se está diseñando la pieza gráfica, creando la identidad visual y preparando los archivos para producción',
      'Diseño en Proceso': 'El diseño está siendo desarrollado y revisado',
      'En Espera': 'La orden está en espera de ser procesada',
      'Imprenta (Área de Impresión)': 'Se está imprimiendo en equipos digitales de alta calidad',
      'Taller de Imprenta': 'Se están realizando trabajos de impresión offset, acabados y post-impresión',
      'Taller Gráfico': 'Se están realizando trabajos de corte, ploteo, laminado, termoformado y acabados especiales en materiales gráficos',
      'Instalaciones': 'Se están realizando trabajos de instalación, montaje y colocación de piezas gráficas en el lugar de destino',
      'Metalúrgica': 'Se están fabricando estructuras metálicas, marcos, soportes y elementos de herrería para las piezas gráficas',
      'Finalizado en Taller': 'Los trabajos de taller han sido completados',
      'Almacén de Entrega': 'La orden está lista y disponible para ser retirada o entregada',
      'Mostrador': 'La orden está en el área de atención al cliente, lista para consultas o retiro',
      'Caja': 'La orden está en el área de facturación y cobro',
      'Entregado o Instalado': 'La orden ha sido entregada al cliente o instalada en su ubicación final'
    }
    
    return descripcionesMap[orden.estado] || 'Estado de la orden'
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
              src="https://trello.plotcenter.com.ar/Group%20187.png" 
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
              <span className="estado-label" style={{ color: '#1f2937' }}>Estado:</span>
              <span className="estado-value" style={{ color: estadoColor, fontWeight: '700' }}>{estadoDisplay}</span>
            </div>
            {estadoDescripcion && (
              <p className="estado-descripcion">{estadoDescripcion}</p>
            )}
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

