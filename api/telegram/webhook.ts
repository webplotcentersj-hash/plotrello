import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import type { Task, TeamMember, ActivityEvent } from '../../src/types/board'
import type { UsuarioRecord } from '../../src/types/api'

// Crear cliente de Supabase para Vercel (usa process.env en lugar de import.meta.env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// Configuración del bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''
const TELEGRAM_ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USERS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))

// URL base de la API de Telegram
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// Mapear usuarios de Supabase a TeamMembers
const mapUsuariosToTeamMembers = (usuarios: UsuarioRecord[]): TeamMember[] =>
  usuarios.map((usuario) => ({
    id: usuario.id.toString(),
    name: usuario.nombre,
    role: usuario.rol,
    avatar: usuario.nombre
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    productivity: 0
  }))

// Enviar mensaje a Telegram
async function sendTelegramMessage(chatId: number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.substring(0, 4096), // Límite de Telegram
        parse_mode: parseMode,
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

// Cargar datos del sistema para PlotAI
async function loadSystemData() {
  try {
    if (!supabase) {
      throw new Error('Supabase no está configurado')
    }

    // Cargar órdenes de trabajo directamente desde Supabase
    const { data: ordenes, error: ordenesError } = await supabase
      .from('ordenes_trabajo')
      .select('*')
      .order('created_at', { ascending: false })

    const tasks: Task[] = ordenes && !ordenesError
      ? ordenes.map(ordenToTask)
      : []

    // Cargar historial de movimientos directamente desde Supabase
    const { data: historial, error: historialError } = await supabase
      .from('historial_movimientos')
      .select('*')
      .order('fecha_movimiento', { ascending: false })
      .limit(100)

    const activity: ActivityEvent[] = historial && !historialError
      ? historial.map(historialToActivity)
      : []

    // Cargar usuarios directamente desde Supabase
    const { data: usuarios, error: usuariosError } = await supabase
      .from('usuarios')
      .select('*')

    const teamMembers: TeamMember[] = usuarios && !usuariosError
      ? mapUsuariosToTeamMembers(usuarios as UsuarioRecord[])
      : []

    return { tasks, activity, teamMembers }
  } catch (error) {
    console.error('Error cargando datos del sistema:', error)
    return { tasks: [], activity: [], teamMembers: [] }
  }
}

// Procesar mensaje y generar respuesta con PlotAI
async function processMessage(message: string, userId: number, userName: string) {
  try {
    // Cargar datos del sistema
    const { tasks, activity, teamMembers } = await loadSystemData()

    // Generar respuesta con PlotAI
    const response = await generateContent({
      contents: message,
      tasks,
      activity,
      teamMembers,
      userName: userName || `Usuario ${userId}`,
      useCompleteContext: true,
      useMemory: true,
      learnFromResponse: true,
    })

    return response
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
      const { tasks, activity, teamMembers } = await loadSystemData()
      const totalOps = tasks.length
      const opsEnProceso = tasks.filter(t => 
        t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
      ).length
      const opsUrgentes = tasks.filter(t => t.priority === 'alta').length

      await sendTelegramMessage(
        chatId,
        `📊 Estado del Sistema:\n\n` +
        `📋 Total OPs: ${totalOps}\n` +
        `⚙️ En Proceso: ${opsEnProceso}\n` +
        `🔴 Urgentes: ${opsUrgentes}\n` +
        `👥 Equipo: ${teamMembers.length} miembros\n` +
        `📝 Movimientos recientes: ${activity.length}`
      )
      return // Ya respondimos 200
    }

    // Procesar mensaje normal con PlotAI
    if (text && text.trim()) {
      // Enviar acción de "escribiendo..."
      await sendTypingAction(chatId)

      // Procesar mensaje y generar respuesta
      const response = await processMessage(text, userId, userName)

      // Enviar respuesta
      await sendTelegramMessage(chatId, response)
    }
  } catch (error) {
    console.error('Error en webhook de Telegram:', error)
    // Ya respondimos 200, solo logueamos el error
  }
}

