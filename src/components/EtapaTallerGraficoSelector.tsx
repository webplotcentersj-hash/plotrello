import { useState } from 'react'
import apiService from '../services/api'
import './EtapaTallerGraficoSelector.css'

const ETAPAS_TALLER_GRAFICO = [
  'Falta Material para Impresión o archivo',
  'En Proceso',
  'Para Cortar o Pegar',
  'Para Rotular',
  'Instalaciones/Ploteo',
  'Metalurgica Instalacion',
  'laminas'
] as const

type EtapaTallerGrafico = typeof ETAPAS_TALLER_GRAFICO[number]

interface EtapaTallerGraficoSelectorProps {
  ordenId: number
  etapaActual?: string | null
  onEtapaChange?: () => void
}

const EtapaTallerGraficoSelector = ({ 
  ordenId, 
  etapaActual,
  onEtapaChange 
}: EtapaTallerGraficoSelectorProps) => {
  const [cambiando, setCambiando] = useState(false)

  const handleCambiarEtapa = async (nuevaEtapa: EtapaTallerGrafico) => {
    if (nuevaEtapa === etapaActual) return

    setCambiando(true)
    try {
      const response = await apiService.updateOrden(ordenId, {
        etapa_taller_grafico: nuevaEtapa
      })

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
    <div className="etapa-taller-grafico-selector">
      <label className="etapa-label">Etapa en Taller Gráfico:</label>
      <div className="etapas-grid">
        {ETAPAS_TALLER_GRAFICO.map((etapa) => {
          const isActive = etapa === etapaActual
          return (
            <button
              key={etapa}
              type="button"
              className={`etapa-button ${isActive ? 'active' : ''}`}
              onClick={() => handleCambiarEtapa(etapa)}
              disabled={cambiando}
              title={isActive ? 'Etapa actual' : `Cambiar a: ${etapa}`}
            >
              {etapa}
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

export default EtapaTallerGraficoSelector

