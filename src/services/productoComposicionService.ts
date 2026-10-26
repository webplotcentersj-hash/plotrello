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

export type UnidadLista1 = { id: number; unidad: string }

/** Unidad de la lista de precios 1, por código y por artículo de stock. */
export async function mapaUnidadesLista1(): Promise<{
  porCodigo: Map<string, UnidadLista1>
  porStockId: Map<number, UnidadLista1>
  porNombre: Map<string, UnidadLista1>
}> {
  const vacio = {
    porCodigo: new Map<string, UnidadLista1>(),
    porStockId: new Map<number, UnidadLista1>(),
    porNombre: new Map<string, UnidadLista1>()
  }
  if (!supabase) return vacio
  const { data, error } = await supabase
    .from('articulos_empresa')
    .select('id, codigo, nombre, unidad_medida, id_articulo_stock')
    .eq('activo', true)
  if (error || !data) return vacio

  const porCodigo = new Map<string, UnidadLista1>()
  const porStockId = new Map<number, UnidadLista1>()
  const porNombre = new Map<string, UnidadLista1>()
  const porId = new Map<number, UnidadLista1>()
  const guardarCodigo = (codigo: string, item: UnidadLista1) => {
    const base = codigo.trim().toLowerCase()
    if (!base || porCodigo.has(base)) return
    porCodigo.set(base, item)
    if (/^\d+$/.test(base)) {
      const sinCeros = base.replace(/^0+/, '') || '0'
      if (!porCodigo.has(sinCeros)) porCodigo.set(sinCeros, item)
    }
  }
  for (const row of data as Array<{
    id: number
    codigo: string | null
    nombre: string | null
    unidad_medida: string | null
    id_articulo_stock: number | null
  }>) {
    const item = { id: row.id, unidad: row.unidad_medida || 'm2' }
    porId.set(row.id, item)
    if (row.codigo) guardarCodigo(row.codigo, item)
    const nombre = (row.nombre || '').trim().toLowerCase()
    if (nombre && !porNombre.has(nombre)) porNombre.set(nombre, item)
    if (row.id_articulo_stock && !porStockId.has(row.id_articulo_stock)) {
      porStockId.set(row.id_articulo_stock, item)
    }
  }

  const comp = await listarComposicionProductos()
  if (comp.success) {
    for (const linea of comp.data) {
      const padre = porId.get(linea.id_articulo)
      if (padre && !porStockId.has(linea.id_articulo_stock)) {
        porStockId.set(linea.id_articulo_stock, padre)
      }
    }
  }
  return { porCodigo, porStockId, porNombre }
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
