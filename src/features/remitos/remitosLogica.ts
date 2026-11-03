/**
 * Remito X con entregas parciales. Mismas reglas que remito_crear / remitos_pendientes en la base
 * (supabase/patches/2026-11-03_remitos_parciales.sql): lo pendiente de una línea es lo pedido menos
 * lo ya remitido en remitos no anulados. La base es la que valida; esto arma la pantalla y el PDF.
 */

export type EstadoRemito = 'Emitido' | 'Anulado'

export type RemitoItem = {
  id?: number
  orden: number
  id_venta_item?: number | null
  id_op_linea?: number | null
  codigo_articulo?: string | null
  descripcion: string
  unidad?: string | null
  cantidad: number
  /** Lo que decía el pedido y lo ya remitido cuando se emitió (null en líneas libres). */
  cantidad_pedida?: number | null
  cantidad_previa?: number | null
  observaciones?: string | null
}

export type Remito = {
  id: number
  tipo: 'X'
  punto_venta: number
  numero: number
  estado: EstadoRemito
  id_venta?: number | null
  numero_venta?: string | null
  id_op?: number | null
  numero_op?: string | null
  cliente_nombre: string
  cliente_documento?: string | null
  cliente_domicilio?: string | null
  cliente_telefono?: string | null
  fecha_emision: string
  fecha_entrega?: string | null
  entregado_a?: string | null
  dni_retira?: string | null
  transportista?: string | null
  observaciones?: string | null
  usuario_nombre?: string | null
  anulado_motivo?: string | null
  anulado_at?: string | null
  created_at?: string
  items: RemitoItem[]
}

export type LineaPendiente = {
  /** `v:<id>` para líneas de la venta, `o:<id>` para líneas m² de la OP. */
  clave: string
  id_venta_item?: number
  id_op_linea?: number
  codigo_articulo?: string | null
  descripcion: string
  unidad?: string | null
  pedida: number
  entregada: number
  pendiente: number
}

export type EstadoEntrega = 'Sin remitir' | 'Entrega parcial' | 'Entregado completo' | 'Sin líneas'

/** Cantidades con hasta 3 decimales, sin el ruido del punto flotante. */
export function cant3(n: number): number {
  if (!Number.isFinite(n)) return 0
  const signo = n < 0 ? -1 : 1
  return (signo * Math.round(Math.abs(n) * 1000 + 1e-7)) / 1000
}

export function numeroRemito(r: Pick<Remito, 'punto_venta' | 'numero'>): string {
  return `${String(r.punto_venta || 0).padStart(4, '0')}-${String(r.numero || 0).padStart(8, '0')}`
}

/** Respuesta de remitos_pendientes (la base cuenta lo remitido): una lista de líneas para la pantalla. */
export type PendientesRpc = {
  venta_items?: Array<{
    id_venta_item: number
    codigo_articulo?: string | null
    descripcion: string
    pedida: number | string
    entregada: number | string
    pendiente: number | string
  }> | null
  op_lineas?: Array<{
    id_op_linea: number
    descripcion: string
    unidad?: string | null
    pedida: number | string
    entregada: number | string
    pendiente: number | string
  }> | null
}

export function lineasDesdePendientes(rpc: PendientesRpc | null | undefined): LineaPendiente[] {
  const venta = (rpc?.venta_items ?? []).map<LineaPendiente>((l) => ({
    clave: `v:${l.id_venta_item}`,
    id_venta_item: l.id_venta_item,
    codigo_articulo: l.codigo_articulo ?? null,
    descripcion: l.descripcion,
    pedida: cant3(Number(l.pedida)),
    entregada: cant3(Number(l.entregada)),
    pendiente: cant3(Number(l.pendiente))
  }))
  const op = (rpc?.op_lineas ?? []).map<LineaPendiente>((l) => ({
    clave: `o:${l.id_op_linea}`,
    id_op_linea: l.id_op_linea,
    descripcion: l.descripcion,
    unidad: l.unidad ?? 'm²',
    pedida: cant3(Number(l.pedida)),
    entregada: cant3(Number(l.entregada)),
    pendiente: cant3(Number(l.pendiente))
  }))
  return [...venta, ...op]
}

export function estadoEntrega(lineas: LineaPendiente[]): EstadoEntrega {
  const conPedido = lineas.filter((l) => l.pedida > 0)
  if (conPedido.length === 0) return 'Sin líneas'
  if (conPedido.every((l) => l.pendiente === 0)) return 'Entregado completo'
  if (conPedido.some((l) => l.entregada > 0)) return 'Entrega parcial'
  return 'Sin remitir'
}

export type SeleccionEntrega = Record<string, number | string | null | undefined>

export type ResultadoSeleccion = {
  items: Array<{
    id_venta_item?: number
    id_op_linea?: number
    codigo_articulo?: string | null
    descripcion: string
    unidad?: string | null
    cantidad: number
  }>
  errores: string[]
}

/** Líneas a remitir y errores, a partir de lo que la persona cargó por línea. */
export function validarSeleccion(lineas: LineaPendiente[], seleccion: SeleccionEntrega): ResultadoSeleccion {
  const items: ResultadoSeleccion['items'] = []
  const errores: string[] = []
  for (const l of lineas) {
    const bruto = seleccion[l.clave]
    if (bruto === undefined || bruto === null || bruto === '') continue
    const numero = Number(String(bruto).replace(',', '.'))
    if (!Number.isFinite(numero) || numero < 0) {
      errores.push(`"${l.descripcion}": cantidad inválida`)
      continue
    }
    const cantidad = cant3(numero)
    if (cantidad === 0) continue
    if (cantidad > l.pendiente) {
      errores.push(`"${l.descripcion}": quedan ${l.pendiente} por remitir y cargaste ${cantidad}`)
      continue
    }
    items.push({
      ...(l.id_venta_item ? { id_venta_item: l.id_venta_item } : {}),
      ...(l.id_op_linea ? { id_op_linea: l.id_op_linea } : {}),
      codigo_articulo: l.codigo_articulo ?? null,
      descripcion: l.descripcion,
      unidad: l.unidad ?? null,
      cantidad
    })
  }
  if (items.length === 0 && errores.length === 0) errores.push('Cargá la cantidad de al menos una línea')
  return { items, errores }
}

/** Selección inicial: todo lo pendiente, para remitir la entrega completa de un clic. */
export function seleccionTotal(lineas: LineaPendiente[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of lineas) if (l.pendiente > 0) out[l.clave] = l.pendiente
  return out
}

/** Lo que queda por entregar de una línea después de este remito (null si la línea es libre). */
export function saldoTrasEntrega(it: RemitoItem): number | null {
  if (it.cantidad_pedida === null || it.cantidad_pedida === undefined) return null
  return Math.max(cant3(Number(it.cantidad_pedida) - Number(it.cantidad_previa ?? 0) - Number(it.cantidad)), 0)
}

/** Es parcial si después de este remito todavía queda algo pendiente en alguna línea controlada. */
export function esRemitoParcial(r: Pick<Remito, 'items'>): boolean {
  return (r.items ?? []).some((it) => (saldoTrasEntrega(it) ?? 0) > 0)
}

/** Cuántos remitos vigentes tiene la venta/OP hasta este inclusive (orden de emisión). */
export function numeroDeEntrega(remito: Remito, delMismoOrigen: Remito[]): number {
  return delMismoOrigen
    .filter((r) => r.estado === 'Emitido' && (r.id < remito.id || r.id === remito.id))
    .length
}

export function resumenRemitos(remitos: Remito[]): { emitidos: number; anulados: number } {
  let emitidos = 0
  let anulados = 0
  for (const r of remitos) r.estado === 'Anulado' ? anulados++ : emitidos++
  return { emitidos, anulados }
}
