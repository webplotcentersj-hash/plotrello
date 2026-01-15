import { useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
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

const ETAPAS_ICONOS: Record<string, string> = {
  'Falta Material para Impresión o archivo': '⚠️',
  'En Proceso': '⚙️',
  'Para Cortar o Pegar': '✂️',
  'Para Rotular': '🏷️',
  'Instalaciones/Ploteo': '🚚',
  'Metalurgica Instalacion': '🔧',
  'laminas': '📄'
}

const ETAPAS_COLORES: Record<string, string> = {
  'Falta Material para Impresión o archivo': '#ef4444',
  'En Proceso': '#3b82f6',
  'Para Cortar o Pegar': '#f59e0b',
  'Para Rotular': '#8b5cf6',
  'Instalaciones/Ploteo': '#10b981',
  'Metalurgica Instalacion': '#ec4899',
  'laminas': '#06b6d4'
}

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
  const { usuario } = useAuth()

  const handleCambiarEtapa = async (nuevaEtapa: EtapaTallerGrafico) => {
    if (nuevaEtapa === etapaActual) return

    setCambiando(true)
    try {
      // Usar función RPC que acepta el nombre del usuario
      const response = await apiService.actualizarEtapaTallerGrafico(
        ordenId, 
        nuevaEtapa,
        usuario?.nombre || 'Sistema'
      )

      if (response.success && response.data) {
        // Actualizar solo la tarea específica preservando su status actual
        // Esto evita que la ficha se mueva cuando solo se cambia la etapa
        window.dispatchEvent(new CustomEvent('update-task-etapa', {
          detail: {
            ordenId,
            etapa: nuevaEtapa,
            fechaInicio: response.data.etapa_taller_grafico_fecha_inicio,
            tipo: 'taller_grafico'
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
    <div className="etapa-taller-grafico-selector">
      <label className="etapa-label">Etapa en Taller Gráfico:</label>
      <div className="etapas-grid">
        {ETAPAS_TALLER_GRAFICO.map((etapa) => {
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

export default EtapaTallerGraficoSelector

