/**
 * Descuento de stock unificado para comercio omnicanal.
 * Stock físico: BD stock (stockSupabase). Movimientos: BD principal (supabase).
 */
import type { ArticuloStock } from '../types/pedidos'
import type { ArticuloEmpresaRecord } from '../types/api'
import { supabase, stockSupabase } from './supabaseClient'

export type CanalComercial = 'portal' | 'web_publica' | 'totem' | 'stickers' | 'mostrador' | 'sistema'

export type DescontarStockComercialInput = {
  idArticuloEmpresa: number
  cantidadVendida: number
  canal: CanalComercial
  idPedidoCliente?: number | null
  idVenta?: number | null
  idOrdenTrabajo?: number | null
  numeroReferencia?: string | null
  permitirStockNegativo?: boolean
}

export type DescontarStockComercialResult = {
  aplicado: boolean
  idArticuloStock?: number
  cantidadDescontada?: number
  stockRestante?: number | null
  motivo?: string
}

function getCurrentUser(): { id: number; nombre: string } {
  const id = Number(localStorage.getItem('usuario_id')) || 0
  let nombre = 'Sistema'
  try {
    const raw = localStorage.getItem('usuario')
    if (raw) {
      const p = JSON.parse(raw) as { nombre?: unknown }
      if (typeof p?.nombre === 'string' && p.nombre.trim()) nombre = p.nombre.trim()
    }
  } catch {
    /* ignore */
  }
  return { id, nombre }
}

export function articuloEmpresaPermiteDescontarStock(
  articulo: Pick<ArticuloEmpresaRecord, 'controla_stock' | 'modo_venta' | 'id_articulo_stock'>
): boolean {
  if (!articulo.controla_stock || !articulo.id_articulo_stock) return false
  const modo = articulo.modo_venta || 'ambos'
  return modo === 'compra' || modo === 'ambos'
}

export function cantidadStockADescontar(
  cantidadVendida: number,
  unidadesPorVenta: number | null | undefined
): number {
  const factor = Number(unidadesPorVenta) > 0 ? Number(unidadesPorVenta) : 1
  return Math.max(0, cantidadVendida) * factor
}

export async function obtenerStockArticulo(
  idArticuloStock: number
): Promise<{ success: boolean; data?: ArticuloStock; error?: string }> {
  if (!stockSupabase) {
    return { success: false, error: 'Base de stock no configurada' }
  }
  const { data, error } = await stockSupabase
    .from('articulos')
    .select('*')
    .eq('id', idArticuloStock)
    .maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Artículo de stock no encontrado' }
  return { success: true, data: data as ArticuloStock }
}

export async function descontarStockComercial(
  input: DescontarStockComercialInput
): Promise<{ success: boolean; data?: DescontarStockComercialResult; error?: string }> {
  if (!supabase || !stockSupabase) {
    return { success: false, error: 'Conexión a bases de datos no disponible' }
  }

  const { data: ae, error: aeErr } = await supabase
    .from('articulos_empresa')
    .select(
      'id, codigo, nombre, controla_stock, modo_venta, id_articulo_stock, unidades_por_venta'
    )
    .eq('id', input.idArticuloEmpresa)
    .maybeSingle()

  if (aeErr) return { success: false, error: aeErr.message }
  if (!ae) return { success: false, error: 'Artículo de catálogo no encontrado' }

  const articulo = ae as ArticuloEmpresaRecord
  if (!articuloEmpresaPermiteDescontarStock(articulo)) {
    return {
      success: true,
      data: {
        aplicado: false,
        motivo: 'El artículo no controla stock o no es venta tipo compra'
      }
    }
  }

  const idStock = articulo.id_articulo_stock!
  const cantidadADescontar = cantidadStockADescontar(
    input.cantidadVendida,
    articulo.unidades_por_venta
  )

  if (cantidadADescontar <= 0) {
    return { success: true, data: { aplicado: false, motivo: 'Cantidad cero' } }
  }

  const stockRes = await obtenerStockArticulo(idStock)
  if (!stockRes.success || !stockRes.data) {
    return { success: false, error: stockRes.error || 'No se pudo leer stock' }
  }

  const articuloStock = stockRes.data
  const cantidadAnterior = articuloStock.stock ?? 0

  if (cantidadAnterior < cantidadADescontar && !input.permitirStockNegativo) {
    return {
      success: false,
      error: `Stock insuficiente para "${articulo.nombre}" (disponible: ${cantidadAnterior}, requerido: ${cantidadADescontar})`
    }
  }

  const cantidadNueva = input.permitirStockNegativo
    ? cantidadAnterior - cantidadADescontar
    : Math.max(0, cantidadAnterior - cantidadADescontar)

  const { error: updErr } = await stockSupabase
    .from('articulos')
    .update({ stock: cantidadNueva })
    .eq('id', idStock)

  if (updErr) return { success: false, error: updErr.message }

  const { id: userId, nombre: userName } = getCurrentUser()
  const ref = input.numeroReferencia ? ` · ${input.numeroReferencia}` : ''
  const motivo = `Venta canal ${input.canal}${ref}`

  const movimiento: Record<string, unknown> = {
    id_articulo_stock: idStock,
    codigo_articulo: articuloStock.codigo || articulo.codigo || null,
    descripcion: articuloStock.descripcion || articulo.nombre,
    tipo_movimiento: 'Venta',
    cantidad: cantidadADescontar,
    cantidad_anterior: cantidadAnterior,
    cantidad_nueva: cantidadNueva,
    motivo,
    id_orden_trabajo: input.idOrdenTrabajo ?? null,
    id_usuario: userId || null,
    nombre_usuario: userName
  }

  if (input.idPedidoCliente) movimiento.id_pedido_cliente = input.idPedidoCliente
  if (input.idVenta) movimiento.id_venta = input.idVenta

  const { error: movErr } = await supabase.from('stock_movimientos').insert(movimiento)
  if (movErr) {
    console.error('[descontarStockComercial] Movimiento no registrado:', movErr.message)
  }

  return {
    success: true,
    data: {
      aplicado: true,
      idArticuloStock: idStock,
      cantidadDescontada: cantidadADescontar,
      stockRestante: cantidadNueva
    }
  }
}

export async function aplicarStockDesdePedidoCliente(
  idPedido: number,
  canal: CanalComercial = 'sistema',
  options?: { permitirStockNegativo?: boolean }
): Promise<{ success: boolean; descontados: number; errores: string[] }> {
  if (!supabase) {
    return { success: false, descontados: 0, errores: ['Sin conexión a Supabase'] }
  }

  const { data: pedido, error: pErr } = await supabase
    .from('pedidos_clientes')
    .select('id, numero_pedido, tipo_intencion')
    .eq('id', idPedido)
    .maybeSingle()

  if (pErr || !pedido) {
    return { success: false, descontados: 0, errores: [pErr?.message || 'Pedido no encontrado'] }
  }

  const intencion = (pedido as { tipo_intencion?: string }).tipo_intencion || 'compra'
  if (intencion === 'cotizacion') {
    return { success: true, descontados: 0, errores: [] }
  }

  const { data: items, error: iErr } = await supabase
    .from('pedidos_clientes_items')
    .select(
      `
      id,
      cantidad,
      id_articulo,
      articulos_empresa (
        id, nombre, codigo, controla_stock, modo_venta, id_articulo_stock, unidades_por_venta
      )
    `
    )
    .eq('id_pedido', idPedido)

  if (iErr) {
    return { success: false, descontados: 0, errores: [iErr.message] }
  }

  const errores: string[] = []
  let descontados = 0

  const joinArticulo = (
    raw: ArticuloEmpresaRecord | ArticuloEmpresaRecord[] | null | undefined
  ): ArticuloEmpresaRecord | undefined => {
    if (!raw) return undefined
    return Array.isArray(raw) ? raw[0] : raw
  }

  for (const row of items || []) {
    const joined = (row as unknown as { articulos_empresa?: unknown }).articulos_empresa
    const ae = joinArticulo(
      joined as ArticuloEmpresaRecord | ArticuloEmpresaRecord[] | null | undefined
    )
    if (!ae?.id) continue

    const res = await descontarStockComercial({
      idArticuloEmpresa: ae.id,
      cantidadVendida: Number((row as { cantidad?: number }).cantidad) || 0,
      canal,
      idPedidoCliente: idPedido,
      numeroReferencia: (pedido as { numero_pedido?: string }).numero_pedido,
      permitirStockNegativo: options?.permitirStockNegativo
    })

    if (!res.success) {
      errores.push(res.error || `Error en ítem ${ae.nombre}`)
    } else if (res.data?.aplicado) {
      descontados += 1
    }
  }

  return { success: errores.length === 0, descontados, errores }
}

export const COLUMNA_VISIBILIDAD_POR_CANAL: Record<
  Exclude<CanalComercial, 'sistema' | 'mostrador'>,
  keyof ArticuloEmpresaRecord
> = {
  portal: 'visible_portal',
  web_publica: 'visible_web_publica',
  totem: 'visible_totem',
  stickers: 'visible_stickers'
}
