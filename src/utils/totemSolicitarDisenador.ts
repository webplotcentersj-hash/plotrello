import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import {
  TOTEM_DISENADOR_EN_CAMINO_EVENT,
  TOTEM_SOLICITUD_DISENADOR_CHANNEL,
  TOTEM_SOLICITUD_DISENADOR_MARKER,
  type TotemDisenadorEnCaminoPayload
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

    const atencionId = typeof res.data === 'number' ? res.data : undefined
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

export function listenDisenadorEnCamino(
  match: { atencionId?: number; requestNonce?: string },
  onMsg: (payload: TotemDisenadorEnCaminoPayload) => void
): () => void {
  if (!supabase) return () => undefined
  const sb = supabase
  const channel = sb.channel(TOTEM_SOLICITUD_DISENADOR_CHANNEL, {
    config: { broadcast: { ack: false, self: false } }
  })

  channel.on('broadcast', { event: TOTEM_DISENADOR_EN_CAMINO_EVENT }, (msg: unknown) => {
    const raw =
      msg && typeof msg === 'object' && 'payload' in msg
        ? (msg as { payload: unknown }).payload
        : msg
    const parsed = parseEnCaminoPayload(raw)
    if (!parsed) return

    const matchAtencion =
      match.atencionId != null &&
      parsed.atencionId != null &&
      match.atencionId === parsed.atencionId
    const matchNonce =
      Boolean(match.requestNonce) &&
      (parsed.requestNonce === match.requestNonce || parsed.nonce === match.requestNonce)
    const sinFiltro = match.atencionId == null && !match.requestNonce
    if (!matchAtencion && !matchNonce && !sinFiltro) return

    onMsg(parsed)
  })

  void channel.subscribe()

  return () => {
    void sb.removeChannel(channel)
  }
}
