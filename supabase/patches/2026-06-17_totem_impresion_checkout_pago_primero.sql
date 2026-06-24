-- Checkout MP antes de crear solicitud (pagar → enviar a cola)
BEGIN;

CREATE TABLE IF NOT EXISTS public.totem_impresion_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '40 minutes'),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'pagado', 'procesado', 'expirado')),
  payload jsonb NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 1),
  mp_preference_id varchar(80),
  mp_init_point text,
  mp_payment_id varchar(80),
  solicitud_id bigint REFERENCES public.totem_impresion_solicitudes (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_totem_checkout_estado ON public.totem_impresion_checkouts (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_totem_checkout_mp_pay ON public.totem_impresion_checkouts (mp_payment_id);

COMMENT ON TABLE public.totem_impresion_checkouts IS 'Borrador de impresión tótem: se cobra con MP y luego se crea la solicitud';

CREATE OR REPLACE FUNCTION public.crear_totem_impresion_checkout (p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_amount numeric(10, 2);
BEGIN
  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RETURN json_build_object('ok', false, 'error', 'Payload vacío');
  END IF;

  v_amount := coalesce((p_payload ->> 'valor_total')::numeric, 0);
  IF v_amount < 1 THEN
    RETURN json_build_object('ok', false, 'error', 'El monto debe ser al menos $1');
  END IF;

  IF coalesce(trim(p_payload ->> 'cliente_nombre'), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Falta nombre del cliente');
  END IF;

  IF coalesce(trim(p_payload ->> 'archivo_url'), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Falta archivo');
  END IF;

  INSERT INTO public.totem_impresion_checkouts (payload, amount)
  VALUES (p_payload, v_amount)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'checkout_id', v_id, 'amount', v_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_mp_checkout_totem (
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
  UPDATE public.totem_impresion_checkouts c
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

CREATE OR REPLACE FUNCTION public.procesar_pago_totem_checkout_mp (
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
  v_chk public.totem_impresion_checkouts%ROWTYPE;
  v_payload jsonb;
  v_id bigint;
  v_id_venta integer;
  v_numero_venta varchar(50);
  v_valor numeric(10, 2);
  v_titulo text := 'Tótem: impresión pagada (Mercado Pago)';
  v_desc text;
  v_user record;
  v_obs_venta text;
  v_mp_pay text;
  v_mp_pref text;
BEGIN
  SELECT * INTO v_chk
  FROM public.totem_impresion_checkouts c
  WHERE c.id = p_checkout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Checkout no encontrado');
  END IF;

  IF v_chk.estado = 'procesado' AND v_chk.solicitud_id IS NOT NULL THEN
    RETURN json_build_object(
      'ok', true,
      'already_processed', true,
      'solicitud_id', v_chk.solicitud_id,
      'mp_payment_id', v_chk.mp_payment_id
    );
  END IF;

  IF v_chk.expires_at < now() AND v_chk.estado = 'pendiente' THEN
    UPDATE public.totem_impresion_checkouts SET estado = 'expirado' WHERE id = p_checkout_id;
    RETURN json_build_object('ok', false, 'error', 'Checkout vencido');
  END IF;

  v_payload := v_chk.payload;
  v_valor := v_chk.amount;
  v_mp_pay := coalesce(NULLIF(trim(p_mp_payment_id), ''), NULLIF(trim(v_chk.mp_payment_id), ''));
  v_mp_pref := coalesce(NULLIF(trim(p_mp_preference_id), ''), NULLIF(trim(v_chk.mp_preference_id), ''));

  IF v_mp_pay IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Falta id de pago MP');
  END IF;

  v_numero_venta := 'VENT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    (coalesce((SELECT max(id) FROM public.ventas), 0) + 1)::text,
    4,
    '0'
  );

  v_obs_venta :=
    'Venta tótem impresión (MP confirmado).' || E'\n' ||
    'MP Pago: ' || v_mp_pay ||
    coalesce(E'\nMP Checkout: ' || v_mp_pref, '') || E'\n' ||
    'Hojas: ' || coalesce(v_payload ->> 'cantidad_hojas', '?') || ' | Tipo: ' || coalesce(v_payload ->> 'tipo_impresion', '') || E'\n' ||
    'Archivo: ' || coalesce(v_payload ->> 'archivo_nombre', '');

  INSERT INTO public.ventas (
    numero_venta,
    cliente_nombre,
    cliente_telefono,
    cliente_dni_cuit,
    valor_total,
    monto_pagado,
    metodo_pago,
    estado_pago,
    fecha_venta,
    id_vendedor,
    nombre_vendedor,
    observaciones
  )
  VALUES (
    v_numero_venta,
    trim(v_payload ->> 'cliente_nombre'),
    trim(coalesce(v_payload ->> 'cliente_telefono', '')),
    trim(coalesce(v_payload ->> 'cliente_dni', '')),
    v_valor,
    v_valor,
    'Mercado Pago',
    'Pagado',
    CURRENT_DATE,
    1,
    'Totem autoservicio',
    v_obs_venta
  )
  RETURNING id INTO v_id_venta;

  INSERT INTO public.ventas_items (
    id_venta,
    codigo_articulo,
    descripcion,
    cantidad,
    precio_unitario,
    precio_total,
    descuento,
    observaciones
  ) VALUES (
    v_id_venta,
    'TOTEM-IMP',
    'Impresión tótem — ' || coalesce(v_payload ->> 'tipo_impresion', '') || ' (' || coalesce(v_payload ->> 'cantidad_hojas', '1') || ' hojas)',
    1,
    v_valor,
    v_valor,
    0,
    'MP Pago: ' || v_mp_pay
  );

  INSERT INTO public.totem_impresion_solicitudes (
    cliente_nombre,
    cliente_dni,
    cliente_telefono,
    cantidad_hojas,
    tipo_impresion,
    origen_archivo,
    archivo_url,
    archivo_nombre,
    id_venta,
    estado_pago,
    pagado_at,
    mp_preference_id,
    mp_payment_id,
    mp_init_point
  )
  VALUES (
    trim(v_payload ->> 'cliente_nombre'),
    trim(coalesce(v_payload ->> 'cliente_dni', '')),
    trim(coalesce(v_payload ->> 'cliente_telefono', '')),
    greatest(1, coalesce((v_payload ->> 'cantidad_hojas')::integer, 1)),
    trim(coalesce(v_payload ->> 'tipo_impresion', 'A4')),
    trim(coalesce(v_payload ->> 'origen_archivo', 'Totem')),
    trim(v_payload ->> 'archivo_url'),
    trim(coalesce(v_payload ->> 'archivo_nombre', 'archivo')),
    v_id_venta,
    'pagado',
    now(),
    v_mp_pref,
    v_mp_pay,
    v_chk.mp_init_point
  )
  RETURNING id INTO v_id;

  UPDATE public.totem_impresion_checkouts
  SET
    estado = 'procesado',
    mp_payment_id = v_mp_pay,
    mp_preference_id = coalesce(v_mp_pref, mp_preference_id),
    solicitud_id = v_id
  WHERE id = p_checkout_id;

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
    AND m.observacion LIKE '%PL-VENTA-' || v_id_venta::text || '%';

  v_desc :=
    'Solicitud #' || v_id::text || ' — Cliente: ' || trim(v_payload ->> 'cliente_nombre') || E'\n' ||
    'Archivo: ' || coalesce(v_payload ->> 'archivo_nombre', '') || E'\n' ||
    'Descargar: ' || coalesce(v_payload ->> 'archivo_url', '') || E'\n' ||
    'MP Pago: ' || v_mp_pay || E'\n' ||
    'Venta CRM: ' || v_numero_venta || ' (id ' || v_id_venta::text || ') — $' || trim(to_char(v_valor, 'FM999999990.00')) || E'\n' ||
    'Pago confirmado. Podés imprimir.';

  FOR v_user IN
    SELECT id FROM public.usuarios
    WHERE rol IN ('imprenta', 'mostrador', 'caja')
  LOOP
    INSERT INTO public.user_notifications (
      user_id, title, description, type, is_read, orden_id
    ) VALUES (
      v_user.id, v_titulo, v_desc, 'success', false, NULL
    );
  END LOOP;

  RETURN json_build_object(
    'ok', true,
    'solicitud_id', v_id,
    'id_venta', v_id_venta,
    'numero_venta', v_numero_venta,
    'mp_payment_id', v_mp_pay,
    'mp_preference_id', v_mp_pref,
    'estado_pago', 'pagado'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_estado_totem_checkout (p_checkout_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chk public.totem_impresion_checkouts%ROWTYPE;
BEGIN
  SELECT * INTO v_chk FROM public.totem_impresion_checkouts WHERE id = p_checkout_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Checkout no encontrado');
  END IF;

  IF v_chk.expires_at < now() AND v_chk.estado = 'pendiente' THEN
    UPDATE public.totem_impresion_checkouts SET estado = 'expirado' WHERE id = p_checkout_id;
    v_chk.estado := 'expirado';
  END IF;

  RETURN json_build_object(
    'ok', true,
    'checkout_id', v_chk.id,
    'estado', v_chk.estado,
    'amount', v_chk.amount,
    'mp_preference_id', v_chk.mp_preference_id,
    'mp_payment_id', v_chk.mp_payment_id,
    'mp_init_point', v_chk.mp_init_point,
    'solicitud_id', v_chk.solicitud_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.listar_solicitudes_impresion_totem (integer, integer);

CREATE OR REPLACE FUNCTION public.listar_solicitudes_impresion_totem (
  p_usuario_id integer,
  p_limite integer DEFAULT 80
)
RETURNS TABLE (
  id bigint,
  cliente_nombre character varying,
  cliente_dni character varying,
  cliente_telefono character varying,
  cantidad_hojas integer,
  tipo_impresion character varying,
  origen_archivo character varying,
  archivo_url text,
  archivo_nombre character varying,
  numero_op character varying,
  estado_pago text,
  created_at timestamp with time zone,
  pagado_at timestamp with time zone,
  id_venta integer,
  numero_venta_crm character varying,
  valor_venta numeric,
  estado_pago_venta character varying,
  impreso_at timestamp with time zone,
  impreso_por_usuario_id integer,
  mp_payment_id character varying,
  mp_preference_id character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('imprenta', 'mostrador', 'caja', 'administracion', 'gerencia', 'taller-grafico')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para listar solicitudes de impresión del tótem';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.cliente_nombre,
    s.cliente_dni,
    s.cliente_telefono,
    s.cantidad_hojas,
    s.tipo_impresion,
    s.origen_archivo,
    s.archivo_url,
    s.archivo_nombre,
    s.numero_op,
    s.estado_pago,
    s.created_at,
    s.pagado_at,
    s.id_venta,
    v.numero_venta,
    v.valor_total,
    v.estado_pago,
    s.impreso_at,
    s.impreso_por_usuario_id,
    s.mp_payment_id,
    s.mp_preference_id
  FROM public.totem_impresion_solicitudes s
  LEFT JOIN public.ventas v ON v.id = s.id_venta
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(p_limite, 500));
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_totem_impresion_checkout (jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.crear_totem_impresion_checkout (jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_mp_checkout_totem (uuid, varchar, text) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_mp_checkout_totem (uuid, varchar, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.procesar_pago_totem_checkout_mp (uuid, varchar, varchar) TO anon;
GRANT EXECUTE ON FUNCTION public.procesar_pago_totem_checkout_mp (uuid, varchar, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_estado_totem_checkout (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_estado_totem_checkout (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem (integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem (integer, integer) TO authenticated;

COMMIT;
