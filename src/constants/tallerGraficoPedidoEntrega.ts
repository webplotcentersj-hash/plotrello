/** Canal Realtime Broadcast: pedidos desde Caja/Mostrador → Taller Gráfico (pantalla de entrega). */
export const TALLER_GRAFICO_PEDIDO_ENTREGA_CHANNEL = 'taller_grafico_pedidos_entrega_v1'

export const TALLER_GRAFICO_PEDIDO_ENTREGA_EVENT = 'pedido_desde_entrega'

export type TallerGraficoPedidoEntregaPayload = {
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

/** Lo que envía Caja/Mostrador desde la pantalla de entrega (el API agrega sentAt y nonce). */
export type TallerGraficoPedidoEntregaInput = Omit<TallerGraficoPedidoEntregaPayload, 'sentAt' | 'nonce'>
