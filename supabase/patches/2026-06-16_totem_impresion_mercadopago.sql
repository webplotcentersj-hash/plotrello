-- Mercado Pago en solicitudes de impresión tótem
BEGIN;

ALTER TABLE public.totem_impresion_solicitudes
  ADD COLUMN IF NOT EXISTS mp_preference_id varchar(80),
  ADD COLUMN IF NOT EXISTS mp_payment_id varchar(80),
  ADD COLUMN IF NOT EXISTS mp_init_point text;

CREATE INDEX IF NOT EXISTS idx_totem_impresion_mp_pref ON public.totem_impresion_solicitudes (mp_preference_id);

COMMENT ON COLUMN public.totem_impresion_solicitudes.mp_preference_id IS 'Preference id de Mercado Pago Checkout Pro';
COMMENT ON COLUMN public.totem_impresion_solicitudes.mp_payment_id IS 'Payment id confirmado por webhook MP';
COMMENT ON COLUMN public.totem_impresion_solicitudes.mp_init_point IS 'URL Checkout Pro para QR / link de pago';

CREATE OR REPLACE FUNCTION public.registrar_mp_preference_totem_impresion (
  p_solicitud_id bigint,
  p_preference_id varchar(80),
  p_init_point text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.totem_impresion_solicitudes s
  SET
    mp_preference_id = NULLIF(trim(p_preference_id), ''),
    mp_init_point = NULLIF(trim(p_init_point), '')
  WHERE s.id = p_solicitud_id
    AND s.estado_pago = 'pendiente';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Solicitud no encontrada o ya pagada');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_pago_totem_impresion_mp (
  p_solicitud_id bigint,
  p_mp_payment_id varchar(80) DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totem_impresion_solicitudes%ROWTYPE;
  v_user record;
  v_titulo text := 'Tótem: pago Mercado Pago confirmado — impresión';
  v_desc text;
BEGIN
  UPDATE public.totem_impresion_solicitudes s
  SET
    estado_pago = 'pagado',
    pagado_at = now(),
    mp_payment_id = coalesce(NULLIF(trim(p_mp_payment_id), ''), s.mp_payment_id)
  WHERE s.id = p_solicitud_id
    AND s.estado_pago = 'pendiente'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Solicitud no encontrada o ya pagada');
  END IF;

  IF v_row.id_venta IS NOT NULL THEN
    UPDATE public.ventas ve
    SET
      estado_pago = 'Pagado',
      metodo_pago = coalesce(nullif(trim(ve.metodo_pago), ''), 'Mercado Pago'),
      monto_pagado = coalesce(ve.valor_total, ve.monto_pagado),
      updated_at = now()
    WHERE ve.id = v_row.id_venta;
  END IF;

  v_desc :=
    'Solicitud #' || v_row.id::text || ' — Cliente: ' || v_row.cliente_nombre || E'\n' ||
    'Archivo: ' || v_row.archivo_nombre || E'\n' ||
    'Link: ' || v_row.archivo_url || E'\n' ||
    CASE
      WHEN v_row.id_venta IS NOT NULL THEN
        'Venta CRM id ' || v_row.id_venta::text || ' marcada como Pagado.' || E'\n'
      ELSE ''
    END ||
    coalesce('MP payment: ' || NULLIF(trim(p_mp_payment_id), '') || E'\n', '') ||
    'Podés imprimir / entregar.';

  FOR v_user IN
    SELECT id FROM public.usuarios
    WHERE rol IN ('imprenta', 'mostrador', 'caja')
  LOOP
    INSERT INTO public.user_notifications (
      user_id,
      title,
      description,
      type,
      is_read,
      orden_id
    ) VALUES (
      v_user.id,
      v_titulo,
      v_desc,
      'success',
      false,
      v_row.orden_id
    );
  END LOOP;

  RETURN json_build_object(
    'ok', true,
    'solicitud_id', v_row.id,
    'estado_pago', v_row.estado_pago
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_estado_pago_totem_impresion (p_solicitud_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totem_impresion_solicitudes%ROWTYPE;
  v_valor numeric(10, 2);
BEGIN
  SELECT s.* INTO v_row
  FROM public.totem_impresion_solicitudes s
  WHERE s.id = p_solicitud_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Solicitud no encontrada');
  END IF;

  v_valor := NULL;
  IF v_row.id_venta IS NOT NULL THEN
    SELECT coalesce(v.valor_total, 0) INTO v_valor
    FROM public.ventas v
    WHERE v.id = v_row.id_venta;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'solicitud_id', v_row.id,
    'estado_pago', v_row.estado_pago,
    'pagado_at', v_row.pagado_at,
    'valor_total', v_valor,
    'mp_preference_id', v_row.mp_preference_id,
    'mp_payment_id', v_row.mp_payment_id,
    'mp_init_point', v_row.mp_init_point,
    'cliente_nombre', v_row.cliente_nombre,
    'archivo_nombre', v_row.archivo_nombre
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_mp_preference_totem_impresion (bigint, varchar, text) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_mp_preference_totem_impresion (bigint, varchar, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_pago_totem_impresion_mp (bigint, varchar) TO anon;
GRANT EXECUTE ON FUNCTION public.marcar_pago_totem_impresion_mp (bigint, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_estado_pago_totem_impresion (bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_estado_pago_totem_impresion (bigint) TO authenticated;

COMMIT;
