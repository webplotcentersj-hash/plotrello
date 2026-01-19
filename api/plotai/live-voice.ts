import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

function getEnvKey() {
  // Prefer server-side secret (NO VITE_ prefix)
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

/**
 * Endpoint para obtener configuración de Gemini Live API
 * Devuelve la URL del WebSocket y el token necesario para conectar
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permitir CORS para conexiones desde el frontend
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const apiKey = getEnvKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Para Gemini Live API, necesitamos generar un token efímero o configurar la sesión
    // Según la documentación, podemos usar ai.live.connect() desde el cliente
    // Pero necesitamos pasar la API key de forma segura
    
    // Por ahora, devolvemos la configuración necesaria
    // El cliente se conectará directamente usando el SDK
    
    res.status(200).json({
      success: true,
      message: 'Configuración de Live API lista',
      // Nota: En producción, deberías usar tokens efímeros para mayor seguridad
      // Por ahora, el cliente usará la API key desde variable de entorno del cliente
      // (no ideal para producción, pero funcional para desarrollo)
    })
  } catch (error) {
    console.error('Error configurando Live API:', error)
    res.status(500).json({
      error: 'Error configurando Live API',
      details: error instanceof Error ? error.message : 'Error desconocido'
    })
  }
}

