/** Canal Realtime Broadcast: tótem → tablet /asesor. */
export const TOTEM_SOLICITUD_ASESOR_CHANNEL = 'totem_solicitud_asesor_v1'

export const TOTEM_SOLICITUD_ASESOR_EVENT = 'solicitud_asesor'

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

export type TotemSolicitudAsesorInput = Omit<TotemSolicitudAsesorPayload, 'sentAt' | 'nonce'>
