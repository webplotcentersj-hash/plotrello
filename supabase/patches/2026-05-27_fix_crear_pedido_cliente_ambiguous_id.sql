-- Fix: RETURNS TABLE (id ...) shadowing column "id" in UPDATE/WHERE inside crear_pedido_cliente

CREATE OR REPLACE FUNCTION public.crear_pedido_cliente(
  p_id_cliente integer,
  p_fecha_limite_deseada date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_es_urgente boolean DEFAULT false,
  p_requiere_delivery boolean DEFAULT false,
  p_direccion_delivery text DEFAULT NULL,
  p_tipo_producto_servicio text[] DEFAULT NULL,
  p_tipo_producto_otro text DEFAULT NULL,
  p_necesita_asesoramiento boolean DEFAULT false,
  p_donde_colocados text DEFAULT NULL,
  p_digital_o_impresion text DEFAULT NULL,
  p_cantidades text DEFAULT NULL,
  p_objetivo_proyecto text DEFAULT NULL,
  p_material_logo text DEFAULT NULL,
  p_material_textos text DEFAULT NULL,
  p_material_imagenes text DEFAULT NULL,
  p_tiene_referencias boolean DEFAULT false,
  p_referencias_links text DEFAULT NULL,
  p_brief_publico text DEFAULT NULL,
  p_estilo_diseno text DEFAULT NULL,
  p_referencias text DEFAULT NULL,
  p_tipo_intencion text DEFAULT 'compra'
)
RETURNS TABLE (
  id integer,
  numero_pedido varchar,
  estado varchar,
  precio_total numeric,
  tipo_intencion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  nuevo_pedido_id integer;
  numero_pedido_generado varchar(50);
  item_record jsonb;
  precio_total_calculado numeric(10, 2) := 0;
  v_intencion text;
  v_obs text;
BEGIN
  v_intencion := COALESCE(NULLIF(trim(p_tipo_intencion), ''), 'compra');
  IF v_intencion NOT IN ('compra', 'cotizacion') THEN
    RAISE EXCEPTION 'tipo_intencion inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = p_id_cliente AND c.es_cliente_web = true AND c.activo = true
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado o inactivo';
  END IF;

  v_obs := p_observaciones_cliente;
  IF v_intencion = 'cotizacion' AND v_obs IS NOT NULL AND v_obs NOT ILIKE '%cotización%' THEN
    v_obs := '[Solicitud de cotización] ' || v_obs;
  ELSIF v_intencion = 'cotizacion' AND v_obs IS NULL THEN
    v_obs := '[Solicitud de cotización]';
  END IF;

  numero_pedido_generado := public.generar_numero_pedido_cliente();

  INSERT INTO public.pedidos_clientes (
    id_cliente,
    numero_pedido,
    fecha_limite_deseada,
    observaciones_cliente,
    tipo_intencion,
    es_urgente,
    requiere_delivery,
    direccion_delivery,
    tipo_producto_servicio,
    tipo_producto_otro,
    necesita_asesoramiento,
    donde_colocados,
    digital_o_impresion,
    cantidades,
    objetivo_proyecto,
    material_logo,
    material_textos,
    material_imagenes,
    tiene_referencias,
    referencias_links,
    brief_publico,
    estilo_diseno,
    referencias
  ) VALUES (
    p_id_cliente,
    numero_pedido_generado,
    p_fecha_limite_deseada,
    v_obs,
    v_intencion,
    p_es_urgente,
    p_requiere_delivery,
    p_direccion_delivery,
    p_tipo_producto_servicio,
    p_tipo_producto_otro,
    p_necesita_asesoramiento,
    p_donde_colocados,
    p_digital_o_impresion,
    p_cantidades,
    p_objetivo_proyecto,
    p_material_logo,
    p_material_textos,
    p_material_imagenes,
    p_tiene_referencias,
    p_referencias_links,
    p_brief_publico,
    p_estilo_diseno,
    p_referencias
  )
  RETURNING pedidos_clientes.id INTO nuevo_pedido_id;

  FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.pedidos_clientes_items (
      id_pedido,
      id_articulo,
      cantidad,
      precio_unitario,
      precio_total,
      descripcion_personalizada
    ) VALUES (
      nuevo_pedido_id,
      (item_record->>'id_articulo')::integer,
      COALESCE((item_record->>'cantidad')::integer, 1),
      (item_record->>'precio_unitario')::numeric,
      (item_record->>'precio_total')::numeric,
      item_record->>'descripcion_personalizada'
    );

    precio_total_calculado := precio_total_calculado + ((item_record->>'precio_total')::numeric);
  END LOOP;

  UPDATE public.pedidos_clientes pc
  SET precio_total = precio_total_calculado
  WHERE pc.id = nuevo_pedido_id;

  RETURN QUERY
  SELECT
    p.id,
    p.numero_pedido,
    p.estado,
    p.precio_total,
    p.tipo_intencion
  FROM public.pedidos_clientes p
  WHERE p.id = nuevo_pedido_id;
END;
$$;
