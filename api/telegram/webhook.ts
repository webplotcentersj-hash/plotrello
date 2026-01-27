import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

// Crear cliente de Supabase para Vercel (usa process.env en lugar de import.meta.env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// Configuración del bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USERS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))

// URL base de la API de Telegram
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// Inicializar Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null

// Enviar mensaje a Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.substring(0, 4096), // Límite de Telegram
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error enviando mensaje a Telegram:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error en sendTelegramMessage:', error)
    return false
  }
}

// Enviar mensaje de "escribiendo..."
async function sendTypingAction(chatId: number) {
  try {
    await fetch(`${TELEGRAM_API_URL}/sendChatAction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    })
  } catch (error) {
    console.error('Error enviando typing action:', error)
  }
}

// Cargar datos básicos del sistema
async function loadSystemData() {
  try {
    if (!supabase) {
      return { totalOps: 0, opsEnProceso: 0, opsUrgentes: 0, teamMembers: 0, activity: 0 }
    }

    // Cargar órdenes de trabajo
    const { data: ordenes, error: ordenesError } = await supabase
      .from('ordenes_trabajo')
      .select('id, estado, prioridad')
      .order('created_at', { ascending: false })

    const totalOps = ordenes && !ordenesError ? ordenes.length : 0
    const opsEnProceso = ordenes && !ordenesError 
      ? ordenes.filter((o: any) => o.estado !== 'Finalizado' && o.estado !== 'Entregado').length 
      : 0
    const opsUrgentes = ordenes && !ordenesError 
      ? ordenes.filter((o: any) => o.prioridad === 'Alta').length 
      : 0

    // Cargar usuarios
    const { data: usuarios } = await supabase.from('usuarios').select('id')
    const teamMembers = usuarios ? usuarios.length : 0

    // Cargar historial
    const { data: historial } = await supabase
      .from('historial_movimientos')
      .select('id')
      .limit(100)
    const activity = historial ? historial.length : 0

    return { totalOps, opsEnProceso, opsUrgentes, teamMembers, activity }
  } catch (error) {
    console.error('Error cargando datos del sistema:', error)
    return { totalOps: 0, opsEnProceso: 0, opsUrgentes: 0, teamMembers: 0, activity: 0 }
  }
}

// Procesar mensaje y generar respuesta con PlotAI
async function processMessage(message: string, userName: string) {
  try {
    if (!genAI) {
      return '⚠️ PlotAI no está configurado. Por favor, configura GEMINI_API_KEY en Vercel.'
    }

    // Cargar datos básicos
    const data = await loadSystemData()

    // Crear contexto del sistema
    const systemContext = `Eres PlotAI, un asistente inteligente especializado en gestión de producción gráfica e imprenta.

CONTEXTO DEL SISTEMA:
- Total de OPs: ${data.totalOps}
- OPs en Proceso: ${data.opsEnProceso}
- OPs Urgentes: ${data.opsUrgentes}
- Miembros del Equipo: ${data.teamMembers}
- Movimientos Recientes: ${data.activity}

SIEMPRE responde en ESPAÑOL (español argentino). Sé profesional, preciso y útil.`

    // Generar respuesta con Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
    const prompt = `${systemContext}\n\nUsuario (${userName}): ${message}\n\nPlotAI:`
    
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    return text || 'Lo siento, no pude generar una respuesta. Por favor, intenta de nuevo.'
  } catch (error) {
    console.error('Error procesando mensaje con PlotAI:', error)
    return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Telegram SIEMPRE espera una respuesta 200, incluso en errores
  // Por eso respondemos inmediatamente y procesamos en segundo plano
  
  try {
    // Responder inmediatamente a Telegram
    res.status(200).json({ ok: true })

    // Verificar método
    if (req.method !== 'POST') {
      console.warn('Método no permitido:', req.method)
      return
    }

    // Verificar token del bot
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN no configurado')
      return
    }

    const update = req.body

    // Verificar que es un update válido de Telegram
    if (!update || !update.message) {
      return // Ya respondimos 200
    }

    const message = update.message
    const chatId = message.chat.id
    const userId = message.from.id
    const userName = message.from.first_name || message.from.username || `Usuario ${userId}`
    const text = message.text

    // Verificar si el usuario está autorizado
    if (TELEGRAM_ALLOWED_USERS.length > 0 && !TELEGRAM_ALLOWED_USERS.includes(userId)) {
      await sendTelegramMessage(
        chatId,
        '❌ No tienes permiso para usar este bot. Contacta al administrador.'
      )
      return // Ya respondimos 200
    }

    // Manejar comandos especiales
    if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        `👋 ¡Hola ${userName}! Soy PlotAI, tu asistente inteligente para gestión de producción gráfica.\n\n` +
        `Puedes preguntarme sobre:\n` +
        `📋 Órdenes de trabajo (OPs)\n` +
        `📊 Estado del Kanban\n` +
        `👥 Equipo y carga de trabajo\n` +
        `📈 Métricas y reportes\n\n` +
        `Simplemente escribe tu pregunta y te ayudaré.`
      )
      return // Ya respondimos 200
    }

    if (text === '/help') {
      await sendTelegramMessage(
        chatId,
        `📚 Comandos disponibles:\n\n` +
        `/start - Iniciar conversación\n` +
        `/help - Mostrar esta ayuda\n` +
        `/status - Ver estado del sistema\n\n` +
        `También puedes hacer preguntas en lenguaje natural sobre:\n` +
        `• Órdenes de trabajo y su estado\n` +
        `• Métricas de producción\n` +
        `• Carga de trabajo del equipo\n` +
        `• Reportes y análisis`
      )
      return // Ya respondimos 200
    }

    if (text === '/status') {
      const data = await loadSystemData()
      await sendTelegramMessage(
        chatId,
        `📊 Estado del Sistema:\n\n` +
        `📋 Total OPs: ${data.totalOps}\n` +
        `⚙️ En Proceso: ${data.opsEnProceso}\n` +
        `🔴 Urgentes: ${data.opsUrgentes}\n` +
        `👥 Equipo: ${data.teamMembers} miembros\n` +
        `📝 Movimientos recientes: ${data.activity}`
      )
      return // Ya respondimos 200
    }

    // Procesar mensaje normal con PlotAI
    if (text && text.trim()) {
      // Enviar acción de "escribiendo..."
      await sendTypingAction(chatId)

      // Procesar mensaje y generar respuesta
      const response = await processMessage(text, userName)

      // Enviar respuesta
      await sendTelegramMessage(chatId, response)
    }
  } catch (error) {
    console.error('Error en webhook de Telegram:', error)
    // Ya respondimos 200, solo logueamos el error
  }
}
