/** Canal Realtime Broadcast: pedidos desde tótem/entrega → Taller de Imprenta. */
export const TALLER_IMPRENTA_PEDIDO_ENTREGA_CHANNEL = 'taller_imprenta_pedidos_entrega_v1'

export const TALLER_IMPRENTA_PEDIDO_ENTREGA_EVENT = 'pedido_desde_entrega'

export type TallerImprentaPedidoEntregaPayload = {
  idOrden: number
  numeroOp: string
  cliente: string
  /** Usuario que pidió el trabajo (Caja/Mostrador). */
  solicitanteId?: number
  solicitanteNombre: string
  solicitanteRol?: string
  /** ISO */
  sentAt: string
  nonce: string
}

/** Lo que envía el cliente; el API agrega sentAt y nonce. */
export type TallerImprentaPedidoEntregaInput = Omit<TallerImprentaPedidoEntregaPayload, 'sentAt' | 'nonce'>
