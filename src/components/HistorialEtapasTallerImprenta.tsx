import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { HistorialEtapaTallerImprenta } from '../types/api'
import './HistorialEtapasTallerImprenta.css'

const formatDateTime = (dateString: string) => {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString))
}

interface HistorialEtapasTallerImprentaProps {
  ordenId: number
}

const ETAPAS_COLORES: Record<string, string> = {
  'Proceso': '#3b82f6',
  'Finalizado/máquina con Precorte': '#10b981',
  'Almacén': '#f59e0b',
  'Entregado/ Derivado': '#8b5cf6',
  'Sin Realizar Por faltantes': '#ef4444',
  'En Revisión': '#ec4899'
}

const ETAPAS_ICONOS: Record<string, string> = {
  'Proceso': '⚙️',
  'Finalizado/máquina con Precorte': '✅',
  'Almacén': '📦',
  'Entregado/ Derivado': '🚚',
  'Sin Realizar Por faltantes': '⚠️',
  'En Revisión': '🔍'
}

const HistorialEtapasTallerImprenta = ({ ordenId }: HistorialEtapasTallerImprentaProps) => {
  const [historial, setHistorial] = useState<HistorialEtapaTallerImprenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHistorial = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiService.obtenerHistorialEtapasTallerImprenta(ordenId)
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
          const color = ETAPAS_COLORES[item.etapa_nueva] || '#6b7280'
          const icon = ETAPAS_ICONOS[item.etapa_nueva] || '📍'
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
                  
                  {item.tiempo_en_etapa_seg !== null && item.tiempo_en_etapa_seg !== undefined && (
                    <div className="historial-etapa-time">
                      <span className="historial-etapa-label">Duración:</span>
                      <span className="historial-etapa-value">{item.tiempo_formateado || formatTiempo(item.tiempo_en_etapa_seg)}</span>
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

const formatTiempo = (segundos: number): string => {
  if (segundos < 60) return `${segundos} seg`
  if (segundos < 3600) return `${Math.floor(segundos / 60)} min`
  return `${Math.floor(segundos / 3600)} horas`
}

export default HistorialEtapasTallerImprenta

