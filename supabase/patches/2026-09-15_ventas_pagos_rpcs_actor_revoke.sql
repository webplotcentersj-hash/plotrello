-- Paso 21 seguridad (comercial): RPC DEFINER + actor gate + REVOKE DML
-- en ventas / ventas_items / pagos. SELECT anon se mantiene.
-- Crear venta sigue vía crear_venta_directa / otras RPCs existentes;
-- este patch cubre DML directo del front (update venta, insert/update pagos).

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS detalle_pago jsonb;

CREATE OR REPLACE FUNCTION public.actor_puede_escribir_comercial(p_actor_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_actor_id
      AND COALESCE(u.activo, true) = true
  );
$$;

REVOKE ALL ON FUNCTION public.actor_puede_escribir_comercial(integer) FROM PUBLIC, anon, authenticated;

-- Upsert parcial de venta (id obligatorio → UPDATE; sin id → INSERT raro, no usado por front hoy).
CREATE OR REPLACE FUNCTION public.ventas_upsert(
  p_actor_id integer,
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
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para escribir ventas';
  END IF;

  v_id := NULLIF(p_row->>'id', '')::integer;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ventas_upsert requiere id (altas vía crear_venta_*)';
  END IF;

  UPDATE public.ventas AS v SET
    id_op = CASE WHEN p_row ? 'id_op' THEN NULLIF(p_row->>'id_op', '')::integer ELSE v.id_op END,
    numero_op = CASE WHEN p_row ? 'numero_op' THEN NULLIF(p_row->>'numero_op', '') ELSE v.numero_op END,
    valor_total = CASE WHEN p_row ? 'valor_total' THEN NULLIF(p_row->>'valor_total', '')::numeric ELSE v.valor_total END,
    metodo_pago = CASE WHEN p_row ? 'metodo_pago' THEN NULLIF(p_row->>'metodo_pago', '') ELSE v.metodo_pago END,
    estado_pago = CASE WHEN p_row ? 'estado_pago' THEN NULLIF(p_row->>'estado_pago', '') ELSE v.estado_pago END,
    monto_pagado = CASE WHEN p_row ? 'monto_pagado' THEN NULLIF(p_row->>'monto_pagado', '')::numeric ELSE v.monto_pagado END,
    caja_slug_cobro = CASE WHEN p_row ? 'caja_slug_cobro' THEN NULLIF(p_row->>'caja_slug_cobro', '') ELSE v.caja_slug_cobro END,
    fecha_venta = CASE WHEN p_row ? 'fecha_venta' THEN NULLIF(p_row->>'fecha_venta', '')::date ELSE v.fecha_venta END,
    observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE v.observaciones END,
    comprobante_pago_url = CASE WHEN p_row ? 'comprobante_pago_url' THEN NULLIF(p_row->>'comprobante_pago_url', '') ELSE v.comprobante_pago_url END,
    comprobante_pago_texto = CASE WHEN p_row ? 'comprobante_pago_texto' THEN NULLIF(p_row->>'comprobante_pago_texto', '') ELSE v.comprobante_pago_texto END,
    comprobante_pago_ia = CASE
      WHEN p_row ? 'comprobante_pago_ia' THEN
        CASE WHEN p_row->'comprobante_pago_ia' IS NULL OR p_row->>'comprobante_pago_ia' = 'null'
          THEN NULL ELSE p_row->'comprobante_pago_ia' END
      ELSE v.comprobante_pago_ia
    END,
    detalle_pago = CASE
      WHEN p_row ? 'detalle_pago' THEN
        CASE WHEN p_row->'detalle_pago' IS NULL OR p_row->>'detalle_pago' = 'null'
          THEN NULL ELSE p_row->'detalle_pago' END
      ELSE v.detalle_pago
    END,
    mp_payment_id = CASE WHEN p_row ? 'mp_payment_id' THEN NULLIF(p_row->>'mp_payment_id', '') ELSE v.mp_payment_id END,
    mp_preference_id = CASE WHEN p_row ? 'mp_preference_id' THEN NULLIF(p_row->>'mp_preference_id', '') ELSE v.mp_preference_id END,
    updated_at = COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
  WHERE v.id = v_id
  RETURNING to_jsonb(v.*) INTO v_out;

  IF v_out IS NULL THEN
    RAISE EXCEPTION 'Venta % no encontrada', v_id;
  END IF;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ventas_upsert(integer, jsonb) TO anon, authenticated;

-- Insert o update de pagos a proveedores (conciliación bancaria).
CREATE OR REPLACE FUNCTION public.pagos_upsert(
  p_actor_id integer,
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
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para escribir pagos';
  END IF;

  v_id := NULLIF(p_row->>'id', '')::integer;

  IF v_id IS NULL THEN
    INSERT INTO public.pagos (
      numero_pago,
      id_pedido_compra,
      id_proveedor,
      monto_total,
      monto_pagado,
      moneda,
      fecha_vencimiento,
      fecha_pago,
      metodo_pago,
      numero_comprobante,
      banco,
      cuenta_bancaria,
      estado,
      observaciones,
      id_usuario_registro,
      nombre_usuario_registro,
      fecha_conciliacion,
      id_usuario_conciliacion
    ) VALUES (
      COALESCE(NULLIF(p_row->>'numero_pago', ''), 'PAG-TMP'),
      NULLIF(p_row->>'id_pedido_compra', '')::integer,
      NULLIF(p_row->>'id_proveedor', '')::integer,
      COALESCE(NULLIF(p_row->>'monto_total', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'monto_pagado', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'moneda', ''), 'ARS'),
      NULLIF(p_row->>'fecha_vencimiento', '')::date,
      NULLIF(p_row->>'fecha_pago', '')::timestamptz,
      NULLIF(p_row->>'metodo_pago', ''),
      NULLIF(p_row->>'numero_comprobante', ''),
      NULLIF(p_row->>'banco', ''),
      NULLIF(p_row->>'cuenta_bancaria', ''),
      COALESCE(NULLIF(p_row->>'estado', ''), 'Pendiente'),
      NULLIF(p_row->>'observaciones', ''),
      COALESCE(NULLIF(p_row->>'id_usuario_registro', '')::integer, p_actor_id),
      NULLIF(p_row->>'nombre_usuario_registro', ''),
      NULLIF(p_row->>'fecha_conciliacion', '')::timestamptz,
      NULLIF(p_row->>'id_usuario_conciliacion', '')::integer
    )
    RETURNING to_jsonb(pagos.*) INTO v_out;
    RETURN v_out;
  END IF;

  UPDATE public.pagos AS p SET
    monto_pagado = CASE WHEN p_row ? 'monto_pagado' THEN NULLIF(p_row->>'monto_pagado', '')::numeric ELSE p.monto_pagado END,
    fecha_pago = CASE WHEN p_row ? 'fecha_pago' THEN NULLIF(p_row->>'fecha_pago', '')::timestamptz ELSE p.fecha_pago END,
    numero_comprobante = CASE WHEN p_row ? 'numero_comprobante' THEN NULLIF(p_row->>'numero_comprobante', '') ELSE p.numero_comprobante END,
    estado = CASE WHEN p_row ? 'estado' THEN NULLIF(p_row->>'estado', '') ELSE p.estado END,
    fecha_conciliacion = CASE WHEN p_row ? 'fecha_conciliacion' THEN NULLIF(p_row->>'fecha_conciliacion', '')::timestamptz ELSE p.fecha_conciliacion END,
    observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE p.observaciones END,
    id_usuario_conciliacion = CASE WHEN p_row ? 'id_usuario_conciliacion' THEN NULLIF(p_row->>'id_usuario_conciliacion', '')::integer ELSE p.id_usuario_conciliacion END,
    updated_at = now()
  WHERE p.id = v_id
  RETURNING to_jsonb(p.*) INTO v_out;

  IF v_out IS NULL THEN
    RAISE EXCEPTION 'Pago % no encontrado', v_id;
  END IF;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pagos_upsert(integer, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.ventas_upsert(integer, jsonb) IS
  'Paso 21: update venta con actor activo. Anon sin DML en tabla.';
COMMENT ON FUNCTION public.pagos_upsert(integer, jsonb) IS
  'Paso 21: insert/update pagos proveedores con actor activo. Anon sin DML en tabla.';

-- Policies SELECT-only donde había DML abierto / sin RLS.
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ventas_select_anon ON public.ventas;
CREATE POLICY ventas_select_anon ON public.ventas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS ventas_items_select_anon ON public.ventas_items;
CREATE POLICY ventas_items_select_anon ON public.ventas_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS pagos_select_anon ON public.pagos;
CREATE POLICY pagos_select_anon ON public.pagos FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.ventas FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ventas_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.pagos FROM anon, authenticated;

GRANT SELECT ON TABLE public.ventas TO anon, authenticated;
GRANT SELECT ON TABLE public.ventas_items TO anon, authenticated;
GRANT SELECT ON TABLE public.pagos TO anon, authenticated;

COMMENT ON TABLE public.ventas IS
  'Paso 21: anon solo SELECT. Escrituras vía ventas_upsert / crear_venta_* / RPCs.';
COMMENT ON TABLE public.pagos IS
  'Paso 21: anon solo SELECT. Escrituras vía pagos_upsert.';
COMMENT ON TABLE public.ventas_items IS
  'Paso 21: anon solo SELECT. Escrituras vía agregar_item_venta / RPCs.';
