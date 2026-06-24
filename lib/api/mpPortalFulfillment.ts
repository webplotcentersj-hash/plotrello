import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

/** Descuenta stock y vacía carrito tras pago MP del portal (idempotente por checkout). */
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
    if (!art.controla_stock || !art.id_articulo_stock) continue
    const modo = art.modo_venta || 'ambos'
    if (modo !== 'compra' && modo !== 'ambos') continue

    const factor = Number(art.unidades_por_venta) > 0 ? Number(art.unidades_por_venta) : 1
    const cantidad = Math.max(0, Number((row as { cantidad: number }).cantidad) || 0) * factor
    if (cantidad <= 0) continue

    await supabase.from('stock_movimientos').insert({
      id_articulo_stock: art.id_articulo_stock,
      cantidad: -cantidad,
      tipo_movimiento: 'salida',
      motivo: `Portal MP — pedido #${input.pedidoId}`,
      id_pedido_cliente: input.pedidoId,
      id_usuario: 1,
      usuario_nombre: 'Portal MP'
    })
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
