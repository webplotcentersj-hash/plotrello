import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { HistorialEtapaTallerGrafico } from '../types/api'
import './HistorialEtapasTallerGrafico.css'

interface HistorialEtapasTallerGraficoProps {
  ordenId: number
}

const formatDateTime = (dateString: string) => {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString))
}

const formatTimeAgo = (dateString: string) => {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Hace unos segundos'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours} horas`
  if (diffDays < 7) return `Hace ${diffDays} días`
  return formatDateTime(dateString)
}

const getEtapaColor = (etapa: string): string => {
  const colores: Record<string, string> = {
    'Falta Material para Impresión o archivo': '#ef4444', // Rojo
    'En Proceso': '#3b82f6', // Azul
    'Para Cortar o Pegar': '#f59e0b', // Amarillo/Naranja
    'Para Rotular': '#8b5cf6', // Violeta
    'Instalaciones/Ploteo': '#10b981', // Verde
    'Metalurgica Instalacion': '#ec4899', // Rosa
    'laminas': '#06b6d4' // Cian
  }
  return colores[etapa] || '#6b7280'
}

const getEtapaIcon = (etapa: string): string => {
  const iconos: Record<string, string> = {
    'Falta Material para Impresión o archivo': '⚠️',
    'En Proceso': '⚙️',
    'Para Cortar o Pegar': '✂️',
    'Para Rotular': '🏷️',
    'Instalaciones/Ploteo': '🚚',
    'Metalurgica Instalacion': '🔧',
    'laminas': '📄'
  }
  return iconos[etapa] || '📍'
}

const HistorialEtapasTallerGrafico = ({ ordenId }: HistorialEtapasTallerGraficoProps) => {
  const [historial, setHistorial] = useState<HistorialEtapaTallerGrafico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHistorial = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiService.obtenerHistorialEtapasTallerGrafico(ordenId)
        if (response.success && response.data) {
          setHistorial(response.data)
        } else {
          setError(response.error || 'No se pudo cargar el historial')
        }
      } catch (err) {
        setError('Error al cargar el historial')
        console.error('Error cargando historial:', err)
      } finally {
        setLoading(false)
      }
    }

    if (ordenId) {
      void loadHistorial()
    }
  }, [ordenId])

  if (loading) {
    return (
      <div className="historial-etapas-loading">
        <span>Cargando historial...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="historial-etapas-error">
        <span>⚠️ {error}</span>
      </div>
    )
  }

  if (historial.length === 0) {
    return (
      <div className="historial-etapas-empty">
        <span>No hay historial de etapas registrado</span>
      </div>
    )
  }

  return (
    <div className="historial-etapas-container">
      <h4 className="historial-etapas-title">📋 Historial de Etapas</h4>
      <div className="historial-etapas-timeline">
        {historial.map((item) => {
          const color = getEtapaColor(item.etapa_nueva)
          const icon = getEtapaIcon(item.etapa_nueva)
          const isActive = item.fecha_fin_etapa === null
          
          return (
            <div key={item.id} className={`historial-etapa-item ${isActive ? 'active' : ''}`}>
              <div className="historial-etapa-line" style={{ borderColor: color }} />
              <div className="historial-etapa-content">
                <div className="historial-etapa-header">
                  <span className="historial-etapa-icon" style={{ backgroundColor: `${color}20`, color }}>
                    {icon}
                  </span>
                  <div className="historial-etapa-info">
                    <div className="historial-etapa-etapa" style={{ color }}>
                      {item.etapa_nueva}
                    </div>
                    {item.etapa_anterior && (
                      <div className="historial-etapa-transition">
                        <span className="historial-etapa-from">{item.etapa_anterior}</span>
                        <span className="historial-etapa-arrow">→</span>
                        <span className="historial-etapa-to">{item.etapa_nueva}</span>
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <span className="historial-etapa-badge active-badge">Actual</span>
                  )}
                </div>
                
                <div className="historial-etapa-details">
                  {item.nombre_usuario && (
                    <div className="historial-etapa-user">
                      <span className="historial-etapa-label">Usuario:</span>
                      <span className="historial-etapa-value">{item.nombre_usuario}</span>
                    </div>
                  )}
                  
                  <div className="historial-etapa-time">
                    <span className="historial-etapa-label">Inicio:</span>
                    <span className="historial-etapa-value">{formatDateTime(item.fecha_inicio_etapa)}</span>
                    <span className="historial-etapa-ago">({formatTimeAgo(item.fecha_inicio_etapa)})</span>
                  </div>
                  
                  {item.fecha_fin_etapa ? (
                    <div className="historial-etapa-time">
                      <span className="historial-etapa-label">Fin:</span>
                      <span className="historial-etapa-value">{formatDateTime(item.fecha_fin_etapa)}</span>
                    </div>
                  ) : (
                    <div className="historial-etapa-time">
                      <span className="historial-etapa-label">Estado:</span>
                      <span className="historial-etapa-value" style={{ color: '#10b981' }}>En curso</span>
                    </div>
                  )}
                  
                  {item.tiempo_formateado && (
                    <div className="historial-etapa-duration">
                      <span className="historial-etapa-label">Duración:</span>
                      <span className="historial-etapa-value" style={{ fontWeight: '600', color }}>
                        {item.tiempo_formateado}
                      </span>
                    </div>
                  )}
                  
                  {item.comentario && (
                    <div className="historial-etapa-comment">
                      <span className="historial-etapa-label">Comentario:</span>
                      <span className="historial-etapa-value">{item.comentario}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HistorialEtapasTallerGrafico

