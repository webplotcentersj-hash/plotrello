export type TallerPedidoEntregaDestino = 'taller-grafico' | 'taller-imprenta'

/**
 * Decide qué talleres avisar cuando un cliente llega a retirar un trabajo
 * (tótem Finalizado en Taller / pedido desde entrega).
 *
 * Si el sector apunta claramente a uno, solo ese; si es ambiguo, ambos.
 */
export function resolverTalleresPedidoEntrega(orden: {
  sector?: string | null
  sectores?: string[] | null
}): TallerPedidoEntregaDestino[] {
  const parts = [
    orden.sector,
    ...(Array.isArray(orden.sectores) ? orden.sectores : [])
  ]
    .map((s) => String(s ?? '').trim().toLowerCase())
    .filter(Boolean)

  const blob = parts.join(' | ')

  const esTg = /taller gr[aá]fico/.test(blob)
  const esTi =
    /taller de imprenta/.test(blob) ||
    /imprenta \(área de impresión\)/.test(blob) ||
    /imprenta \(area de impresion\)/.test(blob) ||
    (/imprenta/.test(blob) && !esTg)

  if (esTg && !esTi) return ['taller-grafico']
  if (esTi && !esTg) return ['taller-imprenta']
  if (esTg && esTi) return ['taller-grafico', 'taller-imprenta']
  return ['taller-grafico', 'taller-imprenta']
}

export function etiquetaTalleresPedidoEntrega(destinos: TallerPedidoEntregaDestino[]): string {
  const labels: string[] = []
  if (destinos.includes('taller-grafico')) labels.push('Taller Gráfico')
  if (destinos.includes('taller-imprenta')) labels.push('Taller de Imprenta')
  if (labels.length === 0) return 'taller'
  if (labels.length === 1) return labels[0]!
  return `${labels[0]} y ${labels[1]}`
}
