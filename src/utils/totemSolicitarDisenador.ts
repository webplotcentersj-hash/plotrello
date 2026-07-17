import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import {
  TOTEM_DISENADOR_EN_CAMINO_EVENT,
  TOTEM_DISENADOR_EN_CAMINO_MARKER,
  TOTEM_DISENO_PENDING_ATENCION_KEY,
  TOTEM_SOLICITUD_DISENADOR_CHANNEL,
  TOTEM_SOLICITUD_DISENADOR_MARKER,
  type TotemDisenadorEnCaminoPayload,
  type TotemDisenoPendingAtencion
} from '../constants/totemSolicitudDisenador'

export type SolicitarDisenadorTotemOpts = {
  clienteNombre?: string
  contexto?: string
  briefToken?: string
}

export type SolicitarDisenadorTotemResult = {
  ok: boolean
  mensaje: string
  atencionId?: number
  requestNonce?: string
}

function newClientNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random()}`
}

export function savePendingDisenadorAtencion(pending: TotemDisenoPendingAtencion): void {
  try {
    sessionStorage.setItem(TOTEM_DISENO_PENDING_ATENCION_KEY, JSON.stringify(pending))
  } catch {
    /* ignore */
  }
}

export function readPendingDisenadorAtencion(): TotemDisenoPendingAtencion | null {
  try {
    const raw = sessionStorage.getItem(TOTEM_DISENO_PENDING_ATENCION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TotemDisenoPendingAtencion
    const id = Number(parsed?.atencionId)
    if (!Number.isFinite(id) || id <= 0) return null
    return { ...parsed, atencionId: id }
  } catch {
    return null
  }
}

export function clearPendingDisenadorAtencion(): void {
  try {
    sessionStorage.removeItem(TOTEM_DISENO_PENDING_ATENCION_KEY)
  } catch {
    /* ignore */
  }
}

export function parseDisenadorEnCaminoFromNotas(notas: string | null | undefined): string | null {
  const text = notas || ''
  const idx = text.indexOf(TOTEM_DISENADOR_EN_CAMINO_MARKER)
  if (idx < 0) return null
  const line = text.slice(idx + TOTEM_DISENADOR_EN_CAMINO_MARKER.length).split('\n')[0]?.trim()
  if (!line) return 'Un diseñador ya vendrá a ayudarte.'
  return line
}

/** Avisa a Diseño + broadcast a tablet /disenador. */
export async function solicitarDisenadorTotem(
  opts: SolicitarDisenadorTotemOpts = {}
): Promise<SolicitarDisenadorTotemResult> {
  const nombre = opts.clienteNombre?.trim() || 'Cliente tótem diseño'
  const detalle = opts.contexto?.trim() || 'Cliente en tótem de Diseño necesita ayuda.'
  const briefNota = opts.briefToken ? ` Brief token: ${opts.briefToken}.` : ''
  const notas = `${detalle}${briefNota} ${TOTEM_SOLICITUD_DISENADOR_MARKER}`.trim()
  const clientNonce = newClientNonce()

  try {
    const res = await apiService.crearAtencionMostrador({
      cliente_nombre: nombre,
      tipo: 'consulta',
      usuario_id: 1,
      usuario_nombre: 'Totem diseño',
      notas,
      sector_destino: 'Diseño gráfico'
    })
    if (!res.success) {
      return { ok: false, mensaje: res.error || 'No se pudo avisar a un diseñador.' }
    }

    // RPC puede devolver number o string; sin esto no se guarda pending y el tótem nunca ve la respuesta
    const atencionIdRaw = Number(res.data)
    const atencionId =
      Number.isFinite(atencionIdRaw) && atencionIdRaw > 0 ? atencionIdRaw : undefined

    const broadcastRes = await apiService.broadcastTotemSolicitudDisenador({
      atencionId,
      clienteNombre: nombre,
      sectorDestino: 'Diseño gráfico',
      notas,
      briefToken: opts.briefToken,
      clientNonce
    })

    const requestNonce =
      broadcastRes.success && broadcastRes.data?.nonce ? broadcastRes.data.nonce : clientNonce

    if (atencionId) {
      savePendingDisenadorAtencion({
        atencionId,
        requestNonce,
        clienteNombre: nombre,
        createdAt: new Date().toISOString()
      })
    }

    if (!broadcastRes.success) {
      return {
        ok: true,
        mensaje: '🎨 Registramos tu pedido. Un diseñador te va a atender en breve.',
        atencionId,
        requestNonce
      }
    }
    return {
      ok: true,
      mensaje: '🎨 Avisamos a un diseñador. En breve te atienden en el 1° piso.',
      atencionId,
      requestNonce
    }
  } catch {
    return { ok: false, mensaje: 'No se pudo avisar a un diseñador. Acercate al sector Diseño.' }
  }
}

function parseEnCaminoPayload(raw: unknown): TotemDisenadorEnCaminoPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const disenadorNombre = typeof o.disenadorNombre === 'string' ? o.disenadorNombre.trim() : ''
  const mensaje = typeof o.mensaje === 'string' ? o.mensaje.trim() : ''
  const nonce = typeof o.nonce === 'string' ? o.nonce : ''
  if (!disenadorNombre || !mensaje || !nonce) return null
  const atencionIdRaw = o.atencionId
  const atencionId =
    typeof atencionIdRaw === 'number'
      ? atencionIdRaw
      : Number.isFinite(Number(atencionIdRaw)) && Number(atencionIdRaw) > 0
        ? Number(atencionIdRaw)
        : undefined
  return {
    atencionId,
    requestNonce: typeof o.requestNonce === 'string' ? o.requestNonce : undefined,
    disenadorNombre,
    mensaje,
    sentAt: typeof o.sentAt === 'string' ? o.sentAt : new Date().toISOString(),
    nonce
  }
}

/**
 * Escucha broadcast + hace poll de la atención pendiente (sessionStorage / match).
 * El poll cubre cuando el Realtime se pierde entre /disenador y el tótem.
 */
export function listenDisenadorEnCamino(
  match: { atencionId?: number; requestNonce?: string },
  onMsg: (payload: TotemDisenadorEnCaminoPayload) => void
): () => void {
  if (!supabase) return () => undefined
  const sb = supabase
  let cancelled = false
  let delivered = false

  const deliver = (payload: TotemDisenadorEnCaminoPayload) => {
    if (cancelled || delivered) return
    delivered = true
    clearPendingDisenadorAtencion()
    onMsg(payload)
  }

  const mainCh = sb.channel(TOTEM_SOLICITUD_DISENADOR_CHANNEL, {
    config: { broadcast: { ack: false, self: false } }
  })

  const onBroadcast = (msg: unknown) => {
    const raw =
      msg && typeof msg === 'object' && 'payload' in msg
        ? (msg as { payload: unknown }).payload
        : msg
    const parsed = parseEnCaminoPayload(raw)
    if (!parsed) return

    const matchAtencion =
      match.atencionId != null &&
      parsed.atencionId != null &&
      Number(match.atencionId) === Number(parsed.atencionId)
    const matchNonce =
      Boolean(match.requestNonce) &&
      (parsed.requestNonce === match.requestNonce || parsed.nonce === match.requestNonce)
    const hasFilter = match.atencionId != null || Boolean(match.requestNonce)
    // Con filtro: exigir match. Sin filtro: aceptar cualquier «en camino».
    if (hasFilter && !matchAtencion && !matchNonce) return

    deliver(parsed)
  }

  mainCh.on('broadcast', { event: TOTEM_DISENADOR_EN_CAMINO_EVENT }, onBroadcast)
  void mainCh.subscribe()

  const pending = readPendingDisenadorAtencion()
  const pendingId = match.atencionId ?? pending?.atencionId
  const createdAtMs = pending?.createdAt ? Date.parse(pending.createdAt) : Date.now() - 60_000

  const pollOnce = async () => {
    if (cancelled || delivered) return
    try {
      const desde = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      const res = await apiService.obtenerAtencionesMostrador(desde)
      if (!res.success || !Array.isArray(res.data)) return

      let row = pendingId != null ? res.data.find((a) => Number(a.id) === Number(pendingId)) : undefined

      // Fallback: última solicitud de diseñador con respuesta, posterior a la llamada
      if (!row || !parseDisenadorEnCaminoFromNotas(row.notas)) {
        const candidatas = res.data.filter((a) => {
          const notas = a.notas || ''
          if (!notas.includes(TOTEM_SOLICITUD_DISENADOR_MARKER)) return false
          if (!parseDisenadorEnCaminoFromNotas(notas)) return false
          const t = Date.parse(a.fecha_atencion)
          return Number.isFinite(t) ? t >= createdAtMs - 30_000 : true
        })
        row = candidatas[0]
      }

      if (!row) return
      const mensaje = parseDisenadorEnCaminoFromNotas(row.notas)
      if (!mensaje) return
      const nombre =
        mensaje.replace(/\s+ya vendrá a ayudarte\.?$/i, '').trim() || 'Un diseñador'
      deliver({
        atencionId: Number(row.id),
        requestNonce: match.requestNonce,
        disenadorNombre: nombre,
        mensaje,
        sentAt: new Date().toISOString(),
        nonce: `poll-${row.id}-${Date.now()}`
      })
    } catch {
      /* ignore */
    }
  }

  void pollOnce()
  const pollId = window.setInterval(() => {
    void pollOnce()
  }, 2000)

  return () => {
    cancelled = true
    window.clearInterval(pollId)
    void sb.removeChannel(mainCh)
  }
}
