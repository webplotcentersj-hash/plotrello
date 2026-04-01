import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron: avisar por Telegram ~15 min antes de cada cita (agenda DT).
 *
 * Vercel Cron → GET este endpoint cada minuto.
 * Variables:
 * - TELEGRAM_BOT_TOKEN
 * - SUPABASE_SERVICE_ROLE_KEY (requerido: actualiza citas y llama RPC)
 * - TELEGRAM_DT_UN_SOLO_USUARIO=tgChatId:idAsesor (caso un solo DT; recordatorios + coherente con /agenda)
 * - TELEGRAM_ASESOR_MAP (varios tgUserId:idAsesor,...)
 * - TELEGRAM_DT_DEFAULT_ASESOR_ID + TELEGRAM_DT_REMINDER_CHAT_IDS (opcional)
 * - CRON_SECRET: si está definido, el header Authorization debe ser Bearer <CRON_SECRET>
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
    `⏰ En 15 minutos tenés una cita (DT / Plotlab)\n\n` +
    `📌 ${c.titulo}\n` +
    `🕐 ${fechaStr}${cli}${ficha}${dur}${dir}${link}\n\n` +
    `Recordatorio automático (Plotlab)`
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const cronSecret = process.env.CRON_SECRET
  if (process.env.VERCEL_ENV === 'production' && !cronSecret) {
    res.status(500).json({ ok: false, error: 'Definí CRON_SECRET en Vercel (producción).' })
    return
  }
  if (cronSecret) {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ ok: false, error: 'Unauthorized' })
      return
    }
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
    citas_marcadas: marked
  })
}
