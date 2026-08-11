import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import {
  TOTEM_ASESOR_EN_CAMINO_EVENT,
  TOTEM_SOLICITUD_ASESOR_CHANNEL,
  TOTEM_SOLICITUD_ASESOR_MARKER,
  type TotemAsesorEnCaminoPayload
} from '../constants/totemSolicitudAsesor'

export type SolicitarAsesorTotemOpts = {
  clienteNombre?: string
  productoNombre?: string
  contexto?: string
  numeroOp?: string
  ordenId?: number
  sectorDestino?: string
  /** Si true, notifica como llamado a Presupuestos (no fuerza sector «Asesor»). */
  comoLlamadoPresupuesto?: boolean
}

export type SolicitarAsesorTotemResult = {
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

/** Avisa a mostrador + broadcast a tablet /asesor (misma lógica que consulta tótem). */
export async function solicitarAsesorTotem(
  opts: SolicitarAsesorTotemOpts = {}
): Promise<SolicitarAsesorTotemResult> {
  const nombre = opts.clienteNombre?.trim() || 'Cliente tótem catálogo'
  const detalle = opts.productoNombre
    ? `Producto: ${opts.productoNombre}. ${opts.contexto || ''}`.trim()
    : opts.contexto || ''
  const sectorDestino = opts.sectorDestino?.trim() || 'Catálogo tótem'
  const sectorAtencion = opts.comoLlamadoPresupuesto
    ? opts.sectorDestino?.trim() || 'Presupuestos y asesoramiento'
    : 'Asesor'
  const notas = [
    detalle,
    opts.comoLlamadoPresupuesto
      ? `Sector sugerido: Presupuestos y asesoramiento.`
      : `Sector sugerido: Asesor.`,
    TOTEM_SOLICITUD_ASESOR_MARKER
  ]
    .filter(Boolean)
    .join(' ')
  const clientNonce = newClientNonce()

  try {
    const res = await apiService.crearAtencionMostrador({
      cliente_nombre: nombre,
      tipo: 'consulta',
      usuario_id: 1,
      usuario_nombre: 'Totem autoservicio',
      orden_id: opts.ordenId,
      notas,
      sector_destino: sectorAtencion,
      orden_numero_op: opts.numeroOp
    })
    if (!res.success) {
      return { ok: false, mensaje: res.error || 'No se pudo avisar a un asesor.' }
    }

    const atencionId = typeof res.data === 'number' ? res.data : undefined
    const broadcastRes = await apiService.broadcastTotemSolicitudAsesor({
      atencionId,
      clienteNombre: nombre,
      numeroOp: opts.numeroOp,
      sectorDestino,
      notas,
      clientNonce
    })

    const requestNonce =
      broadcastRes.success && broadcastRes.data?.nonce ? broadcastRes.data.nonce : clientNonce

    if (!broadcastRes.success) {
      return {
        ok: true,
        mensaje: opts.comoLlamadoPresupuesto
          ? '📞 Registramos tu visita. Presupuestos te va a atender en breve.'
          : '📞 Registramos tu solicitud. Un asesor te va a atender en breve.',
        atencionId,
        requestNonce
      }
    }
    return {
      ok: true,
      mensaje: opts.comoLlamadoPresupuesto
        ? '📞 Avisamos a Presupuestos. En breve te atienden.'
        : '📞 Avisamos a un asesor. En breve te atienden en mostrador.',
      atencionId,
      requestNonce
    }
  } catch {
    return { ok: false, mensaje: 'No se pudo avisar a un asesor. Acercate a mostrador.' }
  }
}

function parseEnCaminoPayload(raw: unknown): TotemAsesorEnCaminoPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const asesorNombre = typeof o.asesorNombre === 'string' ? o.asesorNombre.trim() : ''
  const mensaje = typeof o.mensaje === 'string' ? o.mensaje.trim() : ''
  const nonce = typeof o.nonce === 'string' ? o.nonce : ''
  if (!asesorNombre || !mensaje || !nonce) return null
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
    asesorNombre,
    mensaje,
    sentAt: typeof o.sentAt === 'string' ? o.sentAt : new Date().toISOString(),
    nonce
  }
}

/**
 * Escucha en el tótem la confirmación del asesor («ya voy»).
 * Devuelve cleanup para desuscribir.
 */
export function listenAsesorEnCamino(
  match: { atencionId?: number; requestNonce?: string },
  onMsg: (payload: TotemAsesorEnCaminoPayload) => void
): () => void {
  if (!supabase) return () => undefined
  const sb = supabase
  const channel = sb.channel(TOTEM_SOLICITUD_ASESOR_CHANNEL, {
    config: { broadcast: { ack: false, self: false } }
  })

  channel.on('broadcast', { event: TOTEM_ASESOR_EN_CAMINO_EVENT }, (msg: unknown) => {
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

    // Sin correlación fuerte (p. ej. solo un tótem): aceptar si no hay filtros
    const sinFiltro = match.atencionId == null && !match.requestNonce
    if (!matchAtencion && !matchNonce && !sinFiltro) return

    onMsg(parsed)
  })

  void channel.subscribe()

  return () => {
    void sb.removeChannel(channel)
  }
}
