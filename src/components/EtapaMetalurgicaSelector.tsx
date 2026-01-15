import { useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './EtapaMetalurgicaSelector.css'

const ETAPAS_METALURGICA = [
  'En Proceso',
  'Corte',
  'Soldadura',
  'Pintura/Tratamiento',
  'Montaje',
  'Listo para Instalar',
  'Finalizado'
] as const

const ETAPAS_ICONOS: Record<string, string> = {
  'En Proceso': '⚙️',
  'Corte': '✂️',
  'Soldadura': '🔥',
  'Pintura/Tratamiento': '🎨',
  'Montaje': '🔧',
  'Listo para Instalar': '✅',
  'Finalizado': '🏁'
}

const ETAPAS_COLORES: Record<string, string> = {
  'En Proceso': '#3b82f6',
  'Corte': '#ef4444',
  'Soldadura': '#f59e0b',
  'Pintura/Tratamiento': '#8b5cf6',
  'Montaje': '#06b6d4',
  'Listo para Instalar': '#10b981',
  'Finalizado': '#6366f1'
}

type EtapaMetalurgica = typeof ETAPAS_METALURGICA[number]

interface EtapaMetalurgicaSelectorProps {
  ordenId: number
  etapaActual?: string | null
  onEtapaChange?: () => void
}

const EtapaMetalurgicaSelector = ({ 
  ordenId, 
  etapaActual,
  onEtapaChange 
}: EtapaMetalurgicaSelectorProps) => {
  const [cambiando, setCambiando] = useState(false)
  const { usuario } = useAuth()

  const handleCambiarEtapa = async (nuevaEtapa: EtapaMetalurgica) => {
    if (nuevaEtapa === etapaActual) return

    setCambiando(true)
    try {
      // Usar función RPC que acepta el nombre del usuario
      const response = await apiService.actualizarEtapaMetalurgica(
        ordenId, 
        nuevaEtapa,
        usuario?.nombre || 'Sistema'
      )

      if (response.success && response.data) {
        // Actualizar solo la tarea específica preservando su status actual
        window.dispatchEvent(new CustomEvent('update-task-etapa', {
          detail: {
            ordenId,
            etapa: nuevaEtapa,
            fechaInicio: response.data.etapa_metalurgica_fecha_inicio,
            tipo: 'metalurgica'
          }
        }))
        
        if (onEtapaChange) {
          onEtapaChange()
        }
      } else {
        alert(`Error al cambiar etapa: ${response.error}`)
      }
    } catch (error) {
      console.error('Error cambiando etapa:', error)
      alert('Error al cambiar la etapa')
    } finally {
      setCambiando(false)
    }
  }

  return (
    <div className="etapa-metalurgica-selector">
      <label className="etapa-label">Etapa en Metalúrgica:</label>
      <div className="etapas-grid">
        {ETAPAS_METALURGICA.map((etapa) => {
          const isActive = etapa === etapaActual
          const color = ETAPAS_COLORES[etapa] || '#6b7280'
          const icon = ETAPAS_ICONOS[etapa] || '📍'
          return (
            <button
              key={etapa}
              type="button"
              className={`etapa-button ${isActive ? 'active' : ''}`}
              data-etapa={etapa}
              onClick={() => handleCambiarEtapa(etapa)}
              disabled={cambiando}
              title={isActive ? 'Etapa actual' : `Cambiar a: ${etapa}`}
              style={isActive ? {
                borderLeftColor: color,
                borderLeftWidth: '3px'
              } : {
                borderLeftColor: color,
                borderLeftWidth: '2px',
                opacity: 0.7
              }}
            >
              <span className="etapa-icon">{icon}</span>
              <span className="etapa-text">{etapa}</span>
            </button>
          )
        })}
      </div>
      {cambiando && (
        <div className="etapa-changing">
          <span>Cambiando etapa...</span>
        </div>
      )}
    </div>
  )
}

export default EtapaMetalurgicaSelector

