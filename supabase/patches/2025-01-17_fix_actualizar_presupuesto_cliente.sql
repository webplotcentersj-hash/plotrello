-- ============================================
-- FIX: Corregir ambigüedad en función actualizar_presupuesto_cliente
-- ============================================

BEGIN;

-- Recrear la función con referencias explícitas en el UPDATE
CREATE OR REPLACE FUNCTION public.actualizar_presupuesto_cliente(
  p_id_presupuesto integer,
  p_items jsonb DEFAULT NULL,
  p_fecha_vencimiento date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_estado varchar(50) DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  numero_presupuesto varchar,
  estado varchar,
  precio_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_record jsonb;
  precio_total_calculado numeric(10,2);
  presupuesto_existe boolean;
  estado_actual varchar(50);
BEGIN
  -- Verificar que el presupuesto existe y obtener su estado actual
  SELECT EXISTS(SELECT 1 FROM public.presupuestos_clientes WHERE presupuestos_clientes.id = p_id_presupuesto),
         (SELECT estado FROM public.presupuestos_clientes WHERE presupuestos_clientes.id = p_id_presupuesto)
  INTO presupuesto_existe, estado_actual;
  
  IF NOT presupuesto_existe THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  -- Si se proporcionan items, actualizar items
  IF p_items IS NOT NULL THEN
    -- Eliminar items existentes
    DELETE FROM public.presupuestos_clientes_items WHERE id_presupuesto = p_id_presupuesto;
    
    -- Insertar nuevos items
    precio_total_calculado := 0;
    FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.presupuestos_clientes_items (
        id_presupuesto,
        id_articulo,
        cantidad,
        precio_unitario,
        precio_total,
        descripcion_personalizada
      ) VALUES (
        p_id_presupuesto,
        (item_record->>'id_articulo')::integer,
        COALESCE((item_record->>'cantidad')::integer, 1),
        (item_record->>'precio_unitario')::numeric,
        (item_record->>'precio_total')::numeric,
        item_record->>'descripcion_personalizada'
      );

      precio_total_calculado := precio_total_calculado + ((item_record->>'precio_total')::numeric);
    END LOOP;
  ELSE
    -- Calcular precio total de items existentes
    SELECT COALESCE(SUM(precio_total), 0)
    INTO precio_total_calculado
    FROM public.presupuestos_clientes_items
    WHERE id_presupuesto = p_id_presupuesto;
  END IF;

  -- Actualizar presupuesto con referencias explícitas
  UPDATE public.presupuestos_clientes
  SET
    fecha_vencimiento = COALESCE(p_fecha_vencimiento, presupuestos_clientes.fecha_vencimiento),
    observaciones_cliente = COALESCE(p_observaciones_cliente, presupuestos_clientes.observaciones_cliente),
    precio_total = precio_total_calculado,
    estado = COALESCE(p_estado, presupuestos_clientes.estado),
    fecha_envio = CASE 
      WHEN p_estado = 'enviado' AND estado_actual != 'enviado' THEN NOW()
      WHEN p_estado != 'enviado' THEN presupuestos_clientes.fecha_envio
      ELSE presupuestos_clientes.fecha_envio
    END,
    fecha_respuesta = CASE 
      WHEN p_estado IN ('aceptado', 'rechazado') AND estado_actual NOT IN ('aceptado', 'rechazado') THEN NOW()
      ELSE presupuestos_clientes.fecha_respuesta
    END,
    updated_at = NOW()
  WHERE presupuestos_clientes.id = p_id_presupuesto;

  RETURN QUERY
  SELECT p.id, p.numero_presupuesto, p.estado, p.precio_total
  FROM public.presupuestos_clientes p
  WHERE p.id = p_id_presupuesto;
END;
$$;

COMMIT;

