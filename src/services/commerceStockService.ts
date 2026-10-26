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

export async function buscarArticuloStockPorCodigo(codigo?: string | null): Promise<ArticuloStock | null> {
  if (!stockSupabase) return null
  const raw = String(codigo || '').trim()
  if (!raw) return null
  const variantes = [raw]
  if (/^\d+$/.test(raw)) {
    const sinCeros = raw.replace(/^0+/, '') || '0'
    if (sinCeros !== raw) variantes.push(sinCeros)
  }
  for (const variante of variantes) {
    const { data, error } = await stockSupabase
      .from('articulos')
      .select('*')
      .eq('codigo', variante)
      .limit(1)
      .maybeSingle()
    if (!error && data) return data as ArticuloStock
  }
  const { data } = await stockSupabase
    .from('articulos')
    .select('*')
    .ilike('codigo', raw)
    .limit(1)
    .maybeSingle()
  return (data as ArticuloStock) || null
}

async function buscarArticuloStockPorNombre(nombre?: string | null): Promise<ArticuloStock | null> {
  if (!stockSupabase) return null
  const raw = String(nombre || '').trim()
  if (raw.length < 3) return null
  const { data } = await stockSupabase
    .from('articulos')
    .select('*')
    .ilike('descripcion', raw)
    .limit(1)
    .maybeSingle()
  return (data as ArticuloStock) || null
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

async function descontarCantidadDeStock(args: {
  idStock: number
  cantidad: number
  codigo?: string | null
  descripcion?: string | null
  nombreProducto: string
  canal: CanalComercial
  numeroReferencia?: string | null
  idPedidoCliente?: number | null
  idVenta?: number | null
  idOrdenTrabajo?: number | null
  permitirStockNegativo?: boolean
}): Promise<{ success: boolean; data?: DescontarStockComercialResult; error?: string }> {
  if (!supabase || !stockSupabase) {
    return { success: false, error: 'Conexión a bases de datos no disponible' }
  }
  if (args.cantidad <= 0) {
    return { success: true, data: { aplicado: false, motivo: 'Cantidad cero' } }
  }

  const stockRes = await obtenerStockArticulo(args.idStock)
  if (!stockRes.success || !stockRes.data) {
    return { success: false, error: stockRes.error || 'No se pudo leer stock' }
  }

  const articuloStock = stockRes.data
  const cantidadAnterior = articuloStock.stock ?? 0
  if (cantidadAnterior < args.cantidad && !args.permitirStockNegativo) {
    return {
      success: false,
      error: `Stock insuficiente para "${articuloStock.descripcion || args.nombreProducto}" (disponible: ${cantidadAnterior}, requerido: ${args.cantidad})`
    }
  }

  const cantidadNueva = args.permitirStockNegativo
    ? cantidadAnterior - args.cantidad
    : Math.max(0, cantidadAnterior - args.cantidad)

  const { error: updErr } = await stockSupabase
    .from('articulos')
    .update({ stock: cantidadNueva })
    .eq('id', args.idStock)
  if (updErr) return { success: false, error: updErr.message }

  const { id: userId, nombre: userName } = getCurrentUser()
  const ref = args.numeroReferencia ? ` · ${args.numeroReferencia}` : ''
  const movimiento: Record<string, unknown> = {
    id_articulo_stock: args.idStock,
    codigo_articulo: articuloStock.codigo || args.codigo || null,
    descripcion: articuloStock.descripcion || args.descripcion || args.nombreProducto,
    tipo_movimiento: 'Venta',
    cantidad: args.cantidad,
    cantidad_anterior: cantidadAnterior,
    cantidad_nueva: cantidadNueva,
    motivo: `Venta canal ${args.canal}${ref} · producto ${args.nombreProducto}`,
    id_orden_trabajo: args.idOrdenTrabajo ?? null,
    id_usuario: userId || null,
    nombre_usuario: userName
  }
  if (args.idPedidoCliente) movimiento.id_pedido_cliente = args.idPedidoCliente
  if (args.idVenta) movimiento.id_venta = args.idVenta

  const { error: movErr } = await supabase.from('stock_movimientos').insert(movimiento)
  if (movErr) {
    console.error('[descontarStockComercial] Movimiento no registrado:', movErr.message)
  }

  return {
    success: true,
    data: {
      aplicado: true,
      idArticuloStock: args.idStock,
      cantidadDescontada: args.cantidad,
      stockRestante: cantidadNueva
    }
  }
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
  const modo = articulo.modo_venta || 'ambos'
  const modoCompra = modo === 'compra' || modo === 'ambos'

  const { data: comps } = await supabase
    .from('articulos_empresa_composicion')
    .select('id_articulo_stock, cantidad, codigo_stock, descripcion_stock')
    .eq('id_articulo', articulo.id)

  if (comps && comps.length) {
    if (!modoCompra) {
      return {
        success: true,
        data: { aplicado: false, motivo: 'El producto no es venta tipo compra' }
      }
    }
    let ultimo: DescontarStockComercialResult | undefined
    for (const comp of comps) {
      const factor = Number((comp as { cantidad?: number }).cantidad) > 0
        ? Number((comp as { cantidad?: number }).cantidad)
        : 1
      const res = await descontarCantidadDeStock({
        idStock: Number((comp as { id_articulo_stock: number }).id_articulo_stock),
        cantidad: cantidadStockADescontar(input.cantidadVendida, factor),
        codigo: (comp as { codigo_stock?: string | null }).codigo_stock,
        descripcion: (comp as { descripcion_stock?: string | null }).descripcion_stock,
        nombreProducto: articulo.nombre,
        canal: input.canal,
        numeroReferencia: input.numeroReferencia,
        idPedidoCliente: input.idPedidoCliente,
        idVenta: input.idVenta,
        idOrdenTrabajo: input.idOrdenTrabajo,
        permitirStockNegativo: input.permitirStockNegativo
      })
      if (!res.success) return res
      if (res.data?.aplicado) ultimo = res.data
    }
    return {
      success: true,
      data: ultimo ?? { aplicado: false, motivo: 'La composición no tiene cantidades' }
    }
  }

  if (!articuloEmpresaPermiteDescontarStock(articulo)) {
    const modoCompraSuelto = modo === 'compra' || modo === 'ambos'
    const porCodigo = modoCompraSuelto
      ? (await buscarArticuloStockPorCodigo(articulo.codigo)) ||
        (await buscarArticuloStockPorNombre(articulo.nombre))
      : null
    const idStock = articulo.id_articulo_stock || porCodigo?.id
    if (!idStock || !modoCompraSuelto) {
      return {
        success: true,
        data: {
          aplicado: false,
          motivo: 'El artículo no controla stock o no es venta tipo compra'
        }
      }
    }
    if (porCodigo && !articulo.id_articulo_stock) {
      await supabase
        .from('articulos_empresa')
        .update({ id_articulo_stock: porCodigo.id, controla_stock: true })
        .eq('id', articulo.id)
        .is('id_articulo_stock', null)
    }
    return descontarCantidadDeStock({
      idStock,
      cantidad: cantidadStockADescontar(input.cantidadVendida, articulo.unidades_por_venta),
      codigo: porCodigo?.codigo || articulo.codigo,
      descripcion: porCodigo?.descripcion || articulo.nombre,
      nombreProducto: articulo.nombre,
      canal: input.canal,
      numeroReferencia: input.numeroReferencia,
      idPedidoCliente: input.idPedidoCliente,
      idVenta: input.idVenta,
      idOrdenTrabajo: input.idOrdenTrabajo,
      permitirStockNegativo: input.permitirStockNegativo
    })
  }

  const idStock = articulo.id_articulo_stock!
  const cantidadADescontar = cantidadStockADescontar(
    input.cantidadVendida,
    articulo.unidades_por_venta
  )

  return descontarCantidadDeStock({
    idStock,
    cantidad: cantidadADescontar,
    codigo: articulo.codigo,
    descripcion: articulo.nombre,
    nombreProducto: articulo.nombre,
    canal: input.canal,
    numeroReferencia: input.numeroReferencia,
    idPedidoCliente: input.idPedidoCliente,
    idVenta: input.idVenta,
    idOrdenTrabajo: input.idOrdenTrabajo,
    permitirStockNegativo: input.permitirStockNegativo
  })
}

export async function aplicarStockDesdePedidoCliente(
  idPedido: number,
  canal: CanalComercial = 'sistema',
  options?: {
    permitirStockNegativo?: boolean
    /** Al convertir a OP: aplica stock aunque sea cotización y evita doble descuento. */
    enConversionOp?: boolean
  }
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
  if (intencion === 'cotizacion' && !options?.enConversionOp) {
    return { success: true, descontados: 0, errores: [] }
  }

  if (options?.enConversionOp) {
    const { count, error: movErr } = await supabase
      .from('stock_movimientos')
      .select('id', { count: 'exact', head: true })
      .eq('id_pedido_cliente', idPedido)
    if (!movErr && (count ?? 0) > 0) {
      return { success: true, descontados: 0, errores: [] }
    }
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
