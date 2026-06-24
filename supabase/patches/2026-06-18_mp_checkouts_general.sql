-- Checkouts Mercado Pago generales (ventas CRM + portal cliente)

CREATE TABLE IF NOT EXISTS public.mp_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 minutes'),
  tipo text NOT NULL CHECK (tipo IN ('venta', 'pedido_portal')),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'procesado', 'expirado')),
  payload jsonb NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 1),
  mp_preference_id varchar(80),
  mp_init_point text,
  mp_payment_id varchar(80),
  resultado_id bigint,
  resultado_extra jsonb,
  fulfillment_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mp_checkouts_estado ON public.mp_checkouts (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_checkouts_tipo ON public.mp_checkouts (tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_checkouts_mp_pay ON public.mp_checkouts (mp_payment_id);

COMMENT ON TABLE public.mp_checkouts IS 'Checkout MP unificado: ventas CRM y compras del portal';

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS mp_preference_id varchar(80),
  ADD COLUMN IF NOT EXISTS mp_payment_id varchar(80);

CREATE INDEX IF NOT EXISTS idx_ventas_mp_payment ON public.ventas (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crear_mp_checkout (
  p_tipo text,
  p_payload jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_amount numeric(10, 2);
  v_venta public.ventas%ROWTYPE;
  v_venta_id integer;
BEGIN
  IF p_tipo NOT IN ('venta', 'pedido_portal') THEN
    RETURN json_build_object('ok', false, 'error', 'Tipo de checkout inválido');
  END IF;

  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RETURN json_build_object('ok', false, 'error', 'Payload vacío');
  END IF;

  IF p_tipo = 'venta' THEN
    v_venta_id := (p_payload ->> 'venta_id')::integer;
    IF v_venta_id IS NULL OR v_venta_id < 1 THEN
      RETURN json_build_object('ok', false, 'error', 'Falta venta_id');
    END IF;

    SELECT * INTO v_venta FROM public.ventas v WHERE v.id = v_venta_id;
    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;

    IF v_venta.estado_pago NOT IN ('Pendiente', 'Parcial') THEN
      RETURN json_build_object('ok', false, 'error', 'La venta ya está cobrada o cancelada');
    END IF;

    v_amount := greatest(
      1,
      coalesce(v_venta.valor_total, 0) - coalesce(v_venta.monto_pagado, 0)
    );
  ELSE
    IF coalesce((p_payload ->> 'tipo_intencion'), 'compra') <> 'compra' THEN
      RETURN json_build_object('ok', false, 'error', 'Solo compras directas admiten pago con Mercado Pago');
    END IF;

    IF coalesce((p_payload ->> 'id_cliente')::integer, 0) < 1 THEN
      RETURN json_build_object('ok', false, 'error', 'Falta id_cliente');
    END IF;

    IF jsonb_array_length(coalesce(p_payload -> 'items', '[]'::jsonb)) < 1 THEN
      RETURN json_build_object('ok', false, 'error', 'El carrito está vacío');
    END IF;

    v_amount := coalesce((p_payload ->> 'amount')::numeric, 0);
    IF v_amount < 1 THEN
      SELECT coalesce(sum((elem ->> 'precio_total')::numeric), 0) INTO v_amount
      FROM jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) elem;
    END IF;

    IF v_amount < 1 THEN
      RETURN json_build_object('ok', false, 'error', 'El monto debe ser al menos $1');
    END IF;
  END IF;

  INSERT INTO public.mp_checkouts (tipo, payload, amount)
  VALUES (p_tipo, p_payload, v_amount)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'checkout_id', v_id, 'amount', v_amount, 'tipo', p_tipo);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_mp_checkout_preference (
  p_checkout_id uuid,
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
  UPDATE public.mp_checkouts c
  SET
    mp_preference_id = NULLIF(trim(p_preference_id), ''),
    mp_init_point = NULLIF(trim(p_init_point), '')
  WHERE c.id = p_checkout_id
    AND c.estado = 'pendiente'
    AND c.expires_at >= now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Checkout no encontrado o vencido');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_estado_mp_checkout (p_checkout_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chk public.mp_checkouts%ROWTYPE;
BEGIN
  SELECT * INTO v_chk FROM public.mp_checkouts WHERE id = p_checkout_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Checkout no encontrado');
  END IF;

  IF v_chk.expires_at < now() AND v_chk.estado = 'pendiente' THEN
    UPDATE public.mp_checkouts SET estado = 'expirado' WHERE id = p_checkout_id;
    v_chk.estado := 'expirado';
  END IF;

  RETURN json_build_object(
    'ok', true,
    'checkout_id', v_chk.id,
    'tipo', v_chk.tipo,
    'estado', v_chk.estado,
    'amount', v_chk.amount,
    'mp_preference_id', v_chk.mp_preference_id,
    'mp_payment_id', v_chk.mp_payment_id,
    'mp_init_point', v_chk.mp_init_point,
    'resultado_id', v_chk.resultado_id,
    'resultado_extra', v_chk.resultado_extra,
    'fulfillment_at', v_chk.fulfillment_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_mp_checkout_fulfillment (p_checkout_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mp_checkouts
  SET fulfillment_at = now()
  WHERE id = p_checkout_id AND fulfillment_at IS NULL;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.procesar_pago_mp_checkout (
  p_checkout_id uuid,
  p_mp_payment_id varchar(80) DEFAULT NULL,
  p_mp_preference_id varchar(80) DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chk public.mp_checkouts%ROWTYPE;
  v_mp_pay text;
  v_mp_pref text;
  v_venta_id integer;
  v_pedido_id integer;
  v_venta_new_id integer;
  v_numero_venta varchar(50);
  v_pedido_row record;
  v_venta_result json;
  v_obs text;
BEGIN
  SELECT * INTO v_chk FROM public.mp_checkouts WHERE id = p_checkout_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Checkout no encontrado');
  END IF;

  IF v_chk.estado = 'procesado' AND v_chk.resultado_id IS NOT NULL THEN
    RETURN json_build_object(
      'ok', true,
      'already_processed', true,
      'tipo', v_chk.tipo,
      'resultado_id', v_chk.resultado_id,
      'resultado_extra', v_chk.resultado_extra,
      'mp_payment_id', v_chk.mp_payment_id
    );
  END IF;

  IF v_chk.expires_at < now() AND v_chk.estado = 'pendiente' THEN
    UPDATE public.mp_checkouts SET estado = 'expirado' WHERE id = p_checkout_id;
    RETURN json_build_object('ok', false, 'error', 'Checkout vencido');
  END IF;

  v_mp_pay := coalesce(NULLIF(trim(p_mp_payment_id), ''), NULLIF(trim(v_chk.mp_payment_id), ''));
  v_mp_pref := coalesce(NULLIF(trim(p_mp_preference_id), ''), NULLIF(trim(v_chk.mp_preference_id), ''));

  IF v_mp_pay IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Falta id de pago MP');
  END IF;

  IF v_chk.tipo = 'venta' THEN
    v_venta_id := (v_chk.payload ->> 'venta_id')::integer;
    IF v_venta_id IS NULL THEN
      RETURN json_build_object('ok', false, 'error', 'Payload de venta inválido');
    END IF;

    UPDATE public.ventas v
    SET
      estado_pago = 'Pagado',
      metodo_pago = 'Mercado Pago',
      monto_pagado = coalesce(v.valor_total, v_chk.amount),
      mp_payment_id = v_mp_pay,
      mp_preference_id = coalesce(v_mp_pref, v.mp_preference_id),
      observaciones = left(
        coalesce(v.observaciones, '') || E'\nMP Pago: ' || v_mp_pay,
        2000
      ),
      updated_at = now()
    WHERE v.id = v_venta_id
      AND v.estado_pago IN ('Pendiente', 'Parcial');

    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'Venta no encontrada o ya cobrada');
    END IF;

    UPDATE public.control_caja_movimientos m
    SET
      nro_comprobante = v_mp_pay,
      observacion = left(
        coalesce(m.observacion, '') || ' — MP Pago: ' || v_mp_pay,
        500
      ),
      updated_at = now()
    WHERE m.origen_importacion = 'plotlab_venta'
      AND m.anulado = false
      AND m.observacion LIKE '%PL-VENTA-' || v_venta_id::text || '%';

    UPDATE public.mp_checkouts
    SET
      estado = 'procesado',
      mp_payment_id = v_mp_pay,
      mp_preference_id = coalesce(v_mp_pref, mp_preference_id),
      resultado_id = v_venta_id,
      resultado_extra = jsonb_build_object('venta_id', v_venta_id)
    WHERE id = p_checkout_id;

    RETURN json_build_object(
      'ok', true,
      'tipo', 'venta',
      'venta_id', v_venta_id,
      'mp_payment_id', v_mp_pay,
      'mp_preference_id', v_mp_pref
    );
  END IF;

  -- pedido_portal
  SELECT p.id, p.numero_pedido
  INTO v_pedido_row
  FROM public.crear_pedido_cliente(
    (v_chk.payload ->> 'id_cliente')::integer,
    NULLIF(v_chk.payload ->> 'fecha_limite_deseada', '')::date,
    NULLIF(v_chk.payload ->> 'observaciones_cliente', ''),
    coalesce(v_chk.payload -> 'items', '[]'::jsonb),
    coalesce((v_chk.payload ->> 'es_urgente')::boolean, false),
    coalesce((v_chk.payload ->> 'requiere_delivery')::boolean, false),
    NULLIF(v_chk.payload ->> 'direccion_delivery', ''),
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    'compra'
  ) p
  LIMIT 1;

  v_pedido_id := v_pedido_row.id;

  v_venta_result := public.crear_venta_desde_pedido_cliente(v_pedido_id);
  IF coalesce((v_venta_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RETURN json_build_object(
      'ok', false,
      'error', coalesce(v_venta_result ->> 'error', 'No se pudo crear la venta del pedido')
    );
  END IF;

  v_venta_new_id := ((v_venta_result -> 'data') ->> 'id')::integer;
  v_numero_venta := (v_venta_result -> 'data') ->> 'numero_venta';

  UPDATE public.ventas v
  SET
    estado_pago = 'Pagado',
    metodo_pago = 'Mercado Pago',
    monto_pagado = coalesce(v.valor_total, v_chk.amount),
    mp_payment_id = v_mp_pay,
    mp_preference_id = coalesce(v_mp_pref, v.mp_preference_id),
    observaciones = left(
      coalesce(v.observaciones, '') || E'\nMP Pago: ' || v_mp_pay,
      2000
    ),
    updated_at = now()
  WHERE v.id = v_venta_new_id;

  UPDATE public.control_caja_movimientos m
  SET
    nro_comprobante = v_mp_pay,
    observacion = left(
      coalesce(m.observacion, '') || ' — MP Pago: ' || v_mp_pay,
      500
    ),
    updated_at = now()
  WHERE m.origen_importacion = 'plotlab_venta'
    AND m.anulado = false
    AND m.observacion LIKE '%PL-VENTA-' || v_venta_new_id::text || '%';

  UPDATE public.mp_checkouts
  SET
    estado = 'procesado',
    mp_payment_id = v_mp_pay,
    mp_preference_id = coalesce(v_mp_pref, mp_preference_id),
    resultado_id = v_pedido_id,
    resultado_extra = jsonb_build_object(
      'pedido_id', v_pedido_id,
      'venta_id', v_venta_new_id,
      'numero_venta', v_numero_venta,
      'id_cliente', (v_chk.payload ->> 'id_cliente')::integer
    )
  WHERE id = p_checkout_id;

  RETURN json_build_object(
    'ok', true,
    'tipo', 'pedido_portal',
    'pedido_id', v_pedido_id,
    'venta_id', v_venta_new_id,
    'numero_venta', v_numero_venta,
    'id_cliente', (v_chk.payload ->> 'id_cliente')::integer,
    'mp_payment_id', v_mp_pay,
    'mp_preference_id', v_mp_pref
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_mp_checkout (text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.crear_mp_checkout (text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_mp_checkout_preference (uuid, varchar, text) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_mp_checkout_preference (uuid, varchar, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_estado_mp_checkout (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_estado_mp_checkout (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.procesar_pago_mp_checkout (uuid, varchar, varchar) TO anon;
GRANT EXECUTE ON FUNCTION public.procesar_pago_mp_checkout (uuid, varchar, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_mp_checkout_fulfillment (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.marcar_mp_checkout_fulfillment (uuid) TO authenticated;
