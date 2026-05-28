/** Estados en los que mostrador puede convertir el pedido web en OP. */
export const ESTADOS_PEDIDO_CONVERTIBLES_A_OP = [
  'pendiente',
  'en_revision',
  'aprobado'
] as const

export function puedeConvertirPedidoAOp(pedido: {
  estado?: string | null
  id_op_asociada?: number | null
}): boolean {
  if (pedido.id_op_asociada) return false
  const estado = pedido.estado || ''
  if (estado === 'convertido_completo' || estado === 'convertido_parcial') return false
  if (estado === 'cancelado' || estado === 'rechazado') return false
  return (ESTADOS_PEDIDO_CONVERTIBLES_A_OP as readonly string[]).includes(estado)
}

export function etiquetaTipoIntencionPedido(tipo?: string | null): string {
  return tipo === 'cotizacion' ? 'Cotización' : 'Compra'
}
