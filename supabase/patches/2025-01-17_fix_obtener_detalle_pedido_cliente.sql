-- Actualizar función obtener_detalle_pedido_cliente para usar tabla unificada clientes
-- Esta función aún tenía una referencia a clientes_web que fue corregida

DROP FUNCTION IF EXISTS public.obtener_detalle_pedido_cliente(integer);

CREATE OR REPLACE FUNCTION public.obtener_detalle_pedido_cliente(
  p_id_pedido integer
)
RETURNS TABLE (
  pedido jsonb,
  items jsonb,
  archivos jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pedido_data jsonb;
  items_data jsonb;
  archivos_data jsonb;
BEGIN
  -- Obtener datos del pedido
  SELECT jsonb_build_object(
    'id', p.id,
    'numero_pedido', p.numero_pedido,
    'estado', p.estado,
    'fecha_pedido', p.fecha_pedido,
    'fecha_limite_deseada', p.fecha_limite_deseada,
    'precio_total', p.precio_total,
    'observaciones_cliente', p.observaciones_cliente,
    'observaciones_internas', p.observaciones_internas,
    'id_op_asociada', p.id_op_asociada,
    'cliente', jsonb_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'apellido', c.apellido,
      'empresa', c.empresa,
      'email', c.email,
      'telefono', c.telefono
    )
  )
  INTO pedido_data
  FROM public.pedidos_clientes p
  JOIN public.clientes c ON c.id = p.id_cliente
  WHERE p.id = p_id_pedido;

  -- Obtener items del pedido
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'id_articulo', i.id_articulo,
      'articulo', jsonb_build_object(
        'codigo', a.codigo,
        'nombre', a.nombre,
        'descripcion', a.descripcion
      ),
      'cantidad', i.cantidad,
      'precio_unitario', i.precio_unitario,
      'precio_total', i.precio_total,
      'descripcion_personalizada', i.descripcion_personalizada
    )
  )
  INTO items_data
  FROM public.pedidos_clientes_items i
  JOIN public.articulos_empresa a ON a.id = i.id_articulo
  WHERE i.id_pedido = p_id_pedido;

  -- Obtener archivos del pedido
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'id_item', f.id_item,
      'url', f.url,
      'nombre_archivo', f.nombre_archivo,
      'tipo', f.tipo,
      'tamaño', f.tamaño,
      'uploaded_at', f.uploaded_at
    )
  )
  INTO archivos_data
  FROM public.pedidos_clientes_archivos f
  WHERE f.id_pedido = p_id_pedido;

  RETURN QUERY
  SELECT
    pedido_data,
    COALESCE(items_data, '[]'::jsonb),
    COALESCE(archivos_data, '[]'::jsonb);
END;
$$;

