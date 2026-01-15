import { useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './EtapaTallerImprentaSelector.css'

const ETAPAS_TALLER_IMPRENTA = [
  'Proceso',
  'Finalizado/máquina con Precorte',
  'Almacén',
  'Entregado/ Derivado',
  'Sin Realizar Por faltantes',
  'En Revisión'
] as const

const ETAPAS_ICONOS: Record<string, string> = {
  'Proceso': '⚙️',
  'Finalizado/máquina con Precorte': '✅',
  'Almacén': '📦',
  'Entregado/ Derivado': '🚚',
  'Sin Realizar Por faltantes': '⚠️',
  'En Revisión': '🔍'
}

const ETAPAS_COLORES: Record<string, string> = {
  'Proceso': '#3b82f6',
  'Finalizado/máquina con Precorte': '#10b981',
  'Almacén': '#f59e0b',
  'Entregado/ Derivado': '#8b5cf6',
  'Sin Realizar Por faltantes': '#ef4444',
  'En Revisión': '#ec4899'
}

type EtapaTallerImprenta = typeof ETAPAS_TALLER_IMPRENTA[number]

interface EtapaTallerImprentaSelectorProps {
  ordenId: number
  etapaActual?: string | null
  onEtapaChange?: () => void
}

const EtapaTallerImprentaSelector = ({ 
  ordenId, 
  etapaActual,
  onEtapaChange 
}: EtapaTallerImprentaSelectorProps) => {
  const [cambiando, setCambiando] = useState(false)
  const { usuario } = useAuth()

  const handleCambiarEtapa = async (nuevaEtapa: EtapaTallerImprenta) => {
    if (nuevaEtapa === etapaActual) return

    setCambiando(true)
    try {
      // Usar función RPC que acepta el nombre del usuario
      const response = await apiService.actualizarEtapaTallerImprenta(
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
            fechaInicio: response.data.etapa_taller_imprenta_fecha_inicio,
            tipo: 'taller_imprenta'
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
    <div className="etapa-taller-imprenta-selector">
      <label className="etapa-label">Etapa en Taller de Imprenta:</label>
      <div className="etapas-grid">
        {ETAPAS_TALLER_IMPRENTA.map((etapa) => {
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

export default EtapaTallerImprentaSelector

