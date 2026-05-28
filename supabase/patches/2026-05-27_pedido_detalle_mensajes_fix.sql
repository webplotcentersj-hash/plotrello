-- Detalle pedido con brief/especificación completa + fix mensajes (id ambiguo en RETURN TABLE)

CREATE OR REPLACE FUNCTION public.obtener_detalle_pedido_cliente(p_id_pedido integer)
RETURNS TABLE (pedido jsonb, items jsonb, archivos jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pedido_data jsonb;
  items_data jsonb;
  archivos_data jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id,
    'id_cliente', p.id_cliente,
    'numero_pedido', p.numero_pedido,
    'estado', p.estado,
    'fecha_pedido', p.fecha_pedido,
    'fecha_limite_deseada', p.fecha_limite_deseada,
    'precio_total', p.precio_total,
    'observaciones_cliente', p.observaciones_cliente,
    'observaciones_internas', p.observaciones_internas,
    'id_op_asociada', p.id_op_asociada,
    'es_urgente', p.es_urgente,
    'requiere_delivery', p.requiere_delivery,
    'direccion_delivery', p.direccion_delivery,
    'tipo_producto_servicio', p.tipo_producto_servicio,
    'tipo_producto_otro', p.tipo_producto_otro,
    'necesita_asesoramiento', p.necesita_asesoramiento,
    'donde_colocados', p.donde_colocados,
    'digital_o_impresion', p.digital_o_impresion,
    'cantidades', p.cantidades,
    'objetivo_proyecto', p.objetivo_proyecto,
    'material_logo', p.material_logo,
    'material_textos', p.material_textos,
    'material_imagenes', p.material_imagenes,
    'tiene_referencias', p.tiene_referencias,
    'referencias_links', p.referencias_links,
    'brief_publico', p.brief_publico,
    'estilo_diseno', p.estilo_diseno,
    'referencias', p.referencias,
    'tipo_intencion', p.tipo_intencion,
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

  IF pedido_data IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(
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
    ORDER BY i.id
  ), '[]'::jsonb)
  INTO items_data
  FROM public.pedidos_clientes_items i
  JOIN public.articulos_empresa a ON a.id = i.id_articulo
  WHERE i.id_pedido = p_id_pedido;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'id_item', f.id_item,
      'url', f.url,
      'nombre_archivo', f.nombre_archivo,
      'tipo', f.tipo,
      'tamaño', f.tamaño,
      'uploaded_at', f.uploaded_at
    )
    ORDER BY f.uploaded_at
  ), '[]'::jsonb)
  INTO archivos_data
  FROM public.pedidos_clientes_archivos f
  WHERE f.id_pedido = p_id_pedido;

  RETURN QUERY
  SELECT pedido_data, items_data, archivos_data;
END;
$$;

DROP FUNCTION IF EXISTS public.crear_mensaje_pedido_cliente(integer, integer, text, boolean, integer);

CREATE OR REPLACE FUNCTION public.crear_mensaje_pedido_cliente(
  p_id_pedido integer,
  p_id_cliente integer,
  p_mensaje text,
  p_es_del_cliente boolean,
  p_id_usuario integer DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  id_pedido_cliente integer,
  id_cliente integer,
  id_usuario integer,
  mensaje text,
  es_del_cliente boolean,
  leido boolean,
  fecha_creacion timestamp without time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  nuevo_mensaje_id integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_clientes pc
    WHERE pc.id = p_id_pedido AND pc.id_cliente = p_id_cliente
  ) THEN
    RAISE EXCEPTION 'Pedido no encontrado o no pertenece al cliente';
  END IF;

  INSERT INTO public.mensajes_pedidos_clientes (
    id_pedido_cliente,
    id_cliente,
    id_usuario,
    mensaje,
    es_del_cliente,
    leido
  ) VALUES (
    p_id_pedido,
    p_id_cliente,
    CASE WHEN p_es_del_cliente THEN NULL ELSE p_id_usuario END,
    trim(p_mensaje),
    p_es_del_cliente,
    false
  )
  RETURNING mensajes_pedidos_clientes.id INTO nuevo_mensaje_id;

  RETURN QUERY
  SELECT
    m.id,
    m.id_pedido_cliente,
    m.id_cliente,
    m.id_usuario,
    m.mensaje,
    m.es_del_cliente,
    m.leido,
    m.fecha_creacion
  FROM public.mensajes_pedidos_clientes m
  WHERE m.id = nuevo_mensaje_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_detalle_pedido_cliente(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.crear_mensaje_pedido_cliente(integer, integer, text, boolean, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.obtener_mensajes_pedido(integer, integer) TO authenticated, anon;
