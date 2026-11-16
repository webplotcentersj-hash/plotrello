-- Cuenta proveedor: solo administración, gerencia o achavez@plotcenter.com.ar
-- Core sin grant a anon; wrappers públicos con p_actor_id; RLS SELECT-only.

CREATE OR REPLACE FUNCTION public.actor_puede_cuenta_proveedor(p_actor_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_actor_id
      AND COALESCE(u.activo, true) IS TRUE
      AND (
        u.rol IN ('administracion', 'gerencia')
        OR lower(trim(u.nombre)) = 'achavez@plotcenter.com.ar'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.actor_puede_cuenta_proveedor(integer) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.actor_puede_cuenta_proveedor(integer) IS
  'Escritura de cuenta proveedor: roles administracion/gerencia o usuario achavez@plotcenter.com.ar.';

CREATE OR REPLACE FUNCTION public.proveedor_actor_nombre(p_actor_id integer)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(NULLIF(trim(u.nombre), ''), 'Usuario #' || p_actor_id::text)
  FROM public.usuarios u
  WHERE u.id = p_actor_id;
$$;

REVOKE ALL ON FUNCTION public.proveedor_actor_nombre(integer) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Core: sin GRANT a anon/authenticated (solo otras funciones SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proveedor_registrar_en_cuenta_core(
  p_id_proveedor integer,
  p_tipo text,
  p_monto numeric,
  p_fecha date,
  p_comprobante text DEFAULT ''::text,
  p_usuario text DEFAULT NULL::text,
  p_url_adjunto text DEFAULT NULL::text,
  p_url_adjuntos jsonb DEFAULT '[]'::jsonb,
  p_fecha_vencimiento date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre text;
  v_tel text;
  v_saldo numeric;
  v_debe numeric := 0;
  v_haber numeric := 0;
  v_tipo text;
  v_comp text;
  v_id integer;
  v_fecha_hora timestamptz;
  v_vto date;
BEGIN
  IF p_id_proveedor IS NULL OR p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El proveedor y un importe mayor a 0 son obligatorios';
  END IF;
  IF lower(p_tipo) NOT IN ('factura', 'pago') THEN
    RAISE EXCEPTION 'Solo se puede cargar factura o pago';
  END IF;

  SELECT COALESCE(NULLIF(trim(razon_social), ''), nombre), COALESCE(NULLIF(trim(telefono), ''), '-')
    INTO v_nombre, v_tel
  FROM public.proveedores
  WHERE id = p_id_proveedor;
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  SELECT COALESCE(
    (
      SELECT m.saldo FROM public.movimientos_proveedores m
      WHERE m.id_proveedor = p_id_proveedor
      ORDER BY m.fecha_hora DESC, m.id DESC LIMIT 1
    ),
    (
      SELECT d.saldo FROM public.deudas_proveedores d
      WHERE d.id_proveedor = p_id_proveedor
      ORDER BY d.fecha_corte DESC, d.id DESC LIMIT 1
    ),
    0
  ) INTO v_saldo;

  v_fecha_hora := clock_timestamp();
  v_vto := CASE WHEN lower(p_tipo) = 'factura' THEN p_fecha_vencimiento ELSE NULL END;

  IF lower(p_tipo) = 'factura' THEN
    v_debe := p_monto;
    v_saldo := v_saldo + p_monto;
    v_tipo := 'FACTURA';
    v_comp := NULLIF(trim(p_comprobante), '');
    IF v_comp IS NULL THEN
      v_comp := 'FAC-' || to_char(p_fecha, 'YYYYMMDD') || '-' || p_id_proveedor::text;
    END IF;
  ELSE
    v_haber := p_monto;
    v_saldo := v_saldo - p_monto;
    v_tipo := 'PAGO';
    v_comp := NULLIF(trim(p_comprobante), '');
    IF v_comp IS NULL THEN
      v_comp := 'PA-' || to_char(now(), 'YYYYMMDDHH24MISS');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.movimientos_proveedores m
    WHERE m.proveedor_nombre = v_nombre
      AND m.fecha_hora = v_fecha_hora
      AND m.comprobante = v_comp
  ) THEN
    v_comp := v_comp || '-' || to_char(clock_timestamp(), 'HH24MISSMS');
  END IF;

  INSERT INTO public.movimientos_proveedores (
    proveedor_nombre, moneda, fecha_hora, fecha_comprobante, fecha_vencimiento, tipo_movimiento,
    comprobante, debe, haber, saldo, es_saldo_inicial, id_proveedor,
    url_adjunto, url_adjuntos
  ) VALUES (
    v_nombre, 'PESOS', v_fecha_hora,
    p_fecha, v_vto, v_tipo, v_comp, v_debe, v_haber, v_saldo, false, p_id_proveedor,
    NULLIF(trim(COALESCE(p_url_adjunto, '')), ''),
    COALESCE(p_url_adjuntos, '[]'::jsonb)
  )
  RETURNING id INTO v_id;

  IF lower(p_tipo) = 'pago' THEN
    INSERT INTO public.pagos_proveedores (
      fecha, numero_pago, numero_recibo, proveedor_nombre, usuario, monto, id_proveedor
    ) VALUES (
      p_fecha, v_comp, '', v_nombre, p_usuario, p_monto, p_id_proveedor
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.deudas_proveedores WHERE id_proveedor = p_id_proveedor) THEN
    UPDATE public.deudas_proveedores
    SET saldo = v_saldo, fecha_corte = p_fecha, updated_at = now(), razon_social = v_nombre
    WHERE id_proveedor = p_id_proveedor;
  ELSE
    INSERT INTO public.deudas_proveedores (codigo, razon_social, telefono, saldo, id_proveedor, fecha_corte)
    VALUES ('P' || p_id_proveedor::text, v_nombre, v_tel, v_saldo, p_id_proveedor, p_fecha);
  END IF;

  RETURN json_build_object('success', true, 'saldo', v_saldo, 'tipo', v_tipo, 'id', v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_registrar_en_cuenta_core(integer, text, numeric, date, text, text, text, jsonb, date)
  FROM PUBLIC, anon, authenticated;

-- Reemplazar firma pública vieja
DROP FUNCTION IF EXISTS public.proveedor_registrar_en_cuenta(integer, text, numeric, date, text, text, text, jsonb, date);
DROP FUNCTION IF EXISTS public.proveedor_registrar_en_cuenta(integer, text, numeric, date, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.proveedor_registrar_en_cuenta(integer, text, numeric, date, text, text);

CREATE OR REPLACE FUNCTION public.proveedor_registrar_en_cuenta(
  p_actor_id integer,
  p_id_proveedor integer,
  p_tipo text,
  p_monto numeric,
  p_fecha date,
  p_comprobante text DEFAULT ''::text,
  p_url_adjunto text DEFAULT NULL::text,
  p_url_adjuntos jsonb DEFAULT '[]'::jsonb,
  p_fecha_vencimiento date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_usuario text;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_cuenta_proveedor(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado: solo administración, gerencia o el usuario autorizado pueden escribir la cuenta del proveedor';
  END IF;
  v_usuario := COALESCE(public.proveedor_actor_nombre(p_actor_id), 'Usuario #' || p_actor_id::text);
  RETURN public.proveedor_registrar_en_cuenta_core(
    p_id_proveedor,
    p_tipo,
    p_monto,
    p_fecha,
    p_comprobante,
    v_usuario,
    p_url_adjunto,
    p_url_adjuntos,
    p_fecha_vencimiento
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_registrar_en_cuenta(integer, integer, text, numeric, date, text, text, jsonb, date)
  FROM PUBLIC;
-- App usa anon key; el gate real es actor_puede_cuenta_proveedor(p_actor_id).
GRANT EXECUTE ON FUNCTION public.proveedor_registrar_en_cuenta(integer, integer, text, numeric, date, text, text, jsonb, date)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reset
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.proveedor_reset_cuenta(integer, text);

CREATE OR REPLACE FUNCTION public.proveedor_reset_cuenta(
  p_actor_id integer,
  p_id_proveedor integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre text;
  v_tel text;
  v_usuario text;
  v_at timestamptz := now();
  v_mov_del integer := 0;
  v_pag_del integer := 0;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_cuenta_proveedor(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado: solo administración, gerencia o el usuario autorizado pueden resetear la cuenta del proveedor';
  END IF;
  IF p_id_proveedor IS NULL OR p_id_proveedor <= 0 THEN
    RAISE EXCEPTION 'Proveedor inválido';
  END IF;

  SELECT COALESCE(NULLIF(trim(razon_social), ''), nombre), COALESCE(NULLIF(trim(telefono), ''), '-')
    INTO v_nombre, v_tel
  FROM public.proveedores
  WHERE id = p_id_proveedor;

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  v_usuario := COALESCE(public.proveedor_actor_nombre(p_actor_id), 'Usuario #' || p_actor_id::text);

  DELETE FROM public.movimientos_proveedores
  WHERE id_proveedor = p_id_proveedor;
  GET DIAGNOSTICS v_mov_del = ROW_COUNT;

  DELETE FROM public.pagos_proveedores
  WHERE id_proveedor = p_id_proveedor;
  GET DIAGNOSTICS v_pag_del = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM public.deudas_proveedores WHERE id_proveedor = p_id_proveedor) THEN
    UPDATE public.deudas_proveedores
    SET
      saldo = 0,
      fecha_corte = (v_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
      cuenta_reset_at = v_at,
      cuenta_reset_por = v_usuario,
      razon_social = v_nombre,
      updated_at = v_at
    WHERE id_proveedor = p_id_proveedor;
  ELSE
    INSERT INTO public.deudas_proveedores (
      codigo, razon_social, telefono, saldo, id_proveedor, fecha_corte,
      cuenta_reset_at, cuenta_reset_por
    ) VALUES (
      'P' || p_id_proveedor::text, v_nombre, v_tel, 0, p_id_proveedor,
      (v_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
      v_at, v_usuario
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'saldo', 0,
    'reset_por', v_usuario,
    'reset_at', v_at,
    'movimientos_borrados', v_mov_del,
    'pagos_borrados', v_pag_del
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_reset_cuenta(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proveedor_reset_cuenta(integer, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Adjuntar
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.proveedor_adjuntar_comprobante(integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.proveedor_adjuntar_comprobante(
  p_actor_id integer,
  p_id_movimiento integer,
  p_url_adjunto text DEFAULT ''::text,
  p_url_adjuntos jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_urls jsonb;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_cuenta_proveedor(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado: solo administración, gerencia o el usuario autorizado pueden adjuntar comprobantes';
  END IF;
  IF p_id_movimiento IS NULL OR p_id_movimiento <= 0 THEN
    RAISE EXCEPTION 'Movimiento inválido';
  END IF;

  v_url := NULLIF(trim(COALESCE(p_url_adjunto, '')), '');
  v_urls := COALESCE(p_url_adjuntos, '[]'::jsonb);

  UPDATE public.movimientos_proveedores
  SET
    url_adjunto = COALESCE(v_url, url_adjunto),
    url_adjuntos = CASE
      WHEN v_urls IS NULL OR v_urls = '[]'::jsonb THEN url_adjuntos
      ELSE COALESCE(url_adjuntos, '[]'::jsonb) || v_urls
    END,
    updated_at = now()
  WHERE id = p_id_movimiento;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento no encontrado';
  END IF;

  RETURN json_build_object('success', true, 'id', p_id_movimiento);
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_adjuntar_comprobante(integer, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proveedor_adjuntar_comprobante(integer, integer, text, jsonb) TO anon, authenticated;

-- Compensación CC: llama al core (ya validó actor en CC)
CREATE OR REPLACE FUNCTION public.cc_compensar_con_proveedor(
  p_actor_id integer,
  p_id_cliente integer,
  p_id_proveedor integer,
  p_monto numeric,
  p_fecha date,
  p_notas text DEFAULT NULL::text,
  p_url_comprobante text DEFAULT NULL::text,
  p_referencia text DEFAULT NULL::text,
  p_actor_nombre text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cc json;
  v_prov json;
  v_id_cc integer;
  v_id_prov integer;
  v_ref text;
  v_notas text;
  v_nombre_prov text;
  v_usuario text;
BEGIN
  IF p_actor_id IS NULL OR p_id_cliente IS NULL OR p_id_proveedor IS NULL THEN
    RAISE EXCEPTION 'Actor, cliente y proveedor son obligatorios';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'La fecha es obligatoria';
  END IF;
  -- Misma regla que escritura de cuenta proveedor
  IF NOT public.actor_puede_cuenta_proveedor(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado: solo administración, gerencia o el usuario autorizado pueden compensar con proveedor';
  END IF;

  SELECT COALESCE(NULLIF(trim(razon_social), ''), nombre)
    INTO v_nombre_prov
  FROM public.proveedores
  WHERE id = p_id_proveedor;
  IF v_nombre_prov IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  v_usuario := COALESCE(
    NULLIF(trim(COALESCE(p_actor_nombre, '')), ''),
    public.proveedor_actor_nombre(p_actor_id),
    'CC #' || p_id_cliente::text
  );

  v_ref := COALESCE(NULLIF(trim(p_referencia), ''), 'COMP-PROV-' || p_id_proveedor::text || '-' || to_char(p_fecha, 'YYYYMMDD'));
  v_notas := trim(both E'\n' from concat_ws(E'\n',
    NULLIF(trim(COALESCE(p_notas, '')), ''),
    'Compensación con proveedor #' || p_id_proveedor::text || ' (' || v_nombre_prov || ')'
  ));

  v_cc := public.cc_registrar_pago_actor(
    p_actor_id,
    p_id_cliente,
    p_monto,
    p_fecha,
    'Compensación proveedor',
    NULLIF(trim(COALESCE(p_url_comprobante, '')), ''),
    v_ref,
    v_notas,
    NULL,
    NULL,
    jsonb_build_object(
      'compensacion', true,
      'id_proveedor', p_id_proveedor,
      'proveedor_nombre', v_nombre_prov
    )
  );
  v_id_cc := COALESCE((v_cc->>'id_movimiento')::integer, (v_cc->>'id')::integer);

  v_prov := public.proveedor_registrar_en_cuenta_core(
    p_id_proveedor,
    'pago',
    p_monto,
    p_fecha,
    v_ref,
    v_usuario,
    NULLIF(trim(COALESCE(p_url_comprobante, '')), ''),
    CASE
      WHEN NULLIF(trim(COALESCE(p_url_comprobante, '')), '') IS NULL THEN '[]'::jsonb
      ELSE jsonb_build_array(jsonb_build_object('url', trim(p_url_comprobante), 'nombre', 'Compensación CC'))
    END,
    NULL
  );

  IF v_prov IS NULL OR COALESCE((v_prov->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_prov->>'error', 'No se pudo registrar el pago en cuenta proveedor');
  END IF;
  v_id_prov := (v_prov->>'id')::integer;

  UPDATE public.cc_cuenta_movimientos
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'compensacion', true,
    'id_proveedor', p_id_proveedor,
    'proveedor_nombre', v_nombre_prov,
    'id_movimiento_proveedor', v_id_prov
  ),
  metodo_pago = COALESCE(NULLIF(trim(metodo_pago), ''), 'Compensación proveedor')
  WHERE id = v_id_cc;

  RETURN json_build_object(
    'success', true,
    'id_movimiento_cc', v_id_cc,
    'id_movimiento_proveedor', v_id_prov,
    'id_cliente', p_id_cliente,
    'id_proveedor', p_id_proveedor,
    'monto', p_monto,
    'saldo_proveedor', (v_prov->>'saldo')::numeric,
    'referencia', v_ref
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- RLS: solo lectura desde el cliente; escrituras vía SECURITY DEFINER
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS movimientos_proveedores_all ON public.movimientos_proveedores;
DROP POLICY IF EXISTS deudas_proveedores_all ON public.deudas_proveedores;

CREATE POLICY movimientos_proveedores_select_authenticated
  ON public.movimientos_proveedores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY deudas_proveedores_select_authenticated
  ON public.deudas_proveedores
  FOR SELECT
  TO authenticated
  USING (true);

-- Mantener lectura para anon solo si ya se usaba (legado); sin escritura
CREATE POLICY movimientos_proveedores_select_anon
  ON public.movimientos_proveedores
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY deudas_proveedores_select_anon
  ON public.deudas_proveedores
  FOR SELECT
  TO anon
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.movimientos_proveedores FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.deudas_proveedores FROM anon, authenticated;
GRANT SELECT ON public.movimientos_proveedores TO anon, authenticated;
GRANT SELECT ON public.deudas_proveedores TO anon, authenticated;
