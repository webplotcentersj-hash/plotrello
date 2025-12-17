import { useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './EtapaInstalacionesSelector.css'

const ETAPAS_INSTALACIONES = [
  'Falta Info o Material',
  'Coordinados para Instalaciones',
  'Listos para instalar',
  'Pausados',
  'Rehacer'
] as const

const ETAPAS_ICONOS: Record<string, string> = {
  'Falta Info o Material': '⚠️',
  'Coordinados para Instalaciones': '📅',
  'Listos para instalar': '✅',
  'Pausados': '⏸️',
  'Rehacer': '🔄'
}

const ETAPAS_COLORES: Record<string, string> = {
  'Falta Info o Material': '#ef4444',
  'Coordinados para Instalaciones': '#3b82f6',
  'Listos para instalar': '#10b981',
  'Pausados': '#f59e0b',
  'Rehacer': '#ec4899'
}

type EtapaInstalaciones = typeof ETAPAS_INSTALACIONES[number]

interface EtapaInstalacionesSelectorProps {
  ordenId: number
  etapaActual?: string | null
  onEtapaChange?: () => void
}

const EtapaInstalacionesSelector = ({ 
  ordenId, 
  etapaActual,
  onEtapaChange 
}: EtapaInstalacionesSelectorProps) => {
  const [cambiando, setCambiando] = useState(false)
  const { usuario } = useAuth()

  const handleCambiarEtapa = async (nuevaEtapa: EtapaInstalaciones) => {
    if (nuevaEtapa === etapaActual) return

    setCambiando(true)
    try {
      // Usar función RPC que acepta el nombre del usuario
      const response = await apiService.actualizarEtapaInstalaciones(
        ordenId, 
        nuevaEtapa,
        usuario?.nombre || 'Sistema'
      )

      if (response.success) {
        if (onEtapaChange) {
          onEtapaChange()
        } else {
          // Recargar la página si no hay callback
          window.location.reload()
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
    <div className="etapa-instalaciones-selector">
      <label className="etapa-label">Etapa en Instalaciones:</label>
      <div className="etapas-grid">
        {ETAPAS_INSTALACIONES.map((etapa) => {
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
              {isActive && <span className="etapa-check">✓</span>}
            </button>
          )
        })}
      </div>
      {cambiando && (
        <div className="etapa-loading">
          <span>Cambiando etapa...</span>
        </div>
      )}
    </div>
  )
}

export default EtapaInstalacionesSelector

