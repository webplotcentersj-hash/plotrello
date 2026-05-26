import type { ArticuloEmpresaRecord } from '../types/api'
import { supabase, stockSupabase } from './supabaseClient'
import { obtenerStockArticulo } from './commerceStockService'
import { validarCantidadVentaComercial } from './commerceCatalogService'

export type CarritoClienteItemRow = {
  id: number
  id_articulo: number
  cantidad: number
  precio_unitario: number
  nombre_articulo: string | null
  articulos_empresa?: ArticuloEmpresaRecord | ArticuloEmpresaRecord[] | null
}

export type CarritoClientePayload = {
  id_carrito: number
  id_cliente: number
  items: Array<{
    id: number
    id_articulo: number
    cantidad: number
    precio_unitario: number
    precio_total: number
    nombre_articulo?: string | null
    articulo: ArticuloEmpresaRecord
  }>
  total: number
  cantidad_items: number
}

async function ensureCarritoId(idCliente: number): Promise<{ id: number } | { error: string }> {
  if (!supabase) return { error: 'Sin conexión' }

  const { data: existing } = await supabase
    .from('carritos_clientes')
    .select('id')
    .eq('id_cliente', idCliente)
    .maybeSingle()

  if (existing?.id) return { id: existing.id }

  const { data: created, error } = await supabase
    .from('carritos_clientes')
    .insert({ id_cliente: idCliente })
    .select('id')
    .single()

  if (error || !created) return { error: error?.message || 'No se pudo crear el carrito' }
  return { id: created.id }
}

function joinArticulo(
  raw: ArticuloEmpresaRecord | ArticuloEmpresaRecord[] | null | undefined
): ArticuloEmpresaRecord | undefined {
  if (!raw) return undefined
  return Array.isArray(raw) ? raw[0] : raw
}

async function enrichArticulo(row: ArticuloEmpresaRecord): Promise<ArticuloEmpresaRecord> {
  if (!stockSupabase || !row.id_articulo_stock) return row
  const st = await obtenerStockArticulo(row.id_articulo_stock)
  return {
    ...row,
    stock_disponible: st.success && st.data ? st.data.stock : null
  }
}

export async function obtenerCarritoCliente(
  idCliente: number
): Promise<{ success: boolean; data?: CarritoClientePayload; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión' }

  const carrito = await ensureCarritoId(idCliente)
  if ('error' in carrito) return { success: false, error: carrito.error }

  const { data: rows, error } = await supabase
    .from('carritos_clientes_items')
    .select(
      `
      id,
      id_articulo,
      cantidad,
      precio_unitario,
      nombre_articulo,
      articulos_empresa (*)
    `
    )
    .eq('id_carrito', carrito.id)
    .order('id', { ascending: true })

  if (error) return { success: false, error: error.message }

  const items: CarritoClientePayload['items'] = []
  for (const row of (rows || []) as CarritoClienteItemRow[]) {
    const base = joinArticulo(row.articulos_empresa)
    if (!base) continue
    const articulo = await enrichArticulo(base)
    const cantidad = row.cantidad || 1
    const precio_unitario = Number(row.precio_unitario) || articulo.precio_base || 0
    items.push({
      id: row.id,
      id_articulo: row.id_articulo,
      cantidad,
      precio_unitario,
      precio_total: cantidad * precio_unitario,
      nombre_articulo: row.nombre_articulo,
      articulo
    })
  }

  const total = items.reduce((s, i) => s + i.precio_total, 0)
  const cantidad_items = items.reduce((s, i) => s + i.cantidad, 0)

  return {
    success: true,
    data: {
      id_carrito: carrito.id,
      id_cliente: idCliente,
      items,
      total,
      cantidad_items
    }
  }
}

export async function setCarritoItemCliente(
  idCliente: number,
  idArticulo: number,
  cantidad: number
): Promise<{ success: boolean; data?: CarritoClientePayload; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión' }

  const { data: ae, error: aeErr } = await supabase
    .from('articulos_empresa')
    .select('*')
    .eq('id', idArticulo)
    .eq('activo', true)
    .maybeSingle()

  if (aeErr) return { success: false, error: aeErr.message }
  if (!ae) return { success: false, error: 'Artículo no disponible' }

  const articulo = await enrichArticulo(ae as ArticuloEmpresaRecord)
  const v = validarCantidadVentaComercial(articulo, cantidad)
  if (!v.ok) return { success: false, error: v.error }

  const carrito = await ensureCarritoId(idCliente)
  if ('error' in carrito) return { success: false, error: carrito.error }

  if (cantidad <= 0) {
    await supabase
      .from('carritos_clientes_items')
      .delete()
      .eq('id_carrito', carrito.id)
      .eq('id_articulo', idArticulo)
  } else {
    const { error: upsertErr } = await supabase.from('carritos_clientes_items').upsert(
      {
        id_carrito: carrito.id,
        id_articulo: idArticulo,
        cantidad: Math.floor(cantidad),
        precio_unitario: articulo.precio_base || 0,
        nombre_articulo: articulo.nombre,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id_carrito,id_articulo' }
    )
    if (upsertErr) return { success: false, error: upsertErr.message }
  }

  await supabase
    .from('carritos_clientes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', carrito.id)

  return obtenerCarritoCliente(idCliente)
}

export async function vaciarCarritoCliente(idCliente: number): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión' }
  const carrito = await ensureCarritoId(idCliente)
  if ('error' in carrito) return { success: false, error: carrito.error }
  const { error } = await supabase.from('carritos_clientes_items').delete().eq('id_carrito', carrito.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
