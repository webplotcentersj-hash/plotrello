import { supabase } from './supabaseClient'

export type ComponenteProducto = {
  id?: number
  id_articulo: number
  id_articulo_stock: number
  cantidad: number
  codigo_stock?: string | null
  descripcion_stock?: string | null
}

export type MovimientoTrazado = {
  id: number
  created_at: string
  tipo_movimiento: string
  cantidad: number
  motivo?: string | null
  descripcion?: string | null
  id_pedido_cliente?: number | null
  id_venta?: number | null
  id_orden_trabajo?: number | null
  id_articulo_stock?: number
}

export async function listarComposicionProductos(
  ids?: number[]
): Promise<{ success: boolean; data: ComponenteProducto[]; error?: string }> {
  if (!supabase) return { success: false, data: [], error: 'No hay conexión a Supabase' }
  let query = supabase.from('articulos_empresa_composicion').select('*')
  if (ids && ids.length) query = query.in('id_articulo', ids)
  const { data, error } = await query
  if (error) return { success: false, data: [], error: error.message }
  return { success: true, data: (data || []) as ComponenteProducto[] }
}

export async function guardarComposicionProducto(
  idArticulo: number,
  lineas: Array<Pick<ComponenteProducto, 'id_articulo_stock' | 'cantidad' | 'codigo_stock' | 'descripcion_stock'>>
): Promise<{ success: boolean; data: ComponenteProducto[]; error?: string }> {
  if (!supabase) return { success: false, data: [], error: 'No hay conexión a Supabase' }
  const { error: delErr } = await supabase
    .from('articulos_empresa_composicion')
    .delete()
    .eq('id_articulo', idArticulo)
  if (delErr) return { success: false, data: [], error: delErr.message }

  const rows = lineas
    .filter((l) => l.id_articulo_stock > 0 && Number(l.cantidad) > 0)
    .map((l) => ({
      id_articulo: idArticulo,
      id_articulo_stock: l.id_articulo_stock,
      cantidad: Number(l.cantidad),
      codigo_stock: l.codigo_stock || null,
      descripcion_stock: l.descripcion_stock || null
    }))

  if (!rows.length) return { success: true, data: [] }

  const { data, error } = await supabase.from('articulos_empresa_composicion').insert(rows).select('*')
  if (error) return { success: false, data: [], error: error.message }
  return { success: true, data: (data || []) as ComponenteProducto[] }
}

export async function movimientosDeStock(ids: number[]): Promise<MovimientoTrazado[]> {
  if (!supabase || !ids.length) return []
  const { data, error } = await supabase
    .from('stock_movimientos')
    .select('*')
    .in('id_articulo_stock', ids)
    .order('created_at', { ascending: false })
    .limit(12)
  if (error || !data) return []
  return data as MovimientoTrazado[]
}
