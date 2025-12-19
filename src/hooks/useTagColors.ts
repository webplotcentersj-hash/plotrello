import { useState, useEffect } from 'react'
import apiService from '../services/api'

type EtiquetaDisponible = {
  nombre: string
  veces_usada: number
  color: string
}

export function useTagColors() {
  const [tagColors, setTagColors] = useState<Map<string, string>>(new Map())
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState<EtiquetaDisponible[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTagColors = async () => {
      try {
        const response = await apiService.getEtiquetasDisponibles()
        if (response.success && response.data) {
          setEtiquetasDisponibles(response.data)
          // Crear mapa de colores
          const colorsMap = new Map<string, string>()
          response.data.forEach(etiqueta => {
            colorsMap.set(etiqueta.nombre.toLowerCase(), etiqueta.color || '#6B7280')
          })
          setTagColors(colorsMap)
        }
      } catch (error) {
        console.error('Error cargando colores de etiquetas:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTagColors()
  }, [])

  const getTagColor = (tagName: string): string => {
    const color = tagColors.get(tagName.toLowerCase())
    if (color) return color
    
    // Si no está en el mapa, buscar en etiquetas disponibles
    const etiqueta = etiquetasDisponibles.find(
      e => e.nombre.toLowerCase() === tagName.toLowerCase()
    )
    if (etiqueta?.color) return etiqueta.color
    
    // Fallback: color gris por defecto
    return '#6B7280'
  }

  const loadTagColor = async (tagName: string): Promise<string> => {
    try {
      const colorResponse = await apiService.obtenerColorEtiqueta(tagName)
      if (colorResponse.success && colorResponse.data) {
        const color = colorResponse.data
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(tagName.toLowerCase(), color)
          return newMap
        })
        return color
      }
    } catch (error) {
      console.error('Error cargando color de etiqueta:', error)
    }
    return '#6B7280'
  }

  return {
    tagColors,
    etiquetasDisponibles,
    getTagColor,
    loadTagColor,
    loading
  }
}

