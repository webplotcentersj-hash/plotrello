/** Canal Realtime: tótem Diseño ↔ tablet /disenador. */
export const TOTEM_SOLICITUD_DISENADOR_CHANNEL = 'totem_solicitud_disenador_v1'

export const TOTEM_SOLICITUD_DISENADOR_EVENT = 'solicitud_disenador'

export const TOTEM_DISENADOR_EN_CAMINO_EVENT = 'disenador_en_camino'

export const TOTEM_SOLICITUD_DISENADOR_MARKER = '[SOLICITUD_DISENADOR_TOTEM]'

export type TotemSolicitudDisenadorPayload = {
  atencionId?: number
  clienteNombre: string
  sectorDestino?: string
  notas?: string
  briefToken?: string
  sentAt: string
  nonce: string
}

export type TotemSolicitudDisenadorInput = Omit<TotemSolicitudDisenadorPayload, 'sentAt' | 'nonce'> & {
  clientNonce?: string
}

export type TotemDisenadorEnCaminoPayload = {
  atencionId?: number
  requestNonce?: string
  disenadorNombre: string
  mensaje: string
  sentAt: string
  nonce: string
}

export type TotemDisenadorEnCaminoInput = Omit<
  TotemDisenadorEnCaminoPayload,
  'sentAt' | 'nonce' | 'mensaje'
> & {
  mensaje?: string
}

export function mensajeDisenadorEnCamino(disenadorNombre: string): string {
  const nombre = disenadorNombre.trim() || 'Un diseñador'
  return `${nombre} ya vendrá a ayudarte.`
}
