-- Paso 26 seguridad (cuenta corriente): RPC con actor + sin DML anon + documentos privados.
--
-- Problema:
--  - clientes_cuenta_corriente y cc_cuenta_movimientos seguían con escritura anon (cc_rls_anon_plotrello).
--  - Las RPC de alta / aprobación / scoring / límites / intereses / pagos recibían el usuario desde el
--    navegador y no controlaban el rol: con la clave anon (pública, viaja en el bundle) se podía aprobar
--    una cuenta corriente, subir un límite de crédito o registrar un pago falso.
--  - quitar_cliente_cuenta_corriente borraba TODO el libro de movimientos sin actor ni control de saldo.
--  - DNI / estatuto / pagaré quedaban en el bucket público `archivos`.
--
-- Qué hace (mismo patrón que el Paso 25): no reescribe la lógica. Envuelve cada RPC que escribe en una
-- `cc_*` que valida el actor y su rol, y revoca la original de PUBLIC / anon / authenticated.
-- Las llamadas a las originales van por nombre de parámetro, así no dependen del orden de la firma viva.
--
-- IMPORTANTE: aplicar ANTES de deployar el front que llama a las nuevas funciones. Idempotente.

BEGIN;

-- 0) Chequeo previo: si alguna original no existe o sus parámetros se llaman distinto, no se aplica nada.
DO $$
DECLARE
  r RECORD;
  v_faltan text := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('registrar_alta_cuenta_corriente', ARRAY['p_cuit','p_razon_social','p_condicion_iva','p_email','p_whatsapp',
        'p_persona_contacto','p_domicilio','p_localidad','p_provincia','p_codigo_postal','p_url_constancia_afip',
        'p_url_estatuto','p_url_comprobante_domicilio','p_id_cliente','p_id_usuario_solicita','p_tipo_cliente',
        'p_nombre','p_apellido','p_url_documento_dni','p_url_pagare']),
      ('resolver_solicitud_cuenta_corriente', ARRAY['p_id_cliente','p_accion','p_id_usuario_revisor','p_motivo_rechazo']),
      ('calcular_scoring_cuenta_corriente', ARRAY['p_id_cliente','p_id_usuario','p_origen']),
      ('actualizar_scoring_cc', ARRAY['p_id_cliente','p_id_usuario','p_ajuste_manual','p_limite_credito','p_notas','p_recalcular']),
      ('actualizar_condiciones_credito_cc', ARRAY['p_id_cliente','p_id_usuario','p_porcentaje_interes_mensual',
        'p_porcentaje_interes_mora_mensual','p_dias_gracia','p_limite_credito','p_ajuste_manual','p_notas']),
      ('cc_registrar_intereses_devengados', ARRAY['p_id_cliente','p_id_usuario']),
      ('cc_registrar_pago', ARRAY['p_id_cliente','p_monto','p_fecha_pago','p_metodo_pago','p_url_comprobante',
        'p_id_usuario','p_referencia','p_notas','p_id_venta','p_detalle_medios','p_detalle_pago']),
      ('recalcular_scoring_cc_todos', ARRAY['p_id_usuario'])
    ) AS t(fn, args)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = r.fn
        AND r.args <@ COALESCE(p.proargnames, ARRAY[]::text[])
    ) THEN
      v_faltan := v_faltan || r.fn || ' ';
    END IF;
  END LOOP;

  IF v_faltan <> '' THEN
    RAISE EXCEPTION
      'No se aplicó nada: estas funciones no existen o sus parámetros se llaman distinto: %. Para ver las firmas vivas: SELECT proname, proargnames FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ''public'' AND (proname LIKE ''cc\_%%'' OR proname LIKE ''%%cuenta_corriente%%'' OR proname LIKE ''%%scoring%%'');',
      v_faltan;
  END IF;
END$$;

-- 1) Rol admin (administracion / gerencia, igual que isAdmin del front) --------------------------
CREATE OR REPLACE FUNCTION public.actor_es_admin_cc(p_actor_id integer)
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
      AND u.rol IN ('administracion', 'gerencia')
  );
$$;

REVOKE ALL ON FUNCTION public.actor_es_admin_cc(integer) FROM PUBLIC, anon, authenticated;

-- Estado efectivo de la ficha (mismo criterio que normalizeEstadoCc del front). NULL = no hay ficha.
CREATE OR REPLACE FUNCTION public.cc_estado_efectivo(p_id_cliente integer)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.estado IN ('aprobada', 'pendiente', 'rechazada') THEN c.estado
    WHEN COALESCE(c.alta_completa, false) THEN 'aprobada'
    ELSE 'pendiente'
  END
  FROM public.clientes_cuenta_corriente c
  WHERE c.id_cliente = p_id_cliente;
$$;

REVOKE ALL ON FUNCTION public.cc_estado_efectivo(integer) FROM PUBLIC, anon, authenticated;

-- 2) Alta / reenvío de solicitud ---------------------------------------------------------------
-- El solicitante es siempre el actor (antes venía del navegador: un vendedor podía hacerse pasar por
-- un admin y la alta quedaba aprobada). Una ficha ya aprobada solo la edita administración.
CREATE OR REPLACE FUNCTION public.cc_registrar_alta(
  p_actor_id integer,
  p_cuit text,
  p_razon_social text,
  p_condicion_iva text,
  p_email text,
  p_whatsapp text,
  p_persona_contacto text,
  p_domicilio text,
  p_localidad text,
  p_provincia text,
  p_codigo_postal text,
  p_url_constancia_afip text,
  p_url_estatuto text,
  p_url_comprobante_domicilio text,
  p_id_cliente integer DEFAULT NULL,
  p_tipo_cliente text DEFAULT 'empresa',
  p_nombre text DEFAULT NULL,
  p_apellido text DEFAULT NULL,
  p_url_documento_dni text DEFAULT NULL,
  p_url_pagare text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para registrar cuenta corriente';
  END IF;

  IF p_id_cliente IS NOT NULL
     AND public.cc_estado_efectivo(p_id_cliente) = 'aprobada'
     AND NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede modificar una cuenta corriente aprobada';
  END IF;

  RETURN to_jsonb(public.registrar_alta_cuenta_corriente(
    p_cuit => p_cuit,
    p_razon_social => p_razon_social,
    p_condicion_iva => p_condicion_iva,
    p_email => p_email,
    p_whatsapp => p_whatsapp,
    p_persona_contacto => p_persona_contacto,
    p_domicilio => p_domicilio,
    p_localidad => p_localidad,
    p_provincia => p_provincia,
    p_codigo_postal => p_codigo_postal,
    p_url_constancia_afip => p_url_constancia_afip,
    p_url_estatuto => p_url_estatuto,
    p_url_comprobante_domicilio => p_url_comprobante_domicilio,
    p_id_cliente => p_id_cliente,
    p_id_usuario_solicita => p_actor_id,
    p_tipo_cliente => p_tipo_cliente,
    p_nombre => p_nombre,
    p_apellido => p_apellido,
    p_url_documento_dni => p_url_documento_dni,
    p_url_pagare => p_url_pagare
  ));
END;
$$;

-- 3) Aprobar / rechazar (admin) ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_resolver_solicitud(
  p_actor_id integer,
  p_id_cliente integer,
  p_accion text,
  p_motivo_rechazo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede aprobar o rechazar cuentas corrientes';
  END IF;

  RETURN to_jsonb(public.resolver_solicitud_cuenta_corriente(
    p_id_cliente => p_id_cliente,
    p_accion => p_accion,
    p_id_usuario_revisor => p_actor_id,
    p_motivo_rechazo => p_motivo_rechazo
  ));
END;
$$;

-- 4) Scoring -----------------------------------------------------------------------------------------
-- Recalcular es derivado de los datos (no cambia límites ni saldos a mano): alcanza con actor activo.
CREATE OR REPLACE FUNCTION public.cc_calcular_scoring(
  p_actor_id integer,
  p_id_cliente integer,
  p_origen text DEFAULT 'automatico'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para calcular scoring';
  END IF;

  RETURN to_jsonb(public.calcular_scoring_cuenta_corriente(
    p_id_cliente => p_id_cliente,
    p_id_usuario => CASE WHEN p_origen = 'apertura' THEN NULL ELSE p_actor_id END,
    p_origen => p_origen
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_recalcular_scoring_todos(p_actor_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede recalcular el scoring de toda la cartera';
  END IF;

  RETURN to_jsonb(public.recalcular_scoring_cc_todos(p_id_usuario => p_actor_id));
END;
$$;

-- Ajuste manual / límite / notas (admin)
CREATE OR REPLACE FUNCTION public.cc_actualizar_scoring(
  p_actor_id integer,
  p_id_cliente integer,
  p_ajuste_manual integer DEFAULT NULL,
  p_limite_credito numeric DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede modificar scoring y límite de crédito';
  END IF;

  RETURN to_jsonb(public.actualizar_scoring_cc(
    p_id_cliente => p_id_cliente,
    p_id_usuario => p_actor_id,
    p_ajuste_manual => p_ajuste_manual,
    p_limite_credito => p_limite_credito,
    p_notas => p_notas,
    p_recalcular => true
  ));
END;
$$;

-- 5) Condiciones de crédito e intereses (admin) ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_actualizar_condiciones_credito(
  p_actor_id integer,
  p_id_cliente integer,
  p_porcentaje_interes_mensual numeric DEFAULT NULL,
  p_porcentaje_interes_mora_mensual numeric DEFAULT NULL,
  p_dias_gracia integer DEFAULT NULL,
  p_limite_credito numeric DEFAULT NULL,
  p_ajuste_manual integer DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede modificar las condiciones de crédito';
  END IF;

  RETURN to_jsonb(public.actualizar_condiciones_credito_cc(
    p_id_cliente => p_id_cliente,
    p_id_usuario => p_actor_id,
    p_porcentaje_interes_mensual => p_porcentaje_interes_mensual,
    p_porcentaje_interes_mora_mensual => p_porcentaje_interes_mora_mensual,
    p_dias_gracia => p_dias_gracia,
    p_limite_credito => p_limite_credito,
    p_ajuste_manual => p_ajuste_manual,
    p_notas => p_notas
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_registrar_intereses(
  p_actor_id integer,
  p_id_cliente integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede registrar intereses';
  END IF;

  RETURN to_jsonb(public.cc_registrar_intereses_devengados(
    p_id_cliente => p_id_cliente,
    p_id_usuario => p_actor_id
  ));
END;
$$;

-- 6) Pagos (cualquier usuario activo; queda registrado quién lo cargó) -------------------------------
CREATE OR REPLACE FUNCTION public.cc_registrar_pago_actor(
  p_actor_id integer,
  p_id_cliente integer,
  p_monto numeric,
  p_fecha_pago date,
  p_metodo_pago text DEFAULT NULL,
  p_url_comprobante text DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_id_venta integer DEFAULT NULL,
  p_detalle_medios jsonb DEFAULT NULL,
  p_detalle_pago jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para registrar pagos';
  END IF;

  RETURN to_jsonb(public.cc_registrar_pago(
    p_id_cliente => p_id_cliente,
    p_monto => p_monto,
    p_fecha_pago => p_fecha_pago,
    p_metodo_pago => p_metodo_pago,
    p_url_comprobante => p_url_comprobante,
    p_id_usuario => p_actor_id,
    p_referencia => p_referencia,
    p_notas => p_notas,
    p_id_venta => p_id_venta,
    p_detalle_medios => p_detalle_medios,
    p_detalle_pago => p_detalle_pago
  ));
END;
$$;

-- 7) Quitar de cartera -----------------------------------------------------------------------------
-- Reemplaza quitar_cliente_cuenta_corriente: pide actor, solo admin quita una ficha aprobada y nunca se
-- borra una cuenta con saldo (se perdía la deuda y su historial).
CREATE OR REPLACE FUNCTION public.cc_quitar_cliente(
  p_actor_id integer,
  p_id_cliente integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_saldo numeric;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para quitar clientes de cuenta corriente';
  END IF;
  IF p_id_cliente IS NULL OR p_id_cliente <= 0 THEN
    RAISE EXCEPTION 'id_cliente inválido';
  END IF;

  -- Bloquea la ficha: un pago que entra en paralelo no queda huérfano.
  PERFORM 1 FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_cliente FOR UPDATE;
  v_estado := public.cc_estado_efectivo(p_id_cliente);
  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'El cliente no está registrado en cuenta corriente';
  END IF;

  IF v_estado = 'aprobada' AND NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede quitar una cuenta corriente aprobada';
  END IF;

  SELECT COALESCE(SUM(COALESCE(debe, 0) - COALESCE(haber, 0)), 0)
  INTO v_saldo
  FROM public.cc_cuenta_movimientos
  WHERE id_cliente = p_id_cliente;

  IF abs(v_saldo) > 0.009 THEN
    RAISE EXCEPTION 'La cuenta tiene saldo de $% — registrá el pago o un ajuste antes de quitarla', round(v_saldo, 2);
  END IF;

  DELETE FROM public.cc_cuenta_movimientos WHERE id_cliente = p_id_cliente;
  DELETE FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_cliente;
END;
$$;

-- 8) Todo lo que toca las tablas CC corre como dueño ---------------------------------------------
-- Al revocar el DML anon (punto 10), una función SECURITY INVOKER que escriba estas tablas fallaría
-- (sincronizar ventas, resumen de saldos, triggers de ventas, alertas…). Se pasan a DEFINER.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT p.prosecdef
      AND (p.prosrc ILIKE '%clientes_cuenta_corriente%' OR p.prosrc ILIKE '%cc_cuenta_movimientos%')
  LOOP
    EXECUTE 'ALTER FUNCTION ' || r.sig || ' SECURITY DEFINER SET search_path = public';
    RAISE NOTICE 'Paso 26: % pasa a SECURITY DEFINER', r.sig;
  END LOOP;
END$$;

-- 9) Cerrar las originales (cualquier firma que exista en la base) -----------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'registrar_alta_cuenta_corriente',
        'resolver_solicitud_cuenta_corriente',
        'calcular_scoring_cuenta_corriente',
        'actualizar_scoring_cc',
        'actualizar_condiciones_credito_cc',
        'cc_registrar_intereses_devengados',
        'cc_registrar_pago',
        'recalcular_scoring_cc_todos',
        'quitar_cliente_cuenta_corriente',
        'agregar_cliente_cuenta_corriente'
      )
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO service_role';
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION public.cc_registrar_alta(integer, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_resolver_solicitud(integer, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_calcular_scoring(integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_recalcular_scoring_todos(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_actualizar_scoring(integer, integer, integer, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_actualizar_condiciones_credito(integer, integer, numeric, numeric, integer, numeric, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_registrar_intereses(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_registrar_pago_actor(integer, integer, numeric, date, text, text, text, text, integer, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_quitar_cliente(integer, integer) TO anon, authenticated;

-- 10) Tablas: solo SELECT para anon / authenticated ---------------------------------------------------
ALTER TABLE public.clientes_cuenta_corriente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_cuenta_movimientos ENABLE ROW LEVEL SECURITY;

-- Las policies vivas se crearon a mano (cc_rls_anon_plotrello): se borran todas y queda una de lectura.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('clientes_cuenta_corriente', 'cc_cuenta_movimientos')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END$$;

CREATE POLICY clientes_cc_select_anon ON public.clientes_cuenta_corriente
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY cc_movimientos_select_anon ON public.cc_cuenta_movimientos
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clientes_cuenta_corriente FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.cc_cuenta_movimientos FROM anon, authenticated;

GRANT SELECT ON TABLE public.clientes_cuenta_corriente TO anon, authenticated;
GRANT SELECT ON TABLE public.cc_cuenta_movimientos TO anon, authenticated;

-- 11) Documentos del alta en bucket privado ----------------------------------------------------------
-- El front sube (solo INSERT, sin upsert) y los ve con URL firmada que emite /api/erp/cc-documento-url
-- (JWT staff + service_role). Sin SELECT para anon: no se pueden listar ni leer con la clave pública.
INSERT INTO storage.buckets (id, name, public)
VALUES ('cc-documentos', 'cc-documentos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS cc_documentos_insert ON storage.objects;
CREATE POLICY cc_documentos_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'cc-documentos');

COMMENT ON FUNCTION public.cc_quitar_cliente(integer, integer) IS
  'Paso 26: quitar de cartera con actor; admin para aprobadas; rechaza si hay saldo.';

COMMIT;
