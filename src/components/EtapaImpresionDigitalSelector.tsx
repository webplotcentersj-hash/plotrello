import { useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './EtapaImpresionDigitalSelector.css'

const ETAPAS_IMPRESION_DIGITAL = [
  'En Proceso',
  'Pausa',
  'Fichas técnicas',
  'Delivery',
  'Taller de Imprenta',
  'Para Embalar',
  'Embalado'
] as const

const ETAPAS_ICONOS: Record<string, string> = {
  'En Proceso': '⚙️',
  'Pausa': '⏸️',
  'Fichas técnicas': '📋',
  'Delivery': '🚚',
  'Taller de Imprenta': '🖨️',
  'Para Embalar': '📦',
  'Embalado': '✅'
}

const ETAPAS_COLORES: Record<string, string> = {
  'En Proceso': '#3b82f6',
  'Pausa': '#f59e0b',
  'Fichas técnicas': '#8b5cf6',
  'Delivery': '#06b6d4',
  'Taller de Imprenta': '#22c55e',
  'Para Embalar': '#eab308',
  'Embalado': '#10b981'
}

type EtapaImpresionDigital = (typeof ETAPAS_IMPRESION_DIGITAL)[number]

interface EtapaImpresionDigitalSelectorProps {
  ordenId: number
  etapaActual?: string | null
  onEtapaChange?: () => void
}

const EtapaImpresionDigitalSelector = ({
  ordenId,
  etapaActual,
  onEtapaChange
}: EtapaImpresionDigitalSelectorProps) => {
  const [cambiando, setCambiando] = useState(false)
  const { usuario } = useAuth()

  const handleCambiarEtapa = async (nuevaEtapa: EtapaImpresionDigital) => {
    if (nuevaEtapa === etapaActual) return

    setCambiando(true)
    try {
      const response = await apiService.actualizarEtapaImpresionDigital(
        ordenId,
        nuevaEtapa,
        usuario?.nombre || 'Sistema'
      )

      if (response.success && response.data) {
        window.dispatchEvent(
          new CustomEvent('update-task-etapa', {
            detail: {
              ordenId,
              etapa: nuevaEtapa,
              fechaInicio: response.data.etapa_impresion_digital_fecha_inicio,
              tipo: 'impresion_digital'
            }
          })
        )
        if (onEtapaChange) onEtapaChange()
      } else {
        alert(`Error al cambiar etapa: ${response.error}`)
      }
    } catch (error) {
      console.error('Error cambiando etapa impresión digital:', error)
      alert('Error al cambiar la etapa')
    } finally {
      setCambiando(false)
    }
  }

  return (
    <div className="etapa-impresion-digital-selector">
      <label className="etapa-label">Etapa en Impresión Digital:</label>
      <div className="etapas-grid">
        {ETAPAS_IMPRESION_DIGITAL.map((etapa) => {
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
              style={
                isActive
                  ? { borderLeftColor: color, borderLeftWidth: '3px' }
                  : { borderLeftColor: color, borderLeftWidth: '2px', opacity: 0.7 }
              }
            >
              <span className="etapa-icon">{icon}</span>
              <span className="etapa-text">{etapa}</span>
              {isActive && <span className="etapa-check">✓</span>}
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

export default EtapaImpresionDigitalSelector
