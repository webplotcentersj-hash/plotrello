/**
 * Servicio para generación de imágenes y videos con IA.
 *
 * IMPORTANTE (seguridad):
 * - La generación se hace vía endpoints serverless (/api/plotai/*) para NO exponer API keys en el frontend.
 * - Proveedor único: Gemini (Google).
 */

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
    const response = await fetch('/api/plotai/generate-image', {
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
    const response = await fetch('/api/plotai/generate-video', {
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
} {
  const lowerMessage = message.toLowerCase()
  
  // Palabras clave para generación de imágenes
  const imageKeywords = [
    'genera una imagen',
    'crea una imagen',
    'haz una imagen',
    'haceme una imagen',
    'hazme una imagen',
    'dibuja',
    'diseña una imagen',
    'imagen de',
    'foto de',
    'picture of',
    'generate image',
    'create image',
    'haceme un', // Para frases como "haceme un caballo"
    'hazme un',
    'haz un'
  ]
  
  // Palabras clave para generación de videos
  const videoKeywords = [
    'genera un video',
    'crea un video',
    'haz un video',
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
    return { type: 'image', prompt: prompt || message }
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

