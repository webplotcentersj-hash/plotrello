import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

// Crear cliente de Supabase para Vercel (usa process.env en lugar de import.meta.env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

/** Service role: recomendado para /agenda (RPC sin sesión de usuario). Si no hay, se usa el mismo cliente anon. */
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseForAgenda =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase

/**
 * Un solo DT: TELEGRAM_DT_UN_SOLO_USUARIO=chatTelegram:idAsesorPlotlab (ej. 123456789:8)
 * Varios: TELEGRAM_ASESOR_MAP=123:8,456:9
 * Prueba sin mapa: TELEGRAM_DT_DEFAULT_ASESOR_ID=8 (cualquier usuario permitido ve esa agenda).
 */
function parseTelegramAsesorMap(): Map<number, number> {
  const map = new Map<number, number>()
  const solo = (process.env.TELEGRAM_DT_UN_SOLO_USUARIO || '').trim()
  if (solo) {
    const [tg, asesor] = solo.split(':').map((s) => s.trim())
    const tgId = parseInt(tg, 10)
    const asesorId = parseInt(asesor, 10)
    if (!isNaN(tgId) && !isNaN(asesorId)) map.set(tgId, asesorId)
  }
  const raw = process.env.TELEGRAM_ASESOR_MAP || ''
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [tg, asesor] = trimmed.split(':').map((s) => s.trim())
    const tgId = parseInt(tg, 10)
    const asesorId = parseInt(asesor, 10)
    if (!isNaN(tgId) && !isNaN(asesorId)) map.set(tgId, asesorId)
  }
  return map
}

const TELEGRAM_ASESOR_MAP = parseTelegramAsesorMap()
const TELEGRAM_DT_DEFAULT_ASESOR_ID = parseInt(process.env.TELEGRAM_DT_DEFAULT_ASESOR_ID || '', 10)

function resolveAsesorIdForTelegramUser(telegramUserId: number): number | null {
  const mapped = TELEGRAM_ASESOR_MAP.get(telegramUserId)
  if (mapped != null) return mapped
  if (!isNaN(TELEGRAM_DT_DEFAULT_ASESOR_ID) && TELEGRAM_DT_DEFAULT_ASESOR_ID > 0) {
    return TELEGRAM_DT_DEFAULT_ASESOR_ID
  }
  return null
}

function normalizeTelegramCommand(text: string | undefined): string | null {
  if (!text || !text.startsWith('/')) return null
  const first = text.trim().split(/\s+/)[0] || ''
  const base = first.split('@')[0].toLowerCase()
  return base || null
}

const TZ_AR = 'America/Argentina/Buenos_Aires'

async function loadAgendaTextoParaAsesor(asesorId: number): Promise<string> {
  const client = supabaseForAgenda
  if (!client) {
    return '⚠️ Supabase no está configurado en el servidor (URL / key).'
  }

  const ahora = new Date()
  const desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000)
  const hasta = new Date(ahora.getTime() + 21 * 24 * 60 * 60 * 1000)

  const { data, error } = await client.rpc('obtener_citas_asesor', {
    p_id_asesor: asesorId,
    p_fecha_desde: desde.toISOString(),
    p_fecha_hasta: hasta.toISOString()
  })

  if (error) {
    console.error('[Telegram /agenda] RPC error:', error)
    return `⚠️ No se pudo leer la agenda: ${error.message}\n\nSi usás RLS estricto, configurá SUPABASE_SERVICE_ROLE_KEY en Vercel solo para este backend.`
  }

  const rows = (data || []) as Array<{
    titulo: string
    fecha_cita: string
    duracion_minutos?: number | null
    estado?: string | null
    cliente_nombre?: string | null
    ficha_numero?: string | null
    direccion?: string | null
  }>

  const activas = rows.filter((r) => {
    const e = (r.estado || '').toLowerCase()
    return e !== 'completada' && e !== 'cancelada'
  })

  if (activas.length === 0) {
    return (
      `📅 Agenda DT (próx. ~3 semanas)\n` +
      `No tenés citas pendientes en el rango consultado.\n\n` +
      `Recordá cargarlas en Plotlab (agenda del asesor).`
    )
  }

  const lines = activas.map((r) => {
    const when = new Date(r.fecha_cita)
    const fechaStr = when.toLocaleString('es-AR', {
      timeZone: TZ_AR,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    const cli = r.cliente_nombre ? ` · ${r.cliente_nombre}` : ''
    const ficha = r.ficha_numero ? ` · ${r.ficha_numero}` : ''
    const dur = r.duracion_minutos ? ` · ${r.duracion_minutos} min` : ''
    const est = r.estado ? ` [${r.estado}]` : ''
    const dir = r.direccion ? `\n   📍 ${r.direccion}` : ''
    return `• ${fechaStr} — ${r.titulo}${cli}${ficha}${dur}${est}${dir}`
  })

  const header = `📅 Tu agenda DT (${activas.length} cita(s) próximas)\n\n`
  return (header + lines.join('\n\n')).substring(0, 4090)
}

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
    console.log('[Telegram Webhook] Enviando mensaje:', { chatId, textLength: text.length })
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('[Telegram Webhook] ERROR: TELEGRAM_BOT_TOKEN no disponible para enviar mensaje')
      return false
    }
    
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
      console.error('[Telegram Webhook] Error enviando mensaje a Telegram:', error)
      console.error('[Telegram Webhook] Status:', response.status, response.statusText)
      return false
    }

    const result = await response.json()
    console.log('[Telegram Webhook] Mensaje enviado exitosamente:', result.ok)
    return true
  } catch (error) {
    console.error('[Telegram Webhook] Error en sendTelegramMessage:', error)
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

    const prompt = `${systemContext}\n\nUsuario (${userName}): ${message}\n\nPlotAI:`

    // SDK @google/genai: usar ai.models.generateContent
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    } as any)

    const candidates = (response as any)?.candidates || (response as any)?.response?.candidates || []
    const parts = candidates?.[0]?.content?.parts || []
    const textPart = parts.find((p: any) => typeof p?.text === 'string')
    const text =
      (typeof textPart?.text === 'string' ? textPart.text : undefined) ||
      (typeof (response as any)?.text === 'string' ? (response as any).text : undefined)

    return (text || '').trim() || 'Lo siento, no pude generar una respuesta. Por favor, intenta de nuevo.'
  } catch (error) {
    console.error('Error procesando mensaje con PlotAI:', error)
    return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Telegram SIEMPRE espera una respuesta 200 OK con JSON válido
  // Respondemos inmediatamente y procesamos en segundo plano
  
  console.log('[Telegram Webhook] Request recibido:', {
    method: req.method,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  })
  
  // Responder inmediatamente a Telegram ANTES de cualquier procesamiento
  res.status(200).json({ ok: true })
  
  // Si no es POST, terminar aquí
  if (req.method !== 'POST') {
    console.log('[Telegram Webhook] Método no permitido:', req.method)
    return
  }
  
  // Verificar token del bot
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram Webhook] ERROR: TELEGRAM_BOT_TOKEN no configurado')
    return
  }
  
  try {

    const update = req.body

    console.log('[Telegram Webhook] Update recibido:', JSON.stringify(update, null, 2))

    // Verificar que es un update válido de Telegram
    if (!update || !update.message) {
      console.log('[Telegram Webhook] Update sin mensaje, ignorando')
      return // Ya respondimos 200
    }

    const message = update.message
    const chatId = message.chat.id
    const userId = message.from.id
    const userName = message.from.first_name || message.from.username || `Usuario ${userId}`
    const text = message.text
    const cmd = normalizeTelegramCommand(text)

    console.log('[Telegram Webhook] Procesando mensaje:', {
      chatId,
      userId,
      userName,
      text
    })

    // Verificar si el usuario está autorizado
    if (TELEGRAM_ALLOWED_USERS.length > 0 && !TELEGRAM_ALLOWED_USERS.includes(userId)) {
      await sendTelegramMessage(
        chatId,
        '❌ No tienes permiso para usar este bot. Contacta al administrador.'
      )
      return // Ya respondimos 200
    }

    // Manejar comandos especiales
    if (cmd === '/start') {
      console.log('[Telegram Webhook] Comando /start recibido')
      const sent = await sendTelegramMessage(
        chatId,
        `👋 ¡Hola ${userName}! Soy PlotAI, tu asistente inteligente para gestión de producción gráfica.\n\n` +
        `Puedes preguntarme sobre:\n` +
        `📋 Órdenes de trabajo (OPs)\n` +
        `📊 Estado del Kanban\n` +
        `👥 Equipo y carga de trabajo\n` +
        `📈 Métricas y reportes\n` +
        `📅 /agenda - Ver tus citas (agenda DT en Plotlab)\n\n` +
        `Simplemente escribe tu pregunta y te ayudaré.`
      )
      console.log('[Telegram Webhook] Mensaje /start enviado:', sent)
      return // Ya respondimos 200
    }

    if (cmd === '/help') {
      await sendTelegramMessage(
        chatId,
        `📚 Comandos disponibles:\n\n` +
        `/start - Iniciar conversación\n` +
        `/help - Mostrar esta ayuda\n` +
        `/status - Ver estado del sistema\n` +
        `/agenda - Citas del asesor (DT) cargadas en Plotlab\n` +
        `/quiensoy - Tu ID de Telegram (para vincular la agenda)\n\n` +
        `También puedes hacer preguntas en lenguaje natural sobre:\n` +
        `• Órdenes de trabajo y su estado\n` +
        `• Métricas de producción\n` +
        `• Carga de trabajo del equipo\n` +
        `• Reportes y análisis`
      )
      return // Ya respondimos 200
    }

    if (cmd === '/quiensoy') {
      await sendTelegramMessage(
        chatId,
        `🆔 Tu usuario de Telegram: ${userId}\n\n` +
          `Para ver tu agenda con /agenda, en Vercel configurá (un solo usuario):\n` +
          `TELEGRAM_DT_UN_SOLO_USUARIO=${userId}:ID_EN_PLOTLAB\n\n` +
          `(ID_EN_PLOTLAB = tu id en usuarios de Plotlab, el de la agenda.)\n\n` +
          `Alternativa: TELEGRAM_ASESOR_MAP=${userId}:ID_EN_PLOTLAB\n\n` +
          `Recordatorios ~15 min: mismo dato + cron; con UN_SOLO_USUARIO alcanza, no hace falta mapa extra.`
      )
      return
    }

    if (cmd === '/agenda') {
      await sendTypingAction(chatId)
      const asesorId = resolveAsesorIdForTelegramUser(userId)
      if (asesorId == null) {
        await sendTelegramMessage(
          chatId,
          `⚠️ Tu Telegram aún no está vinculado a un asesor en Plotlab.\n\n` +
            `Enviá /quiensoy y pedile al admin que configure TELEGRAM_DT_UN_SOLO_USUARIO, TELEGRAM_ASESOR_MAP o TELEGRAM_DT_DEFAULT_ASESOR_ID en Vercel.`
        )
        return
      }
      const msg = await loadAgendaTextoParaAsesor(asesorId)
      await sendTelegramMessage(chatId, msg)
      return
    }

    if (cmd === '/status') {
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
    console.error('[Telegram Webhook] ERROR:', error)
    console.error('[Telegram Webhook] Stack:', error instanceof Error ? error.stack : 'No stack')
    // Ya respondimos 200, solo logueamos el error
  }
}
