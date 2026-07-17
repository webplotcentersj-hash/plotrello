/** Canal Realtime: tótem Diseño ↔ tablet /disenador. */
export const TOTEM_SOLICITUD_DISENADOR_CHANNEL = 'totem_solicitud_disenador_v1'

export const TOTEM_SOLICITUD_DISENADOR_EVENT = 'solicitud_disenador'

export const TOTEM_DISENADOR_EN_CAMINO_EVENT = 'disenador_en_camino'

export const TOTEM_SOLICITUD_DISENADOR_MARKER = '[SOLICITUD_DISENADOR_TOTEM]'

/** Marcador en notas cuando el diseñador confirma desde /disenador. */
export const TOTEM_DISENADOR_EN_CAMINO_MARKER = '[DISENADOR_EN_CAMINO]'

/** sessionStorage: atención pendiente de respuesta en el tótem Diseño. */
export const TOTEM_DISENO_PENDING_ATENCION_KEY = 'plotlab_totem_diseno_pending_atencion'

export type TotemDisenoPendingAtencion = {
  atencionId: number
  requestNonce?: string
  clienteNombre?: string
  createdAt: string
}
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
