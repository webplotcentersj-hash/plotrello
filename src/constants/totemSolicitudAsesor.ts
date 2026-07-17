/** Canal Realtime Broadcast: tótem → tablet /asesor. */
export const TOTEM_SOLICITUD_ASESOR_CHANNEL = 'totem_solicitud_asesor_v1'

export const TOTEM_SOLICITUD_ASESOR_EVENT = 'solicitud_asesor'

/** Respuesta asesor → tótem: «ya voy a ayudarlo». */
export const TOTEM_ASESOR_EN_CAMINO_EVENT = 'asesor_en_camino'

/** Marcador en notas de atenciones_mostrador para filtrar solicitudes de asesor. */
export const TOTEM_SOLICITUD_ASESOR_MARKER = '[SOLICITUD_ASESOR_TOTEM]'

export type TotemSolicitudAsesorPayload = {
  atencionId?: number
  clienteNombre: string
  numeroOp?: string
  sectorDestino?: string
  notas?: string
  sentAt: string
  nonce: string
}

export type TotemSolicitudAsesorInput = Omit<TotemSolicitudAsesorPayload, 'sentAt' | 'nonce'> & {
  /** Si el tótem manda un id, se reutiliza para correlacionar la respuesta. */
  clientNonce?: string
}

export type TotemAsesorEnCaminoPayload = {
  atencionId?: number
  /** Nonce de la solicitud original (si se conoce). */
  requestNonce?: string
  asesorNombre: string
  mensaje: string
  sentAt: string
  nonce: string
}

export type TotemAsesorEnCaminoInput = Omit<TotemAsesorEnCaminoPayload, 'sentAt' | 'nonce' | 'mensaje'> & {
  mensaje?: string
}

export function mensajeAsesorEnCamino(asesorNombre: string): string {
  const nombre = asesorNombre.trim() || 'Un asesor'
  return `${nombre} ya vendrá a ayudarte.`
}
