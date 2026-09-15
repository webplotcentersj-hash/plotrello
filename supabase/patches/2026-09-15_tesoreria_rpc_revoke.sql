-- Paso 23 seguridad (tesoreria): RPC + actor + REVOKE DML
-- en cuentas_por_pagar, pagos_proveedores, movimientos_bancarios.
-- Reusa actor_puede_escribir_comercial (Paso 21).

CREATE OR REPLACE FUNCTION public.tesoreria_upsert(
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
  v_count integer := 0;
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL OR NULLIF(btrim(p_kind), '') IS NULL
     OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para escribir tesoreria (%)', COALESCE(p_kind, '?');
  END IF;

  IF p_kind = 'cxp' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      INSERT INTO public.cuentas_por_pagar (
        id_pedido_compra, id_proveedor, proveedor_nombre, numero_documento,
        monto_total, monto_pagado, monto_pendiente, fecha_emision, fecha_vencimiento,
        estado, observaciones
      ) VALUES (
        NULLIF(p_row->>'id_pedido_compra', '')::integer,
        NULLIF(p_row->>'id_proveedor', '')::integer,
        NULLIF(p_row->>'proveedor_nombre', ''),
        NULLIF(p_row->>'numero_documento', ''),
        COALESCE(NULLIF(p_row->>'monto_total', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'monto_pagado', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'monto_pendiente', '')::numeric, 0),
        NULLIF(p_row->>'fecha_emision', '')::date,
        NULLIF(p_row->>'fecha_vencimiento', '')::date,
        COALESCE(NULLIF(p_row->>'estado', ''), 'Pendiente'),
        NULLIF(p_row->>'observaciones', '')
      )
      RETURNING to_jsonb(cuentas_por_pagar.*) INTO v_out;
      RETURN v_out;
    END IF;
    UPDATE public.cuentas_por_pagar AS t SET
      monto_pagado = CASE WHEN p_row ? 'monto_pagado' THEN NULLIF(p_row->>'monto_pagado', '')::numeric ELSE t.monto_pagado END,
      monto_pendiente = CASE WHEN p_row ? 'monto_pendiente' THEN NULLIF(p_row->>'monto_pendiente', '')::numeric ELSE t.monto_pendiente END,
      monto_total = CASE WHEN p_row ? 'monto_total' THEN NULLIF(p_row->>'monto_total', '')::numeric ELSE t.monto_total END,
      estado = CASE WHEN p_row ? 'estado' THEN NULLIF(p_row->>'estado', '') ELSE t.estado END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      updated_at = COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    IF v_out IS NULL THEN RAISE EXCEPTION 'cxp % no encontrado', v_id; END IF;
    RETURN v_out;
  END IF;

  IF p_kind = 'pago_proveedor' THEN
    INSERT INTO public.pagos_proveedores (
      fecha, numero_pago, numero_recibo, proveedor_nombre, usuario, monto,
      id_proveedor, id_pago_cobro, fecha_desde, fecha_hasta
    ) VALUES (
      NULLIF(p_row->>'fecha', '')::date,
      COALESCE(NULLIF(p_row->>'numero_pago', ''), ''),
      COALESCE(NULLIF(p_row->>'numero_recibo', ''), ''),
      NULLIF(p_row->>'proveedor_nombre', ''),
      NULLIF(p_row->>'usuario', ''),
      COALESCE(NULLIF(p_row->>'monto', '')::numeric, 0),
      NULLIF(p_row->>'id_proveedor', '')::integer,
      NULLIF(p_row->>'id_pago_cobro', '')::integer,
      NULLIF(p_row->>'fecha_desde', '')::date,
      NULLIF(p_row->>'fecha_hasta', '')::date
    )
    ON CONFLICT (numero_pago, numero_recibo) DO UPDATE SET
      fecha = EXCLUDED.fecha,
      proveedor_nombre = EXCLUDED.proveedor_nombre,
      usuario = EXCLUDED.usuario,
      monto = EXCLUDED.monto,
      id_proveedor = COALESCE(EXCLUDED.id_proveedor, public.pagos_proveedores.id_proveedor),
      id_pago_cobro = COALESCE(EXCLUDED.id_pago_cobro, public.pagos_proveedores.id_pago_cobro),
      fecha_desde = COALESCE(EXCLUDED.fecha_desde, public.pagos_proveedores.fecha_desde),
      fecha_hasta = COALESCE(EXCLUDED.fecha_hasta, public.pagos_proveedores.fecha_hasta),
      updated_at = now()
    RETURNING to_jsonb(pagos_proveedores.*) INTO v_out;
    RETURN v_out;
  END IF;

  IF p_kind = 'pagos_proveedores' THEN
    v_items := COALESCE(p_row->'items', '[]'::jsonb);
    IF jsonb_typeof(v_items) <> 'array' THEN
      RAISE EXCEPTION 'pagos_proveedores requiere p_row.items array';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
    LOOP
      INSERT INTO public.pagos_proveedores (
        fecha, numero_pago, numero_recibo, proveedor_nombre, usuario, monto,
        id_proveedor, id_pago_cobro, fecha_desde, fecha_hasta
      ) VALUES (
        NULLIF(v_item->>'fecha', '')::date,
        COALESCE(NULLIF(v_item->>'numero_pago', ''), ''),
        COALESCE(NULLIF(v_item->>'numero_recibo', ''), ''),
        NULLIF(v_item->>'proveedor_nombre', ''),
        NULLIF(v_item->>'usuario', ''),
        COALESCE(NULLIF(v_item->>'monto', '')::numeric, 0),
        NULLIF(v_item->>'id_proveedor', '')::integer,
        NULLIF(v_item->>'id_pago_cobro', '')::integer,
        NULLIF(v_item->>'fecha_desde', '')::date,
        NULLIF(v_item->>'fecha_hasta', '')::date
      )
      ON CONFLICT (numero_pago, numero_recibo) DO UPDATE SET
        fecha = EXCLUDED.fecha,
        proveedor_nombre = EXCLUDED.proveedor_nombre,
        usuario = EXCLUDED.usuario,
        monto = EXCLUDED.monto,
        fecha_desde = COALESCE(EXCLUDED.fecha_desde, public.pagos_proveedores.fecha_desde),
        fecha_hasta = COALESCE(EXCLUDED.fecha_hasta, public.pagos_proveedores.fecha_hasta),
        updated_at = now();
      v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'count', v_count);
  END IF;

  IF p_kind = 'mov_bancario' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      INSERT INTO public.movimientos_bancarios (
        fecha_movimiento, fecha_valor, tipo, concepto, monto, moneda, banco, cuenta_bancaria,
        numero_comprobante, referencia, id_pago_asociado, conciliado, observaciones
      ) VALUES (
        COALESCE(NULLIF(p_row->>'fecha_movimiento', '')::date, CURRENT_DATE),
        NULLIF(p_row->>'fecha_valor', '')::date,
        COALESCE(NULLIF(p_row->>'tipo', ''), 'Egreso'),
        COALESCE(NULLIF(p_row->>'concepto', ''), ''),
        COALESCE(NULLIF(p_row->>'monto', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'moneda', ''), 'ARS'),
        COALESCE(NULLIF(p_row->>'banco', ''), ''),
        COALESCE(NULLIF(p_row->>'cuenta_bancaria', ''), ''),
        NULLIF(p_row->>'numero_comprobante', ''),
        NULLIF(p_row->>'referencia', ''),
        NULLIF(p_row->>'id_pago_asociado', '')::integer,
        COALESCE((p_row->>'conciliado')::boolean, false),
        NULLIF(p_row->>'observaciones', '')
      )
      RETURNING to_jsonb(movimientos_bancarios.*) INTO v_out;
      RETURN v_out;
    END IF;
    UPDATE public.movimientos_bancarios AS t SET
      id_pago_asociado = CASE WHEN p_row ? 'id_pago_asociado' THEN NULLIF(p_row->>'id_pago_asociado', '')::integer ELSE t.id_pago_asociado END,
      conciliado = CASE WHEN p_row ? 'conciliado' THEN COALESCE((p_row->>'conciliado')::boolean, false) ELSE t.conciliado END,
      fecha_conciliacion = CASE WHEN p_row ? 'fecha_conciliacion' THEN NULLIF(p_row->>'fecha_conciliacion', '')::timestamptz ELSE t.fecha_conciliacion END,
      id_usuario_conciliacion = CASE WHEN p_row ? 'id_usuario_conciliacion' THEN NULLIF(p_row->>'id_usuario_conciliacion', '')::integer ELSE t.id_usuario_conciliacion END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      updated_at = now()
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    IF v_out IS NULL THEN RAISE EXCEPTION 'mov_bancario % no encontrado', v_id; END IF;
    RETURN v_out;
  END IF;

  RAISE EXCEPTION 'tesoreria_upsert kind desconocido: %', p_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tesoreria_upsert(integer, text, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.tesoreria_upsert(integer, text, jsonb) IS
  'Paso 23: upsert cxp|pago_proveedor(es)|mov_bancario con actor activo.';

ALTER TABLE public.movimientos_bancarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_cxp_all ON public.cuentas_por_pagar;
DROP POLICY IF EXISTS pagos_proveedores_all ON public.pagos_proveedores;
DROP POLICY IF EXISTS movimientos_bancarios_select_anon ON public.movimientos_bancarios;

CREATE POLICY cxp_select_anon ON public.cuentas_por_pagar
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pagos_proveedores_select_anon ON public.pagos_proveedores
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY movimientos_bancarios_select_anon ON public.movimientos_bancarios
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.cuentas_por_pagar FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.pagos_proveedores FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.movimientos_bancarios FROM anon, authenticated;

GRANT SELECT ON TABLE public.cuentas_por_pagar TO anon, authenticated;
GRANT SELECT ON TABLE public.pagos_proveedores TO anon, authenticated;
GRANT SELECT ON TABLE public.movimientos_bancarios TO anon, authenticated;

COMMENT ON TABLE public.cuentas_por_pagar IS
  'Paso 23: anon solo SELECT. Escrituras via tesoreria_upsert(cxp).';
COMMENT ON TABLE public.pagos_proveedores IS
  'Paso 23: anon solo SELECT. Escrituras via tesoreria_upsert(pago_proveedor/es).';
COMMENT ON TABLE public.movimientos_bancarios IS
  'Paso 23: anon solo SELECT. Escrituras via tesoreria_upsert(mov_bancario).';
