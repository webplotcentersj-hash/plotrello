/** Estados de OP que el cliente interpreta como "listo para retirar / firmar". */
const ESTADOS_LISTOS_RETIRO = [
  'Almacén de Entrega',
  'Entregas taller gráfico',
  'Entregas taller grafico',
  'Finalizado en Taller',
  'Entregas taller de Imprenta',
  'Mostrador',
  'Caja'
]

export type OpListoRetiro = {
  numero_op: string
  titulo?: string | null
  estado: string
  origen: 'pedido' | 'brief'
  id_pedido?: number
  id_brief?: number
}

export function esEstadoListoParaRetiro(estado: string | null | undefined): boolean {
  if (!estado) return false
  const t = estado.trim()
  return ESTADOS_LISTOS_RETIRO.some(
    (e) =>
      t === e ||
      t.includes('Almacén') ||
      t.toLowerCase().includes('entregas taller')
  )
}

export function buildOpsListosRetiro(input: {
  pedidos: Array<{ id: number; numero_op?: string | null; estado_op?: string | null; descripcion?: string | null; objetivo_proyecto?: string | null }>
  briefs: Array<{ id: number; numero_op?: string | null; estado?: string | null; objetivo_proyecto?: string | null; completado?: boolean }>
}): OpListoRetiro[] {
  const map = new Map<string, OpListoRetiro>()

  for (const p of input.pedidos) {
    const op = (p.numero_op || '').trim()
    if (!op || !esEstadoListoParaRetiro(p.estado_op)) continue
    map.set(op, {
      numero_op: op,
      titulo: p.objetivo_proyecto || p.descripcion || null,
      estado: p.estado_op || 'Listo',
      origen: 'pedido',
      id_pedido: p.id
    })
  }

  for (const b of input.briefs) {
    const op = (b.numero_op || '').trim()
    if (!op || !b.completado || !esEstadoListoParaRetiro(b.estado)) continue
    if (!map.has(op)) {
      map.set(op, {
        numero_op: op,
        titulo: b.objetivo_proyecto || null,
        estado: b.estado || 'Listo',
        origen: 'brief',
        id_brief: b.id
      })
    }
  }

  return Array.from(map.values())
}
