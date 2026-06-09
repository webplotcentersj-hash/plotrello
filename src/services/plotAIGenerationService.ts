/**
 * Servicio para generación de imágenes y videos con IA.
 *
 * IMPORTANTE (seguridad):
 * - La generación se hace vía endpoints serverless (/api/plotai/*) para NO exponer API keys en el frontend.
 * - Proveedor único: Gemini (Google).
 */

import { plotLabFetch } from '../utils/plotLabApiOrigin'

export interface ImageGenerationOptions {
  prompt: string
  // Algunos modelos permiten parámetros extra; por ahora lo mantenemos simple
  aspectRatio?: '1:1' | '16:9' | '9:16'
}

export interface VideoGenerationOptions {
  prompt: string
  duration?: number // segundos
  aspectRatio?: '16:9' | '9:16' | '1:1'
}

export interface GenerationResult {
  success: boolean
  url?: string
  dataUrl?: string // Para imágenes generadas directamente
  error?: string
  provider?: string
  metadata?: {
    model: string
    size?: string
    duration?: number
  }
}

/**
 * Genera una imagen usando Gemini (serverless).
 */
export async function generateImage(options: ImageGenerationOptions): Promise<GenerationResult> {
  try {
    const response = await plotLabFetch('/api/plotai/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData?.error || `Error ${response.status}: ${response.statusText}`,
        provider: 'gemini'
      }
    }

    return (await response.json()) as GenerationResult
  } catch (error) {
    console.error('Error generando imagen (Gemini serverless):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al generar imagen',
      provider: 'gemini'
    }
  }
}

/**
 * Genera un video usando Gemini (Veo) vía serverless.
 */
export async function generateVideo(options: VideoGenerationOptions): Promise<GenerationResult> {
  try {
    const response = await plotLabFetch('/api/plotai/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData?.error || `Error ${response.status}: ${response.statusText}`,
        provider: 'gemini'
      }
    }

    return (await response.json()) as GenerationResult
  } catch (error) {
    console.error('Error generando video (Gemini serverless):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al generar video',
      provider: 'gemini'
    }
  }
}

/**
 * Detecta si el usuario quiere generar una imagen o video basándose en su mensaje
 */
export function detectGenerationIntent(message: string): {
  type: 'image' | 'video' | null
  prompt: string
  count?: number // Para múltiples imágenes
} {
  const lowerMessage = message.toLowerCase().trim()
  
  // Detectar número de imágenes solicitadas primero
  const numberMatch = lowerMessage.match(/(\d+)\s+(imagen|imágenes|foto|fotos|caballo|caballos|perro|perros|gato|gatos|gato|gatos|auto|autos|carro|carros)/)
  const count = numberMatch ? parseInt(numberMatch[1], 10) : 1
  
  // Palabras clave para generación de imágenes (más amplias y al inicio)
  const imageKeywords = [
    'genera una imagen',
    'genera imagen',
    'genera imágenes',
    'crea una imagen',
    'crea imagen',
    'crea imágenes',
    'haz una imagen',
    'haz imagen',
    'haz imágenes',
    'haceme una imagen',
    'haceme imagen',
    'haceme imágenes',
    'hazme una imagen',
    'hazme imagen',
    'hazme imágenes',
    'dibuja',
    'diseña una imagen',
    'diseña imagen',
    'imagen de',
    'foto de',
    'picture of',
    'generate image',
    'create image',
    'haceme', // Para frases como "haceme un caballo" o "haceme dos caballos"
    'hazme',
    'haz un',
    'haz una',
    'haz dos',
    'haz tres',
    'muéstrame',
    'muestrame'
  ]
  
  // Palabras clave para generación de videos
  const videoKeywords = [
    'genera un video',
    'genera video',
    'genera videos',
    'crea un video',
    'crea video',
    'crea videos',
    'haz un video',
    'haz video',
    'haz videos',
    'haceme un video',
    'haceme video',
    'hazme un video',
    'hazme video',
    'video de',
    'generate video',
    'create video',
    'make a video'
  ]
  
  const hasImageIntent = imageKeywords.some(keyword => lowerMessage.includes(keyword))
  const hasVideoIntent = videoKeywords.some(keyword => lowerMessage.includes(keyword))
  
  if (hasImageIntent) {
    // Extraer el prompt eliminando las palabras clave
    let prompt = message
    imageKeywords.forEach(keyword => {
      prompt = prompt.replace(new RegExp(keyword, 'gi'), '').trim()
    })
    // Limpiar números al inicio si son parte de la solicitud
    prompt = prompt.replace(/^\d+\s+/, '').trim()
    return { type: 'image', prompt: prompt || message, count }
  }
  
  if (hasVideoIntent) {
    // Extraer el prompt eliminando las palabras clave
    let prompt = message
    videoKeywords.forEach(keyword => {
      prompt = prompt.replace(new RegExp(keyword, 'gi'), '').trim()
    })
    return { type: 'video', prompt: prompt || message }
  }
  
  return { type: null, prompt: message }
}

