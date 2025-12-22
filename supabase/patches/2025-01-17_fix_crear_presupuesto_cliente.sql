-- ============================================
-- FIX: Corregir ambigüedad en función crear_presupuesto_cliente
-- ============================================

BEGIN;

-- Recrear la función con referencias explícitas
CREATE OR REPLACE FUNCTION public.crear_presupuesto_cliente(
  p_id_cliente integer,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_fecha_vencimiento date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_estado varchar(50) DEFAULT 'borrador'
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
  nuevo_presupuesto_id integer;
  numero_presupuesto_generado varchar(50);
  item_record jsonb;
  precio_total_calculado numeric(10,2) := 0;
BEGIN
  -- Validar que el cliente existe, es cliente web y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = p_id_cliente 
      AND clientes.es_cliente_web = true 
      AND clientes.activo = true
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado o inactivo';
  END IF;

  -- Validar estado
  IF p_estado NOT IN ('borrador', 'enviado', 'aceptado', 'rechazado', 'cancelado', 'convertido') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  -- Generar número de presupuesto
  numero_presupuesto_generado := public.generar_numero_presupuesto_cliente();

  -- Crear presupuesto
  INSERT INTO public.presupuestos_clientes (
    id_cliente,
    numero_presupuesto,
    estado,
    fecha_vencimiento,
    observaciones_cliente,
    fecha_envio
  ) VALUES (
    p_id_cliente,
    numero_presupuesto_generado,
    p_estado,
    p_fecha_vencimiento,
    p_observaciones_cliente,
    CASE WHEN p_estado = 'enviado' THEN NOW() ELSE NULL END
  )
  RETURNING presupuestos_clientes.id INTO nuevo_presupuesto_id;

  -- Procesar items
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
      nuevo_presupuesto_id,
      (item_record->>'id_articulo')::integer,
      COALESCE((item_record->>'cantidad')::integer, 1),
      (item_record->>'precio_unitario')::numeric,
      (item_record->>'precio_total')::numeric,
      item_record->>'descripcion_personalizada'
    );

    precio_total_calculado := precio_total_calculado + ((item_record->>'precio_total')::numeric);
  END LOOP;

  -- Actualizar precio total del presupuesto con referencia explícita
  UPDATE public.presupuestos_clientes
  SET precio_total = precio_total_calculado
  WHERE presupuestos_clientes.id = nuevo_presupuesto_id;

  RETURN QUERY
  SELECT p.id, p.numero_presupuesto, p.estado, p.precio_total
  FROM public.presupuestos_clientes p
  WHERE p.id = nuevo_presupuesto_id;
END;
$$;

COMMIT;

