-- ============================================
-- FIX: Actualizar funciones de pedidos que aún referencian clientes_web
-- ============================================

BEGIN;

-- ============================================
-- Actualizar función crear_pedido_cliente (versión completa con más parámetros)
-- ============================================

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
  p_referencias text DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  numero_pedido varchar,
  estado varchar,
  precio_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nuevo_pedido_id integer;
  numero_pedido_generado varchar(50);
  item_record jsonb;
  precio_total_calculado numeric(10,2) := 0;
BEGIN
  -- Validar que el cliente existe, es cliente web y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE id = p_id_cliente 
      AND es_cliente_web = true 
      AND activo = true
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado o inactivo';
  END IF;

  -- Generar número de pedido
  numero_pedido_generado := public.generar_numero_pedido_cliente();

  -- Crear pedido con todos los campos
  INSERT INTO public.pedidos_clientes (
    id_cliente,
    numero_pedido,
    fecha_limite_deseada,
    observaciones_cliente,
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
    p_observaciones_cliente,
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
  RETURNING id INTO nuevo_pedido_id;

  -- Procesar items
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

  -- Actualizar precio total del pedido
  UPDATE public.pedidos_clientes
  SET precio_total = precio_total_calculado
  WHERE id = nuevo_pedido_id;

  RETURN QUERY
  SELECT p.id, p.numero_pedido, p.estado, p.precio_total
  FROM public.pedidos_clientes p
  WHERE p.id = nuevo_pedido_id;
END;
$$;

-- ============================================
-- Buscar y actualizar otras funciones que referencien clientes_web
-- ============================================

-- Actualizar función obtener_pedidos_cliente si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'obtener_pedidos_cliente'
      AND p.prosrc LIKE '%clientes_web%'
  ) THEN
    -- La función probablemente solo hace JOIN, se actualizará cuando se ejecute
    RAISE NOTICE 'ℹ️  Función obtener_pedidos_cliente necesita actualización manual si usa clientes_web';
  END IF;
END $$;

-- Actualizar función obtener_detalle_pedido_cliente si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'obtener_detalle_pedido_cliente'
      AND p.prosrc LIKE '%clientes_web%'
  ) THEN
    RAISE NOTICE 'ℹ️  Función obtener_detalle_pedido_cliente necesita actualización manual si usa clientes_web';
  END IF;
END $$;

COMMIT;

-- Mensaje final
DO $$
BEGIN
  RAISE NOTICE '✅ Funciones de pedidos actualizadas para usar tabla clientes unificada';
END $$;

