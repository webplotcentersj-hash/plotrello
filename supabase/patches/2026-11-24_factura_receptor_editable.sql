-- 2026-11-24 — Corregir receptor (condición IVA / CUIT / nombre / dirección) de facturas en borrador.
--
-- Problema: comercial_upsert(factura) en UPDATE ignoraba cliente_condicion_iva, cliente_dni_cuit,
-- cliente_nombre, cliente_direccion, id_cliente y tipo_comprobante. "Guardar condición IVA / CUIT"
-- en /erp/facturas/:id y el reuso de borradores al facturar desde una venta no guardaban nada, así
-- que ARCA/validación seguía rechazando ("El comprobante A solo se emite a Responsables Inscriptos…").
--
-- Ahora esos campos se pueden editar mientras la factura está en Borrador (sin CAE).
-- Al final, rellena la condición IVA vacía de borradores tomándola de la ficha del cliente.

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
  v_estado text;
  v_id_factura integer;
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
      -- Siempre nace como borrador: la emisión la hace el servidor al autorizar en AFIP
      INSERT INTO public.facturas_venta (
        numero_factura, punto_venta, numero_comprobante, tipo_comprobante,
        fecha_emision, fecha_vencimiento, id_cliente, cliente_nombre, cliente_dni_cuit,
        cliente_direccion, cliente_condicion_iva, id_op, numero_op, id_venta,
        id_factura_referencia, subtotal, descuento, iva, total, estado, estado_afip,
        observaciones, id_usuario, concepto, fecha_servicio_desde, fecha_servicio_hasta
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
        'Borrador',
        'Pendiente',
        NULLIF(p_row->>'observaciones', ''),
        COALESCE(NULLIF(p_row->>'id_usuario', '')::integer, p_actor_id),
        COALESCE(NULLIF(p_row->>'concepto', '')::smallint, 1),
        NULLIF(p_row->>'fecha_servicio_desde', '')::date,
        NULLIF(p_row->>'fecha_servicio_hasta', '')::date
      )
      RETURNING to_jsonb(facturas_venta.*) INTO v_out;
      RETURN v_out;
    END IF;

    SELECT estado INTO v_estado FROM public.facturas_venta WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'factura % no encontrada', v_id; END IF;

    IF p_row ?| ARRAY['estado_afip', 'cae', 'numero_cae', 'fecha_vencimiento_cae', 'resultado_afip',
                      'codigo_resultado_afip', 'fecha_autorizacion_afip', 'id_asiento_contable'] THEN
      RAISE EXCEPTION 'Los datos de AFIP y el asiento los asigna el servidor al emitir';
    END IF;
    IF p_row ? 'estado' AND NULLIF(p_row->>'estado', '') IS DISTINCT FROM v_estado
       AND NOT (v_estado = 'Borrador' AND p_row->>'estado' = 'Anulada') THEN
      RAISE EXCEPTION 'Cambio de estado no permitido (% → %): se emite con "Emitir" (AFIP) y un comprobante emitido se corrige con nota de crédito',
        v_estado, p_row->>'estado';
    END IF;
    IF v_estado <> 'Borrador'
       AND p_row ?| ARRAY['fecha_emision', 'fecha_vencimiento', 'subtotal', 'descuento', 'iva', 'total',
                          'concepto', 'fecha_servicio_desde', 'fecha_servicio_hasta',
                          'tipo_comprobante', 'id_cliente', 'cliente_nombre', 'cliente_dni_cuit',
                          'cliente_direccion', 'cliente_condicion_iva'] THEN
      RAISE EXCEPTION 'El comprobante % ya fue emitido: solo se pueden editar las observaciones', v_id;
    END IF;

    UPDATE public.facturas_venta AS t SET
      estado = CASE WHEN p_row ? 'estado' THEN NULLIF(p_row->>'estado', '') ELSE t.estado END,
      tipo_comprobante = CASE WHEN p_row ? 'tipo_comprobante'
        THEN COALESCE(NULLIF(p_row->>'tipo_comprobante', ''), t.tipo_comprobante) ELSE t.tipo_comprobante END,
      id_cliente = CASE WHEN p_row ? 'id_cliente' THEN NULLIF(p_row->>'id_cliente', '')::integer ELSE t.id_cliente END,
      cliente_nombre = CASE WHEN p_row ? 'cliente_nombre'
        THEN COALESCE(NULLIF(p_row->>'cliente_nombre', ''), t.cliente_nombre) ELSE t.cliente_nombre END,
      cliente_dni_cuit = CASE WHEN p_row ? 'cliente_dni_cuit' THEN NULLIF(p_row->>'cliente_dni_cuit', '') ELSE t.cliente_dni_cuit END,
      cliente_direccion = CASE WHEN p_row ? 'cliente_direccion' THEN NULLIF(p_row->>'cliente_direccion', '') ELSE t.cliente_direccion END,
      cliente_condicion_iva = CASE WHEN p_row ? 'cliente_condicion_iva'
        THEN NULLIF(p_row->>'cliente_condicion_iva', '') ELSE t.cliente_condicion_iva END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      fecha_emision = CASE WHEN p_row ? 'fecha_emision' THEN NULLIF(p_row->>'fecha_emision', '')::date ELSE t.fecha_emision END,
      fecha_vencimiento = CASE WHEN p_row ? 'fecha_vencimiento' THEN NULLIF(p_row->>'fecha_vencimiento', '')::date ELSE t.fecha_vencimiento END,
      subtotal = CASE WHEN p_row ? 'subtotal' THEN NULLIF(p_row->>'subtotal', '')::numeric ELSE t.subtotal END,
      descuento = CASE WHEN p_row ? 'descuento' THEN NULLIF(p_row->>'descuento', '')::numeric ELSE t.descuento END,
      iva = CASE WHEN p_row ? 'iva' THEN NULLIF(p_row->>'iva', '')::numeric ELSE t.iva END,
      total = CASE WHEN p_row ? 'total' THEN NULLIF(p_row->>'total', '')::numeric ELSE t.total END,
      concepto = CASE WHEN p_row ? 'concepto' THEN COALESCE(NULLIF(p_row->>'concepto', '')::smallint, 1) ELSE t.concepto END,
      fecha_servicio_desde = CASE WHEN p_row ? 'fecha_servicio_desde' THEN NULLIF(p_row->>'fecha_servicio_desde', '')::date ELSE t.fecha_servicio_desde END,
      fecha_servicio_hasta = CASE WHEN p_row ? 'fecha_servicio_hasta' THEN NULLIF(p_row->>'fecha_servicio_hasta', '')::date ELSE t.fecha_servicio_hasta END,
      updated_at = COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    RETURN v_out;
  END IF;

  IF p_kind = 'factura_item' THEN
    v_id_factura := (p_row->>'id_factura')::integer;
    IF NOT EXISTS (SELECT 1 FROM public.facturas_venta WHERE id = v_id_factura AND estado = 'Borrador') THEN
      RAISE EXCEPTION 'Solo se agregan ítems a comprobantes en borrador (factura %)', v_id_factura;
    END IF;
    INSERT INTO public.facturas_items (
      id_factura, item_numero, descripcion, cantidad, unidad_medida,
      precio_unitario, descuento, iva_porcentaje, iva_monto, subtotal, total, id_articulo
    ) VALUES (
      v_id_factura,
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
      v_id_factura := COALESCE(NULLIF(v_item->>'id_factura', '')::integer, NULLIF(p_row->>'id_factura', '')::integer);
      IF NOT EXISTS (SELECT 1 FROM public.facturas_venta WHERE id = v_id_factura AND estado = 'Borrador') THEN
        RAISE EXCEPTION 'Solo se agregan ítems a comprobantes en borrador (factura %)', v_id_factura;
      END IF;
      INSERT INTO public.facturas_items (
        id_factura, item_numero, descripcion, cantidad, unidad_medida,
        precio_unitario, descuento, iva_porcentaje, iva_monto, subtotal, total, id_articulo
      ) VALUES (
        v_id_factura,
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

-- Relleno: borradores sin condición IVA toman la de la ficha del cliente,
-- primero por id_cliente y, si la factura no está vinculada, por CUIT.
UPDATE public.facturas_venta AS f
SET cliente_condicion_iva = public.normalizar_condicion_iva_cliente(c.condicion_iva),
    updated_at = now()
FROM public.clientes AS c
WHERE f.id_cliente = c.id
  AND public.normalizar_condicion_iva_cliente(c.condicion_iva) IS NOT NULL
  AND f.estado = 'Borrador'
  AND COALESCE(f.estado_afip, '') <> 'Autorizada'
  AND NULLIF(btrim(f.cliente_condicion_iva), '') IS NULL;

UPDATE public.facturas_venta AS f
SET cliente_condicion_iva = x.cond,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (regexp_replace(c.dni_cuit, '\D', '', 'g'))
    regexp_replace(c.dni_cuit, '\D', '', 'g') AS cuit,
    public.normalizar_condicion_iva_cliente(c.condicion_iva) AS cond
  FROM public.clientes AS c
  WHERE length(regexp_replace(COALESCE(c.dni_cuit, ''), '\D', '', 'g')) = 11
    AND public.normalizar_condicion_iva_cliente(c.condicion_iva) IS NOT NULL
  ORDER BY regexp_replace(c.dni_cuit, '\D', '', 'g'), COALESCE(c.activo, true) DESC, c.id
) AS x
WHERE f.id_cliente IS NULL
  AND regexp_replace(COALESCE(f.cliente_dni_cuit, ''), '\D', '', 'g') = x.cuit
  AND f.estado = 'Borrador'
  AND COALESCE(f.estado_afip, '') <> 'Autorizada'
  AND NULLIF(btrim(f.cliente_condicion_iva), '') IS NULL;
