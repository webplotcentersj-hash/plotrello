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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

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
          
          // Generar QR
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
          const qrUrl = `${baseUrl}/op-public/${opNumber}`
          const qrData = await generateQR(qrUrl)
          setQrDataUrl(qrData)
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

  const estadoColor = useMemo(() => {
    if (!orden) return '#6b7280'
    
    const colorMap: Record<string, string> = {
      'Pendiente': '#9ca3af',
      'Diseño Gráfico': '#3b82f6',
      'Diseño en Proceso': '#3b82f6',
      'En Espera': '#f59e0b',
      'Imprenta (Área de Impresión)': '#8b5cf6',
      'Taller de Imprenta': '#8b5cf6',
      'Taller Gráfico': '#10b981',
      'Instalaciones': '#f97316',
      'Metalúrgica': '#06b6d4',
      'Finalizado en Taller': '#22c55e',
      'Almacén de Entrega': '#22c55e',
      'Entregado o Instalado': '#16a34a'
    }
    
    return colorMap[orden.estado] || '#6b7280'
  }, [orden])

  if (loading) {
    return (
      <div className="op-public-page">
        <div className="op-public-container">
          <div className="loading-spinner">Cargando...</div>
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
            <div className="logo-placeholder">
              <span className="logo-text">PLOT CENTER</span>
            </div>
          </div>
          <div className="op-info">
            <h1 className="op-number">OP {orden.numero_op}</h1>
            <h2 className="cliente-name">{orden.cliente}</h2>
          </div>
        </div>

        <div className="op-public-content">
          <div className="estado-section">
            <div className="estado-badge" style={{ backgroundColor: `${estadoColor}20`, color: estadoColor, borderColor: estadoColor }}>
              <span className="estado-label">Estado:</span>
              <span className="estado-value">{estadoDisplay}</span>
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
            
            {orden.prioridad && (
              <div className="info-item">
                <span className="info-label">Prioridad:</span>
                <span className="info-value">{orden.prioridad}</span>
              </div>
            )}
          </div>

          <div className="qr-section">
            <p className="qr-instructions">Escaneá el código QR para consultar el estado de tu orden</p>
            <div className="qr-code-container">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Código QR" style={{ maxWidth: '100%', height: 'auto' }} />
              ) : (
                <div style={{ padding: '20px', color: '#6b7280' }}>Generando QR...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpPublicPage

