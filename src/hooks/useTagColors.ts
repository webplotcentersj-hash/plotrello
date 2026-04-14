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
          response.data.forEach((etiqueta) => {
            const nom = etiqueta.nombre?.trim()
            if (!nom) return
            colorsMap.set(nom.toLowerCase(), etiqueta.color || '#6B7280')
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
    const key = String(tagName ?? '').trim().toLowerCase()
    if (!key) return '#6B7280'
    const color = tagColors.get(key)
    if (color) return color
    
    // Si no está en el mapa, buscar en etiquetas disponibles
    const etiqueta = etiquetasDisponibles.find(
      (e) => e.nombre?.trim() && e.nombre.toLowerCase() === key
    )
    if (etiqueta?.color) return etiqueta.color
    
    // Fallback: color gris por defecto
    return '#6B7280'
  }

  const loadTagColor = async (tagName: string): Promise<string> => {
    const raw = String(tagName ?? '').trim()
    if (!raw) return '#6B7280'
    const key = raw.toLowerCase()
    try {
      const colorResponse = await apiService.obtenerColorEtiqueta(raw)
      if (colorResponse.success && colorResponse.data) {
        const color = colorResponse.data
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(key, color)
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

