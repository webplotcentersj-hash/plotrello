import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron: avisar por Telegram ~30 min antes de cada cita (agenda DT).
 *
 * **Reemplazado por n8n:** importar `n8n-workflows/agenda-telegram-reminders-30m.json` y
 * ejecutar el flujo en n8n (cron cada 1 min). El cron de Vercel para este endpoint
 * fue desactivado en `vercel.json` para no duplicar avisos.
 *
 * Si necesitás mantener este endpoint por compatibilidad, podés llamarlo manualmente
 * o reactivar un cron en Vercel (no duplicar con n8n).
 *
 * Vercel Cron (legacy) → GET este endpoint cada minuto.
 * Variables:
 * - TELEGRAM_BOT_TOKEN
 * - SUPABASE_SERVICE_ROLE_KEY (requerido: actualiza citas y llama RPC)
 * - TELEGRAM_DT_UN_SOLO_USUARIO=tgChatId:idAsesor (caso un solo DT; recordatorios + coherente con /agenda)
 * - TELEGRAM_ASESOR_MAP (varios tgUserId:idAsesor,...)
 * - TELEGRAM_DT_DEFAULT_ASESOR_ID + TELEGRAM_DT_REMINDER_CHAT_IDS (opcional)
 * - CRON_SECRET: Bearer <CRON_SECRET> (se recorta espacios). Opcional: CRON_ALLOW_VERCEL_HEADER=1 si Vercel no manda Bearer.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_API_URL = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : ''

const TZ_AR = 'America/Argentina/Buenos_Aires'

type CitaRow = {
  id: number
  id_asesor: number
  titulo: string
  fecha_cita: string
  duracion_minutos?: number | null
  estado?: string | null
  direccion?: string | null
  ubicacion_link?: string | null
  cliente_nombre?: string | null
  ficha_numero?: string | null
}

function parseAsesorToTelegramChats(): Map<number, number[]> {
  const map = new Map<number, number[]>()
  const solo = (process.env.TELEGRAM_DT_UN_SOLO_USUARIO || '').trim()
  if (solo) {
    const [tg, asesor] = solo.split(':').map((s) => s.trim())
    const tgId = parseInt(tg, 10)
    const asesorId = parseInt(asesor, 10)
    if (!isNaN(tgId) && !isNaN(asesorId)) {
      map.set(asesorId, [tgId])
    }
  }
  const raw = process.env.TELEGRAM_ASESOR_MAP || ''
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [tg, asesor] = trimmed.split(':').map((s) => s.trim())
    const tgId = parseInt(tg, 10)
    const asesorId = parseInt(asesor, 10)
    if (isNaN(tgId) || isNaN(asesorId)) continue
    const list = map.get(asesorId) || []
    if (!list.includes(tgId)) list.push(tgId)
    map.set(asesorId, list)
  }
  const defaultAsesor = parseInt(process.env.TELEGRAM_DT_DEFAULT_ASESOR_ID || '', 10)
  const extraChats = (process.env.TELEGRAM_DT_REMINDER_CHAT_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))
  if (!isNaN(defaultAsesor) && defaultAsesor > 0 && extraChats.length > 0) {
    const cur = map.get(defaultAsesor) || []
    const merged = [...new Set([...cur, ...extraChats])]
    map.set(defaultAsesor, merged)
  }
  return map
}

async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  if (!TELEGRAM_API_URL) return false
  try {
    const res = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.substring(0, 4096)
      })
    })
    if (!res.ok) {
      console.error('[agenda-telegram-reminders] sendMessage fail:', await res.text())
      return false
    }
    const j = await res.json()
    return Boolean(j.ok)
  } catch (e) {
    console.error('[agenda-telegram-reminders] sendMessage error:', e)
    return false
  }
}

function buildReminderText(c: CitaRow): string {
  const when = new Date(c.fecha_cita)
  const fechaStr = when.toLocaleString('es-AR', {
    timeZone: TZ_AR,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  const cli = c.cliente_nombre ? `\nCliente: ${c.cliente_nombre}` : ''
  const ficha = c.ficha_numero ? `\nFicha: ${c.ficha_numero}` : ''
  const dur = c.duracion_minutos ? `\nDuración: ${c.duracion_minutos} min` : ''
  const dir = c.direccion ? `\n📍 ${c.direccion}` : ''
  const link = c.ubicacion_link ? `\n🗺 ${c.ubicacion_link}` : ''
  return (
    `⏰ En 30 minutos tenés una cita (DT / Plotlab)\n\n` +
    `📌 ${c.titulo}\n` +
    `🕐 ${fechaStr}${cli}${ficha}${dur}${dir}${link}\n\n` +
    `Recordatorio automático (Plotlab)`
  )
}

function authorizeCronRequest(req: VercelRequest): { ok: true } | { ok: false; error: string } {
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  if (process.env.VERCEL_ENV === 'production' && !cronSecret) {
    return { ok: false, error: 'Definí CRON_SECRET en Vercel (producción).' }
  }
  if (!cronSecret) {
    return { ok: true }
  }
  const auth = (req.headers.authorization || '').trim()
  const expected = `Bearer ${cronSecret}`
  if (auth === expected) {
    return { ok: true }
  }
  const vercelCron = req.headers['x-vercel-cron']
  if (vercelCron === '1' && process.env.CRON_ALLOW_VERCEL_HEADER === '1') {
    console.warn('[agenda-telegram-reminders] Auth por x-vercel-cron (CRON_ALLOW_VERCEL_HEADER=1)')
    return { ok: true }
  }
  return {
    ok: false,
    error:
      'Unauthorized (Bearer CRON_SECRET). Revisá que en Vercel no haya espacios de más en CRON_SECRET; tras cambiarla, redeploy.'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const authz = authorizeCronRequest(req)
  if (!authz.ok) {
    const status = authz.error.startsWith('Definí') ? 500 : 401
    res.status(status).json({ ok: false, error: authz.error })
    return
  }

  if (!supabase) {
    res.status(503).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY o URL faltante' })
    return
  }
  if (!TELEGRAM_BOT_TOKEN) {
    res.status(503).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' })
    return
  }

  const asesorToChats = parseAsesorToTelegramChats()
  let totalChatsMapeados = 0
  asesorToChats.forEach((ids) => {
    totalChatsMapeados += ids.length
  })

  const { data, error } = await supabase.rpc('obtener_citas_recordatorio_telegram_15m')
  if (error) {
    console.error('[agenda-telegram-reminders] RPC:', error)
    res.status(500).json({ ok: false, error: error.message })
    return
  }

  const citas = (data || []) as CitaRow[]
  let sent = 0
  let skipped = 0
  let marked = 0

  for (const c of citas) {
    const chatIds = asesorToChats.get(c.id_asesor) || []
    if (chatIds.length === 0) {
      console.warn('[agenda-telegram-reminders] Sin chat Telegram para id_asesor', c.id_asesor, 'cita', c.id)
      skipped++
      continue
    }

    const text = buildReminderText(c)
    let anyOk = false
    for (const chatId of chatIds) {
      const ok = await sendTelegramMessage(chatId, text)
      if (ok) anyOk = true
    }

    if (anyOk) {
      const { error: upErr } = await supabase
        .from('citas_asesor_tecnico')
        .update({ recordatorio_telegram_15m_at: new Date().toISOString() })
        .eq('id', c.id)
      if (upErr) {
        console.error('[agenda-telegram-reminders] update cita', c.id, upErr)
      } else {
        marked++
      }
      sent++
    }
  }

  res.status(200).json({
    ok: true,
    citas_en_ventana: citas.length,
    recordatorios_enviados: sent,
    sin_destinatario: skipped,
    citas_marcadas: marked,
    /** Si es 0, TELEGRAM_DT_UN_SOLO_USUARIO / TELEGRAM_ASESOR_MAP no matchean o faltan */
    asesores_con_chat_mapeado: asesorToChats.size,
    chats_telegram_mapeados: totalChatsMapeados
  })
}
