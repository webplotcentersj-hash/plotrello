import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron diario: resumen por Telegram de compromisos financieros vencidos y por vencer
 * (tabla erp_compromisos_vencimientos + cheques pendientes de erp_cheques).
 *
 * Vercel Cron → GET todos los días (ver vercel.json). También se puede llamar desde n8n.
 * Variables:
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_COMPROMISOS_CHAT_IDS: chat ids separados por coma que reciben el resumen
 * - SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL / SUPABASE_URL
 * - CRON_SECRET: Bearer <CRON_SECRET> (Vercel Cron lo manda solo si está definida)
 * Query opcional: ?dry=1 devuelve el texto sin enviarlo.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TZ_AR = 'America/Argentina/Buenos_Aires'
/** Los cheques de Tesorería no tienen días de aviso propios. */
const DIAS_AVISO_CHEQUES = 7
const MAX_POR_GRUPO = 15

type Item = {
  fecha: string
  dias: number
  sentido: 'cobrar' | 'pagar'
  tipo: string
  numero: string | null
  contraparte: string
  importe: number
  cuota: string | null
}

function hoyAr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_AR, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10))
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10))
  return Math.round((b - a) / 86400000)
}

function sumarDias(iso: string, n: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n))
  return d.toISOString().slice(0, 10)
}

const fmtFecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fmtMoney = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function nombreCliente(c: { nombre?: string | null; apellido?: string | null; empresa?: string | null } | undefined, id: number) {
  if (!c) return `Cliente #${id}`
  return c.empresa?.trim() || [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || `Cliente #${id}`
}

function authorize(req: VercelRequest): string | null {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (process.env.VERCEL_ENV === 'production' && !secret) return 'Definí CRON_SECRET en Vercel (producción).'
  if (!secret) return null
  if ((req.headers.authorization || '').trim() === `Bearer ${secret}`) return null
  if (req.headers['x-vercel-cron'] === '1' && process.env.CRON_ALLOW_VERCEL_HEADER === '1') return null
  return 'Unauthorized'
}

async function enviar(chatId: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096), disable_web_page_preview: true })
    })
    return r.ok && Boolean((await r.json()).ok)
  } catch (e) {
    console.error('[compromisos-vencimientos] telegram', e)
    return false
  }
}

function linea(i: Item): string {
  const cuando = i.dias < 0 ? `hace ${-i.dias} d` : i.dias === 0 ? 'hoy' : i.dias === 1 ? 'mañana' : `en ${i.dias} d`
  const flecha = i.sentido === 'cobrar' ? '⬇️ Cobrar a' : '⬆️ Pagar a'
  return `• ${fmtFecha(i.fecha)} (${cuando}) ${flecha} ${i.contraparte} — ${i.tipo}${i.numero ? ` N° ${i.numero}` : ''}${i.cuota ? ` cuota ${i.cuota}` : ''}: ${fmtMoney(i.importe)}`
}

function grupo(titulo: string, items: Item[]): string {
  if (!items.length) return ''
  const total = items.reduce((s, i) => s + (i.sentido === 'cobrar' ? i.importe : -i.importe), 0)
  const resto = items.length > MAX_POR_GRUPO ? `\n  …y ${items.length - MAX_POR_GRUPO} más` : ''
  return `${titulo} (${items.length}, neto ${fmtMoney(total)})\n${items.slice(0, MAX_POR_GRUPO).map(linea).join('\n')}${resto}\n\n`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  const authErr = authorize(req)
  if (authErr) return res.status(authErr.startsWith('Definí') ? 500 : 401).json({ ok: false, error: authErr })
  if (!supabase) return res.status(503).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY o URL faltante' })

  const dry = req.query.dry === '1'
  const chatIds = (process.env.TELEGRAM_COMPROMISOS_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!dry && (!TELEGRAM_BOT_TOKEN || chatIds.length === 0)) {
    return res.status(503).json({ ok: false, error: 'Configurá TELEGRAM_BOT_TOKEN y TELEGRAM_COMPROMISOS_CHAT_IDS' })
  }

  const hoy = hoyAr()
  const hasta = sumarDias(hoy, 90)

  const { data: vencs, error: ev } = await supabase
    .from('erp_compromisos_vencimientos')
    .select('id,id_compromiso,nro_cuota,fecha,importe,numero_cheque')
    .eq('estado', 'Pendiente')
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .limit(2000)
  if (ev) return res.status(500).json({ ok: false, error: ev.message })

  const idsComp = [...new Set((vencs ?? []).map((v) => v.id_compromiso as number))]
  const { data: comps, error: ec } = idsComp.length
    ? await supabase
        .from('erp_compromisos')
        .select('id,sentido,tipo,numero,contraparte_tipo,id_cliente,id_proveedor,contraparte_nombre,dias_aviso')
        .in('id', idsComp)
    : { data: [], error: null }
  if (ec) return res.status(500).json({ ok: false, error: ec.message })

  const { data: cuotasTot } = idsComp.length
    ? await supabase.from('erp_compromisos_vencimientos').select('id_compromiso').in('id_compromiso', idsComp)
    : { data: [] as { id_compromiso: number }[] }
  const totalCuotas = new Map<number, number>()
  for (const r of cuotasTot ?? []) totalCuotas.set(r.id_compromiso, (totalCuotas.get(r.id_compromiso) ?? 0) + 1)

  const { data: cheques } = await supabase
    .from('erp_cheques')
    .select('id,tipo,es_echeq,numero,importe,fecha_pago,id_cliente,id_proveedor,tercero_nombre,librador_nombre')
    .in('estado', ['En cartera', 'Depositado', 'Emitido', 'Entregado'])
    .lte('fecha_pago', sumarDias(hoy, DIAS_AVISO_CHEQUES))

  const compPorId = new Map((comps ?? []).map((c) => [c.id as number, c]))
  const idsCli = new Set<number>()
  const idsProv = new Set<number>()
  for (const c of comps ?? []) {
    if (c.id_cliente) idsCli.add(c.id_cliente)
    if (c.id_proveedor) idsProv.add(c.id_proveedor)
  }
  for (const ch of cheques ?? []) {
    if (ch.id_cliente) idsCli.add(ch.id_cliente)
    if (ch.id_proveedor) idsProv.add(ch.id_proveedor)
  }
  const [{ data: clis }, { data: provs }] = await Promise.all([
    idsCli.size ? supabase.from('clientes').select('id,nombre,apellido,empresa').in('id', [...idsCli]) : Promise.resolve({ data: [] }),
    idsProv.size ? supabase.from('proveedores').select('id,nombre,razon_social').in('id', [...idsProv]) : Promise.resolve({ data: [] })
  ])
  const cliPorId = new Map((clis ?? []).map((c: { id: number }) => [c.id, c]))
  const provPorId = new Map((provs ?? []).map((p: { id: number; nombre: string | null; razon_social: string | null }) => [p.id, p]))
  const nomProv = (id: number) => {
    const p = provPorId.get(id)
    return p?.razon_social || p?.nombre || `Proveedor #${id}`
  }

  const items: Item[] = []
  for (const v of vencs ?? []) {
    const c = compPorId.get(v.id_compromiso)
    if (!c) continue
    const dias = diasEntre(hoy, v.fecha)
    if (dias > (c.dias_aviso ?? 7)) continue
    const contraparte =
      c.contraparte_tipo === 'cliente' && c.id_cliente
        ? nombreCliente(cliPorId.get(c.id_cliente) as never, c.id_cliente)
        : c.contraparte_tipo === 'proveedor' && c.id_proveedor
          ? nomProv(c.id_proveedor)
          : c.contraparte_nombre || '—'
    const tot = totalCuotas.get(c.id) ?? 1
    items.push({
      fecha: v.fecha,
      dias,
      sentido: c.sentido,
      tipo: c.tipo,
      numero: v.numero_cheque || c.numero,
      contraparte,
      importe: Number(v.importe),
      cuota: tot > 1 ? `${v.nro_cuota}/${tot}` : null
    })
  }
  for (const ch of cheques ?? []) {
    const tercero = ch.tipo === 'Tercero'
    items.push({
      fecha: ch.fecha_pago,
      dias: diasEntre(hoy, ch.fecha_pago),
      sentido: tercero ? 'cobrar' : 'pagar',
      tipo: ch.es_echeq ? 'E-cheq' : 'Cheque',
      numero: ch.numero,
      contraparte: tercero
        ? ch.id_cliente
          ? nombreCliente(cliPorId.get(ch.id_cliente) as never, ch.id_cliente)
          : ch.librador_nombre || ch.tercero_nombre || '—'
        : ch.id_proveedor
          ? nomProv(ch.id_proveedor)
          : ch.tercero_nombre || '—',
      importe: Number(ch.importe),
      cuota: null
    })
  }
  items.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const vencidos = items.filter((i) => i.dias < 0)
  const deHoy = items.filter((i) => i.dias === 0)
  const proximos = items.filter((i) => i.dias > 0)

  if (items.length === 0) {
    return res.status(200).json({ ok: true, enviados: 0, motivo: 'Sin vencimientos para avisar', hoy })
  }

  const texto =
    `📅 Compromisos financieros — ${fmtFecha(hoy)}\n\n` +
    grupo('🔴 VENCIDOS', vencidos) +
    grupo('🟠 VENCEN HOY', deHoy) +
    grupo('🟡 POR VENCER', proximos) +
    'Ver en el ERP › Compromisos financieros'

  if (dry) return res.status(200).json({ ok: true, dry: true, texto, items: items.length })

  let enviados = 0
  for (const id of chatIds) if (await enviar(id, texto)) enviados++
  return res.status(200).json({ ok: true, hoy, vencidos: vencidos.length, hoy_cant: deHoy.length, proximos: proximos.length, enviados })
}
