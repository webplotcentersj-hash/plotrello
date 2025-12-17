import { useEffect, useState } from 'react'
import apiService from '../services/api'
import type { HistorialEtapaInstalaciones } from '../types/api'
import './HistorialEtapasInstalaciones.css'

interface HistorialEtapasInstalacionesProps {
  ordenId: number
}

const ETAPAS_COLORES: Record<string, string> = {
  'Falta Info o Material': '#ef4444',
  'Coordinados para Instalaciones': '#3b82f6',
  'Listos para instalar': '#10b981',
  'Pausados': '#f59e0b',
  'Rehacer': '#ec4899'
}

const ETAPAS_ICONOS: Record<string, string> = {
  'Falta Info o Material': '⚠️',
  'Coordinados para Instalaciones': '📅',
  'Listos para instalar': '✅',
  'Pausados': '⏸️',
  'Rehacer': '🔄'
}

const HistorialEtapasInstalaciones = ({ ordenId }: HistorialEtapasInstalacionesProps) => {
  const [historial, setHistorial] = useState<HistorialEtapaInstalaciones[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistorial()
  }, [ordenId])

  const loadHistorial = async () => {
    try {
      setLoading(true)
      const response = await apiService.obtenerHistorialEtapasInstalaciones(ordenId)
      if (response.success && response.data) {
        setHistorial(response.data)
      }
    } catch (error) {
      console.error('Error cargando historial de etapas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="historial-loading">Cargando historial...</div>
  }

  if (historial.length === 0) {
    return <div className="historial-empty">No hay historial de cambios de etapa</div>
  }

  return (
    <div className="historial-etapas-instalaciones">
      <h4 className="historial-title">Historial de Cambios de Etapa</h4>
      <div className="historial-timeline">
        {historial.map((item) => {
          const color = ETAPAS_COLORES[item.etapa_nueva] || '#6b7280'
          const icon = ETAPAS_ICONOS[item.etapa_nueva] || '📍'
          
          return (
            <div key={item.id} className="historial-item">
              <div className="historial-line" style={{ borderLeftColor: color }} />
              <div className="historial-content">
                <div className="historial-header">
                  <span className="historial-etapa" style={{ color }}>
                    <span className="historial-icon">{icon}</span>
                    {item.etapa_nueva}
                  </span>
                  <span className="historial-fecha">
                    {new Date(item.timestamp).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {item.etapa_anterior && (
                  <div className="historial-transicion">
                    <span className="historial-desde">{item.etapa_anterior}</span>
                    <span className="historial-flecha">→</span>
                    <span className="historial-hasta">{item.etapa_nueva}</span>
                  </div>
                )}
                <div className="historial-usuario">
                  Por: <strong>{item.nombre_usuario}</strong>
                </div>
                {item.tiempo_en_etapa_seg !== null && item.tiempo_en_etapa_seg !== undefined && (
                  <div className="historial-tiempo">
                    Tiempo en etapa: <strong>{item.tiempo_formateado || formatTiempo(item.tiempo_en_etapa_seg)}</strong>
                  </div>
                )}
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

export default HistorialEtapasInstalaciones

