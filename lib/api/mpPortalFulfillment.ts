import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

function getStockSupabase(): SupabaseClient | null {
  const url = process.env.STOCK_SUPABASE_URL || process.env.VITE_STOCK_SUPABASE_URL || ''
  const key =
    process.env.STOCK_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_STOCK_SUPABASE_ANON_KEY ||
    ''
  if (!url || !key) return null
  return createClient(url, key)
}

/** Descuenta stock y vacía carrito tras pago MP de portal o tótem (idempotente por checkout). */
export async function fulfillPortalPedidoMp(input: {
  pedidoId: number
  idCliente: number
  checkoutId: string
}): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const { data: chk } = await supabase.rpc('obtener_estado_mp_checkout', {
    p_checkout_id: input.checkoutId
  })
  const estado = (chk ?? {}) as { fulfillment_at?: string | null }
  if (estado.fulfillment_at) return

  const { data: pedido } = await supabase
    .from('pedidos_clientes')
    .select('observaciones_cliente, numero_pedido')
    .eq('id', input.pedidoId)
    .maybeSingle()
  const obs = String((pedido as { observaciones_cliente?: string | null } | null)?.observaciones_cliente || '')
  const canal = /t[oó]tem/i.test(obs) ? 'totem' : 'portal'
  const numero = (pedido as { numero_pedido?: string | null } | null)?.numero_pedido

  const { data: previos } = await supabase
    .from('stock_movimientos')
    .select('id_articulo_stock')
    .eq('id_pedido_cliente', input.pedidoId)
  const yaDescontados = new Set(
    (previos || [])
      .map((row) => Number((row as { id_articulo_stock?: number }).id_articulo_stock))
      .filter((id) => Number.isFinite(id))
  )

  const { data: items } = await supabase
    .from('pedidos_clientes_items')
    .select(
      `
      cantidad,
      id_articulo,
      articulos_empresa (
        id, nombre, codigo, controla_stock, modo_venta, id_articulo_stock, unidades_por_venta
      )
    `
    )
    .eq('id_pedido', input.pedidoId)

  const stockDb = getStockSupabase()
  const idsProducto = (items || [])
    .map((row) => Number((row as { id_articulo?: number }).id_articulo))
    .filter((id) => Number.isFinite(id))
  const { data: comps } = idsProducto.length
    ? await supabase
        .from('articulos_empresa_composicion')
        .select('id_articulo, id_articulo_stock, cantidad, codigo_stock, descripcion_stock')
        .in('id_articulo', idsProducto)
    : { data: [] as Array<Record<string, unknown>> }

  for (const row of items || []) {
    const raw = (row as { articulos_empresa?: unknown }).articulos_empresa
    const ae = Array.isArray(raw) ? raw[0] : raw
    if (!ae || typeof ae !== 'object') continue
    const art = ae as {
      id: number
      controla_stock?: boolean
      modo_venta?: string
      id_articulo_stock?: number | null
      unidades_por_venta?: number | null
      nombre?: string
      codigo?: string
    }
    const modo = art.modo_venta || 'ambos'
    if (modo !== 'compra' && modo !== 'ambos') continue

    const vendido = Math.max(0, Number((row as { cantidad: number }).cantidad) || 0)
    if (vendido <= 0) continue

    const delProducto = (comps || []).filter(
      (c) => Number((c as { id_articulo?: number }).id_articulo) === art.id
    )
    const salidas =
      delProducto.length > 0
        ? delProducto.map((c) => ({
            idStock: Number((c as { id_articulo_stock: number }).id_articulo_stock),
            cantidad: vendido * (Number((c as { cantidad?: number }).cantidad) > 0 ? Number((c as { cantidad?: number }).cantidad) : 1),
            codigo: (c as { codigo_stock?: string | null }).codigo_stock || null,
            descripcion: (c as { descripcion_stock?: string | null }).descripcion_stock || art.nombre || ''
          }))
        : art.controla_stock && art.id_articulo_stock
          ? [
              {
                idStock: art.id_articulo_stock,
                cantidad:
                  vendido * (Number(art.unidades_por_venta) > 0 ? Number(art.unidades_por_venta) : 1),
                codigo: art.codigo || null,
                descripcion: art.nombre || `Producto #${art.id}`
              }
            ]
          : []

    for (const salida of salidas) {
      if (!salida.idStock || salida.cantidad <= 0 || yaDescontados.has(salida.idStock)) continue
      let cantidadAnterior: number | null = null
      let cantidadNueva: number | null = null
      let codigoStock = salida.codigo
      let descripcion = salida.descripcion

      if (stockDb) {
        const { data: stockRow } = await stockDb
          .from('articulos')
          .select('id, codigo, descripcion, stock')
          .eq('id', salida.idStock)
          .maybeSingle()
        if (stockRow) {
          const actual = Number((stockRow as { stock?: number | null }).stock ?? 0)
          cantidadAnterior = actual
          cantidadNueva = actual - salida.cantidad
          codigoStock = (stockRow as { codigo?: string | null }).codigo || codigoStock
          descripcion = (stockRow as { descripcion?: string | null }).descripcion || descripcion
          await stockDb.from('articulos').update({ stock: cantidadNueva }).eq('id', salida.idStock)
        }
      }

      const ref = numero ? ` · ${numero}` : ''
      await supabase.from('stock_movimientos').insert({
        id_articulo_stock: salida.idStock,
        codigo_articulo: codigoStock,
        descripcion,
        tipo_movimiento: 'Venta',
        cantidad: salida.cantidad,
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        motivo: `Venta canal ${canal}${ref} · producto ${art.nombre || art.id}`,
        id_pedido_cliente: input.pedidoId,
        id_usuario: null,
        nombre_usuario: canal === 'totem' ? 'Tótem' : 'Portal'
      })
    }
  }

  const { data: carrito } = await supabase
    .from('carritos_clientes')
    .select('id')
    .eq('id_cliente', input.idCliente)
    .maybeSingle()

  if (carrito?.id) {
    await supabase.from('carritos_clientes_items').delete().eq('id_carrito', carrito.id)
  }

  await supabase.rpc('marcar_mp_checkout_fulfillment', { p_checkout_id: input.checkoutId })
}
