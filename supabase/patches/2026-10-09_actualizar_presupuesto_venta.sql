-- Edición completa de presupuestos presenciales + traza en presupuestos_ventas_auditoria.

CREATE OR REPLACE FUNCTION public.actualizar_presupuesto_venta(
  p_id_presupuesto integer,
  p_actor_id integer DEFAULT NULL,
  p_actor_nombre text DEFAULT NULL,
  p_cliente_nombre text DEFAULT NULL,
  p_cliente_telefono text DEFAULT NULL,
  p_cliente_email text DEFAULT NULL,
  p_cliente_dni_cuit text DEFAULT NULL,
  p_cliente_empresa text DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_fecha_vencimiento date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_observaciones_internas text DEFAULT NULL,
  p_tipo_lista_precio text DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev presupuestos_ventas%ROWTYPE;
  v_items_prev jsonb;
  v_item jsonb;
  v_id integer;
  v_keep integer[] := ARRAY[]::integer[];
  v_cant numeric;
  v_unit numeric;
  v_desc numeric;
  v_line numeric;
  v_total numeric := 0;
  v_new_id integer;
  v_lista text;
BEGIN
  SELECT * INTO v_prev
  FROM public.presupuestos_ventas
  WHERE id = p_id_presupuesto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id), '[]'::jsonb)
  INTO v_items_prev
  FROM public.presupuestos_ventas_items i
  WHERE i.id_presupuesto = p_id_presupuesto;

  v_lista := NULLIF(btrim(COALESCE(p_tipo_lista_precio, '')), '');
  IF v_lista IS NOT NULL AND v_lista NOT IN ('lista_1', 'lista_2') THEN
    v_lista := v_prev.tipo_lista_precio;
  END IF;

  UPDATE public.presupuestos_ventas
  SET
    cliente_nombre = COALESCE(NULLIF(btrim(COALESCE(p_cliente_nombre, '')), ''), cliente_nombre),
    cliente_telefono = NULLIF(btrim(COALESCE(p_cliente_telefono, '')), ''),
    cliente_email = NULLIF(btrim(COALESCE(p_cliente_email, '')), ''),
    cliente_dni_cuit = NULLIF(btrim(COALESCE(p_cliente_dni_cuit, '')), ''),
    cliente_empresa = NULLIF(btrim(COALESCE(p_cliente_empresa, '')), ''),
    cliente_direccion = NULLIF(btrim(COALESCE(p_cliente_direccion, '')), ''),
    fecha_vencimiento = p_fecha_vencimiento,
    observaciones_cliente = NULLIF(btrim(COALESCE(p_observaciones_cliente, '')), ''),
    observaciones_internas = COALESCE(p_observaciones_internas, observaciones_internas),
    tipo_lista_precio = COALESCE(v_lista, tipo_lista_precio),
    updated_at = now()
  WHERE id = p_id_presupuesto;

  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      v_id := NULLIF(v_item->>'id', '')::integer;
      v_cant := COALESCE(NULLIF(replace(v_item->>'cantidad', ',', '.'), '')::numeric, 0);
      v_unit := COALESCE(NULLIF(replace(v_item->>'precio_unitario', ',', '.'), '')::numeric, 0);
      v_desc := COALESCE(NULLIF(replace(v_item->>'descuento', ',', '.'), '')::numeric, 0);
      IF v_cant < 0 THEN v_cant := 0; END IF;
      IF v_unit < 0 THEN v_unit := 0; END IF;
      IF v_desc < 0 THEN v_desc := 0; END IF;
      v_line := GREATEST(round(v_cant * v_unit - v_desc, 2), 0);
      v_total := v_total + v_line;

      IF v_id IS NOT NULL AND v_id > 0 AND EXISTS (
        SELECT 1 FROM public.presupuestos_ventas_items
        WHERE id = v_id AND id_presupuesto = p_id_presupuesto
      ) THEN
        UPDATE public.presupuestos_ventas_items
        SET
          descripcion = COALESCE(NULLIF(btrim(COALESCE(v_item->>'descripcion', '')), ''), descripcion),
          cantidad = v_cant,
          precio_unitario = v_unit,
          descuento = v_desc,
          precio_total = v_line,
          codigo_articulo = NULLIF(btrim(COALESCE(v_item->>'codigo_articulo', '')), ''),
          observaciones = NULLIF(btrim(COALESCE(v_item->>'observaciones', '')), '')
        WHERE id = v_id;
        v_keep := array_append(v_keep, v_id);
      ELSE
        INSERT INTO public.presupuestos_ventas_items (
          id_presupuesto, descripcion, cantidad, precio_unitario, descuento, precio_total,
          codigo_articulo, id_articulo_stock, observaciones
        ) VALUES (
          p_id_presupuesto,
          COALESCE(NULLIF(btrim(COALESCE(v_item->>'descripcion', '')), ''), 'Ítem'),
          v_cant,
          v_unit,
          v_desc,
          v_line,
          NULLIF(btrim(COALESCE(v_item->>'codigo_articulo', '')), ''),
          NULLIF(v_item->>'id_articulo_stock', '')::integer,
          NULLIF(btrim(COALESCE(v_item->>'observaciones', '')), '')
        )
        RETURNING id INTO v_new_id;
        v_keep := array_append(v_keep, v_new_id);
      END IF;
    END LOOP;

    DELETE FROM public.presupuestos_ventas_items
    WHERE id_presupuesto = p_id_presupuesto
      AND (cardinality(v_keep) = 0 OR NOT (id = ANY (v_keep)));

    UPDATE public.presupuestos_ventas
    SET precio_total = v_total, updated_at = now()
    WHERE id = p_id_presupuesto;
  END IF;

  INSERT INTO public.presupuestos_ventas_auditoria (
    id_presupuesto, accion, actor_id, actor_nombre, detalle
  ) VALUES (
    p_id_presupuesto,
    'editar',
    p_actor_id,
    NULLIF(btrim(COALESCE(p_actor_nombre, '')), ''),
    jsonb_build_object(
      'antes', jsonb_build_object(
        'cliente_nombre', v_prev.cliente_nombre,
        'precio_total', v_prev.precio_total,
        'items', v_items_prev
      ),
      'precio_total_nuevo', (SELECT precio_total FROM public.presupuestos_ventas WHERE id = p_id_presupuesto)
    )
  );

  RETURN jsonb_build_object(
    'id', p_id_presupuesto,
    'precio_total', (SELECT precio_total FROM public.presupuestos_ventas WHERE id = p_id_presupuesto)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_presupuesto_venta(
  integer, integer, text, text, text, text, text, text, text, date, text, text, text, jsonb
) TO anon, authenticated;
