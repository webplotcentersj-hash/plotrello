-- Venta e ítems en una sola operación (atómica).
--
-- Antes: mostrador creaba la venta con el total y después agregaba los ítems de a uno.
-- Si un ítem fallaba a mitad, quedaba una venta guardada con MENOS total del que se cobró
-- (cada ítem recalcula valor_total como suma de ítems). Ahora, o se guarda todo, o nada.
--
-- Regla: si la venta tiene ítems, valor_total es la suma de los ítems.
-- Si no tiene, vale el total cargado a mano (venta por monto).
--
-- Requiere el Paso 25 (2026-09-22_paso25_ventas_rpcs_actor.sql). Idempotente.

BEGIN;

CREATE OR REPLACE FUNCTION public.ventas_crear_con_items(
  p_actor_id integer,
  p_venta jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res json;
  v_id integer;
  v_numero varchar(50);
  v_item jsonb;
  v_items_out json;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para crear ventas';
  END IF;
  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un array';
  END IF;

  v_res := public.crear_venta_directa(
    p_cliente_nombre => COALESCE(NULLIF(p_venta->>'cliente_nombre', ''), 'Cliente'),
    p_valor_total => COALESCE(NULLIF(p_venta->>'valor_total', '')::numeric, 0),
    p_id_vendedor => NULLIF(p_venta->>'id_vendedor', '')::integer,
    p_nombre_vendedor => NULLIF(p_venta->>'nombre_vendedor', ''),
    p_cliente_telefono => NULLIF(p_venta->>'cliente_telefono', ''),
    p_cliente_email => NULLIF(p_venta->>'cliente_email', ''),
    p_cliente_dni_cuit => NULLIF(p_venta->>'cliente_dni_cuit', ''),
    p_cliente_empresa => NULLIF(p_venta->>'cliente_empresa', ''),
    p_cliente_direccion => NULLIF(p_venta->>'cliente_direccion', ''),
    p_metodo_pago => NULLIF(p_venta->>'metodo_pago', ''),
    p_estado_pago => COALESCE(NULLIF(p_venta->>'estado_pago', ''), 'Pendiente'),
    p_fecha_venta => COALESCE(NULLIF(p_venta->>'fecha_venta', '')::date, CURRENT_DATE),
    p_observaciones => NULLIF(p_venta->>'observaciones', ''),
    p_id_cliente => NULLIF(p_venta->>'id_cliente', '')::integer
  );

  v_id := NULLIF(v_res->'data'->>'id', '')::integer;
  IF v_id IS NULL THEN
    -- La función original ya explica el error; se devuelve tal cual
    RETURN v_res;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.ventas_items (
      id_venta, id_articulo_stock, codigo_articulo, descripcion,
      cantidad, precio_unitario, precio_total, descuento, observaciones
    ) VALUES (
      v_id,
      NULLIF(v_item->>'id_articulo_stock', '')::integer,
      NULLIF(v_item->>'codigo_articulo', ''),
      COALESCE(NULLIF(v_item->>'descripcion', ''), 'Ítem'),
      COALESCE(NULLIF(v_item->>'cantidad', '')::numeric, 1),
      COALESCE(NULLIF(v_item->>'precio_unitario', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'cantidad', '')::numeric, 1) * COALESCE(NULLIF(v_item->>'precio_unitario', '')::numeric, 0)
        - COALESCE(NULLIF(v_item->>'descuento', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'descuento', '')::numeric, 0),
      NULLIF(v_item->>'observaciones', '')
    );
  END LOOP;

  -- Con ítems, el total es la suma de los ítems
  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) > 0 THEN
    UPDATE public.ventas v
    SET valor_total = (SELECT COALESCE(SUM(vi.precio_total), 0) FROM public.ventas_items vi WHERE vi.id_venta = v_id),
        updated_at = now()
    WHERE v.id = v_id;
  END IF;

  SELECT v.numero_venta INTO v_numero FROM public.ventas v WHERE v.id = v_id;

  -- Los ids de los ítems se devuelven para descontar stock sin duplicar
  SELECT COALESCE(json_agg(json_build_object(
           'id', vi.id,
           'id_articulo_stock', vi.id_articulo_stock,
           'cantidad', vi.cantidad
         ) ORDER BY vi.id), '[]'::json)
  INTO v_items_out
  FROM public.ventas_items vi
  WHERE vi.id_venta = v_id;

  RETURN json_build_object(
    'success', true,
    'data', json_build_object('id', v_id, 'numero_venta', v_numero, 'items', v_items_out)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ventas_crear_con_items(integer, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ventas_crear_con_items(integer, jsonb, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.ventas_crear_con_items(integer, jsonb, jsonb) IS
  'Crea la venta con sus ítems en una transacción. Con ítems, valor_total = suma de ítems.';

COMMIT;
