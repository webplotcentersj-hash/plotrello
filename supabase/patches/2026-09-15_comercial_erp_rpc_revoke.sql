-- Paso 22 seguridad (comercial ERP): RPC + actor + REVOKE DML
-- en pagos_cobros, cuentas_por_cobrar, facturas_venta, facturas_items.
-- Reusa actor_puede_escribir_comercial (Paso 21).

ALTER TABLE public.facturas_venta
  ADD COLUMN IF NOT EXISTS id_factura_referencia integer;

CREATE OR REPLACE FUNCTION public.comercial_upsert(
  p_actor_id integer,
  p_kind text,
  p_row jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_out jsonb;
  v_item jsonb;
  v_items jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL OR NULLIF(btrim(p_kind), '') IS NULL
     OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para escribir comercial (% )', COALESCE(p_kind, '?');
  END IF;

  IF p_kind = 'pago_cobro' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      INSERT INTO public.pagos_cobros (
        tipo, id_cuenta_por_cobrar, id_cuenta_por_pagar, monto, fecha_pago,
        metodo_pago, numero_comprobante, id_cuenta_bancaria, observaciones, id_usuario
      ) VALUES (
        COALESCE(NULLIF(p_row->>'tipo', ''), 'Cobro'),
        NULLIF(p_row->>'id_cuenta_por_cobrar', '')::integer,
        NULLIF(p_row->>'id_cuenta_por_pagar', '')::integer,
        COALESCE(NULLIF(p_row->>'monto', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'fecha_pago', '')::date, CURRENT_DATE),
        NULLIF(p_row->>'metodo_pago', ''),
        NULLIF(p_row->>'numero_comprobante', ''),
        NULLIF(p_row->>'id_cuenta_bancaria', '')::integer,
        NULLIF(p_row->>'observaciones', ''),
        COALESCE(NULLIF(p_row->>'id_usuario', '')::integer, p_actor_id)
      )
      RETURNING to_jsonb(pagos_cobros.*) INTO v_out;
      RETURN v_out;
    END IF;
    UPDATE public.pagos_cobros AS t SET
      monto = CASE WHEN p_row ? 'monto' THEN NULLIF(p_row->>'monto', '')::numeric ELSE t.monto END,
      fecha_pago = CASE WHEN p_row ? 'fecha_pago' THEN NULLIF(p_row->>'fecha_pago', '')::date ELSE t.fecha_pago END,
      metodo_pago = CASE WHEN p_row ? 'metodo_pago' THEN NULLIF(p_row->>'metodo_pago', '') ELSE t.metodo_pago END,
      numero_comprobante = CASE WHEN p_row ? 'numero_comprobante' THEN NULLIF(p_row->>'numero_comprobante', '') ELSE t.numero_comprobante END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      id_cuenta_bancaria = CASE WHEN p_row ? 'id_cuenta_bancaria' THEN NULLIF(p_row->>'id_cuenta_bancaria', '')::integer ELSE t.id_cuenta_bancaria END
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    IF v_out IS NULL THEN RAISE EXCEPTION 'pago_cobro % no encontrado', v_id; END IF;
    RETURN v_out;
  END IF;

  IF p_kind = 'cxc' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      INSERT INTO public.cuentas_por_cobrar (
        id_factura, id_cliente, cliente_nombre, monto_total, monto_pagado, monto_pendiente,
        fecha_emision, fecha_vencimiento, estado, observaciones
      ) VALUES (
        NULLIF(p_row->>'id_factura', '')::integer,
        NULLIF(p_row->>'id_cliente', '')::integer,
        NULLIF(p_row->>'cliente_nombre', ''),
        COALESCE(NULLIF(p_row->>'monto_total', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'monto_pagado', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'monto_pendiente', '')::numeric, 0),
        NULLIF(p_row->>'fecha_emision', '')::date,
        NULLIF(p_row->>'fecha_vencimiento', '')::date,
        COALESCE(NULLIF(p_row->>'estado', ''), 'Pendiente'),
        NULLIF(p_row->>'observaciones', '')
      )
      RETURNING to_jsonb(cuentas_por_cobrar.*) INTO v_out;
      RETURN v_out;
    END IF;
    UPDATE public.cuentas_por_cobrar AS t SET
      monto_pagado = CASE WHEN p_row ? 'monto_pagado' THEN NULLIF(p_row->>'monto_pagado', '')::numeric ELSE t.monto_pagado END,
      monto_pendiente = CASE WHEN p_row ? 'monto_pendiente' THEN NULLIF(p_row->>'monto_pendiente', '')::numeric ELSE t.monto_pendiente END,
      monto_total = CASE WHEN p_row ? 'monto_total' THEN NULLIF(p_row->>'monto_total', '')::numeric ELSE t.monto_total END,
      estado = CASE WHEN p_row ? 'estado' THEN NULLIF(p_row->>'estado', '') ELSE t.estado END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      updated_at = COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    IF v_out IS NULL THEN RAISE EXCEPTION 'cxc % no encontrado', v_id; END IF;
    RETURN v_out;
  END IF;

  IF p_kind = 'factura' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      INSERT INTO public.facturas_venta (
        numero_factura, punto_venta, numero_comprobante, tipo_comprobante,
        fecha_emision, fecha_vencimiento, id_cliente, cliente_nombre, cliente_dni_cuit,
        cliente_direccion, cliente_condicion_iva, id_op, numero_op, id_venta,
        id_factura_referencia, subtotal, descuento, iva, total, estado, estado_afip,
        observaciones, id_usuario
      ) VALUES (
        COALESCE(NULLIF(p_row->>'numero_factura', ''), 'TMP'),
        COALESCE(NULLIF(p_row->>'punto_venta', '')::integer, 1),
        COALESCE(NULLIF(p_row->>'numero_comprobante', '')::integer, 0),
        COALESCE(NULLIF(p_row->>'tipo_comprobante', ''), 'Factura B'),
        COALESCE(NULLIF(p_row->>'fecha_emision', '')::date, CURRENT_DATE),
        NULLIF(p_row->>'fecha_vencimiento', '')::date,
        NULLIF(p_row->>'id_cliente', '')::integer,
        NULLIF(p_row->>'cliente_nombre', ''),
        NULLIF(p_row->>'cliente_dni_cuit', ''),
        NULLIF(p_row->>'cliente_direccion', ''),
        NULLIF(p_row->>'cliente_condicion_iva', ''),
        NULLIF(p_row->>'id_op', '')::integer,
        NULLIF(p_row->>'numero_op', ''),
        NULLIF(p_row->>'id_venta', '')::integer,
        NULLIF(p_row->>'id_factura_referencia', '')::integer,
        COALESCE(NULLIF(p_row->>'subtotal', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'descuento', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'iva', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'total', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'estado', ''), 'Borrador'),
        COALESCE(NULLIF(p_row->>'estado_afip', ''), 'Pendiente'),
        NULLIF(p_row->>'observaciones', ''),
        COALESCE(NULLIF(p_row->>'id_usuario', '')::integer, p_actor_id)
      )
      RETURNING to_jsonb(facturas_venta.*) INTO v_out;
      RETURN v_out;
    END IF;
    UPDATE public.facturas_venta AS t SET
      estado = CASE WHEN p_row ? 'estado' THEN NULLIF(p_row->>'estado', '') ELSE t.estado END,
      estado_afip = CASE WHEN p_row ? 'estado_afip' THEN NULLIF(p_row->>'estado_afip', '') ELSE t.estado_afip END,
      cae = CASE WHEN p_row ? 'cae' THEN NULLIF(p_row->>'cae', '') ELSE t.cae END,
      fecha_vencimiento_cae = CASE WHEN p_row ? 'fecha_vencimiento_cae' THEN NULLIF(p_row->>'fecha_vencimiento_cae', '')::date ELSE t.fecha_vencimiento_cae END,
      numero_cae = CASE WHEN p_row ? 'numero_cae' THEN NULLIF(p_row->>'numero_cae', '') ELSE t.numero_cae END,
      resultado_afip = CASE WHEN p_row ? 'resultado_afip' THEN NULLIF(p_row->>'resultado_afip', '') ELSE t.resultado_afip END,
      codigo_resultado_afip = CASE WHEN p_row ? 'codigo_resultado_afip' THEN NULLIF(p_row->>'codigo_resultado_afip', '') ELSE t.codigo_resultado_afip END,
      fecha_autorizacion_afip = CASE WHEN p_row ? 'fecha_autorizacion_afip' THEN NULLIF(p_row->>'fecha_autorizacion_afip', '')::timestamptz ELSE t.fecha_autorizacion_afip END,
      id_asiento_contable = CASE WHEN p_row ? 'id_asiento_contable' THEN NULLIF(p_row->>'id_asiento_contable', '')::integer ELSE t.id_asiento_contable END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      fecha_emision = CASE WHEN p_row ? 'fecha_emision' THEN NULLIF(p_row->>'fecha_emision', '')::date ELSE t.fecha_emision END,
      fecha_vencimiento = CASE WHEN p_row ? 'fecha_vencimiento' THEN NULLIF(p_row->>'fecha_vencimiento', '')::date ELSE t.fecha_vencimiento END,
      subtotal = CASE WHEN p_row ? 'subtotal' THEN NULLIF(p_row->>'subtotal', '')::numeric ELSE t.subtotal END,
      descuento = CASE WHEN p_row ? 'descuento' THEN NULLIF(p_row->>'descuento', '')::numeric ELSE t.descuento END,
      iva = CASE WHEN p_row ? 'iva' THEN NULLIF(p_row->>'iva', '')::numeric ELSE t.iva END,
      total = CASE WHEN p_row ? 'total' THEN NULLIF(p_row->>'total', '')::numeric ELSE t.total END,
      updated_at = COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    IF v_out IS NULL THEN RAISE EXCEPTION 'factura % no encontrada', v_id; END IF;
    RETURN v_out;
  END IF;

  IF p_kind = 'factura_item' THEN
    INSERT INTO public.facturas_items (
      id_factura, item_numero, descripcion, cantidad, unidad_medida,
      precio_unitario, descuento, iva_porcentaje, iva_monto, subtotal, total, id_articulo
    ) VALUES (
      (p_row->>'id_factura')::integer,
      COALESCE(NULLIF(p_row->>'item_numero', '')::integer, 1),
      COALESCE(NULLIF(p_row->>'descripcion', ''), ''),
      COALESCE(NULLIF(p_row->>'cantidad', '')::numeric, 1),
      COALESCE(NULLIF(p_row->>'unidad_medida', ''), 'UN'),
      COALESCE(NULLIF(p_row->>'precio_unitario', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'descuento', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'iva_porcentaje', '')::numeric, 21),
      COALESCE(NULLIF(p_row->>'iva_monto', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'subtotal', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'total', '')::numeric, 0),
      NULLIF(p_row->>'id_articulo', '')::integer
    )
    RETURNING to_jsonb(facturas_items.*) INTO v_out;
    RETURN v_out;
  END IF;

  IF p_kind = 'factura_items' THEN
    v_items := COALESCE(p_row->'items', '[]'::jsonb);
    IF jsonb_typeof(v_items) <> 'array' THEN
      RAISE EXCEPTION 'factura_items requiere p_row.items array';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
    LOOP
      INSERT INTO public.facturas_items (
        id_factura, item_numero, descripcion, cantidad, unidad_medida,
        precio_unitario, descuento, iva_porcentaje, iva_monto, subtotal, total, id_articulo
      ) VALUES (
        COALESCE(NULLIF(v_item->>'id_factura', '')::integer, NULLIF(p_row->>'id_factura', '')::integer),
        COALESCE(NULLIF(v_item->>'item_numero', '')::integer, 1),
        COALESCE(NULLIF(v_item->>'descripcion', ''), ''),
        COALESCE(NULLIF(v_item->>'cantidad', '')::numeric, 1),
        COALESCE(NULLIF(v_item->>'unidad_medida', ''), 'UN'),
        COALESCE(NULLIF(v_item->>'precio_unitario', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'descuento', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'iva_porcentaje', '')::numeric, 21),
        COALESCE(NULLIF(v_item->>'iva_monto', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'subtotal', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'total', '')::numeric, 0),
        NULLIF(v_item->>'id_articulo', '')::integer
      );
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_items));
  END IF;

  RAISE EXCEPTION 'comercial_upsert kind desconocido: %', p_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.comercial_upsert(integer, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.comercial_delete(
  p_actor_id integer,
  p_kind text,
  p_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR p_id IS NULL OR NULLIF(btrim(p_kind), '') IS NULL
     OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para borrar comercial (% )', COALESCE(p_kind, '?');
  END IF;

  IF p_kind = 'factura' THEN
    DELETE FROM public.facturas_items WHERE id_factura = p_id;
    DELETE FROM public.facturas_venta WHERE id = p_id;
    RETURN;
  END IF;

  IF p_kind = 'pago_cobro' THEN
    DELETE FROM public.pagos_cobros WHERE id = p_id;
    RETURN;
  END IF;

  IF p_kind = 'cxc' THEN
    DELETE FROM public.cuentas_por_cobrar WHERE id = p_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'comercial_delete kind desconocido: %', p_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.comercial_delete(integer, text, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.comercial_upsert(integer, text, jsonb) IS
  'Paso 22: upsert pago_cobro|cxc|factura|factura_item(s) con actor activo.';
COMMENT ON FUNCTION public.comercial_delete(integer, text, integer) IS
  'Paso 22: delete factura|pago_cobro|cxc con actor activo.';

-- Policies: solo SELECT (reemplaza ALL USING true)
DROP POLICY IF EXISTS erp_pagos_cobros_all ON public.pagos_cobros;
DROP POLICY IF EXISTS erp_cxc_all ON public.cuentas_por_cobrar;
DROP POLICY IF EXISTS erp_facturas_venta_all ON public.facturas_venta;
DROP POLICY IF EXISTS erp_facturas_items_all ON public.facturas_items;

CREATE POLICY pagos_cobros_select_anon ON public.pagos_cobros
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY cxc_select_anon ON public.cuentas_por_cobrar
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY facturas_venta_select_anon ON public.facturas_venta
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY facturas_items_select_anon ON public.facturas_items
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.pagos_cobros FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.cuentas_por_cobrar FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.facturas_venta FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.facturas_items FROM anon, authenticated;

GRANT SELECT ON TABLE public.pagos_cobros TO anon, authenticated;
GRANT SELECT ON TABLE public.cuentas_por_cobrar TO anon, authenticated;
GRANT SELECT ON TABLE public.facturas_venta TO anon, authenticated;
GRANT SELECT ON TABLE public.facturas_items TO anon, authenticated;

COMMENT ON TABLE public.pagos_cobros IS
  'Paso 22: anon solo SELECT. Escrituras vía comercial_upsert(pago_cobro).';
COMMENT ON TABLE public.cuentas_por_cobrar IS
  'Paso 22: anon solo SELECT. Escrituras vía comercial_upsert(cxc).';
COMMENT ON TABLE public.facturas_venta IS
  'Paso 22: anon solo SELECT. Escrituras vía comercial_upsert(factura).';
COMMENT ON TABLE public.facturas_items IS
  'Paso 22: anon solo SELECT. Escrituras vía comercial_upsert(factura_item/s).';
