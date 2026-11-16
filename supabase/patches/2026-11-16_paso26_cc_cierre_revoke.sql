-- Paso 26 cierre: completar wrappers faltantes + REVOKE legacy + tablas CC solo SELECT.
-- Idempotente. El front ya llama cc_* con p_actor_id.

-- ---------------------------------------------------------------------------
-- Wrappers que faltaban en prod (front ya los usa)
-- ---------------------------------------------------------------------------
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
SET search_path TO 'public'
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
SET search_path TO 'public'
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

-- ---------------------------------------------------------------------------
-- Funciones INVOKER que tocan tablas CC → SECURITY DEFINER
-- ---------------------------------------------------------------------------
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
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- Cerrar RPC legacy (cualquier firma)
-- ---------------------------------------------------------------------------
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

-- Wrappers públicos (firmas vivas en prod)
GRANT EXECUTE ON FUNCTION public.cc_registrar_alta(integer, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_resolver_solicitud(integer, integer, text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_calcular_scoring(integer, integer, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_recalcular_scoring_todos(integer)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_actualizar_scoring(integer, integer, integer, numeric, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_actualizar_condiciones_credito(integer, integer, numeric, numeric, integer, numeric, integer, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_registrar_intereses(integer, integer)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_registrar_pago_actor(integer, integer, numeric, date, text, text, text, text, integer, jsonb, jsonb)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_quitar_cliente(integer, integer)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tablas: solo SELECT
-- ---------------------------------------------------------------------------
ALTER TABLE public.clientes_cuenta_corriente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_cuenta_movimientos ENABLE ROW LEVEL SECURITY;

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
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
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

-- Bucket documentos (idempotente; ya existe privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cc-documentos', 'cc-documentos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS cc_documentos_insert ON storage.objects;
CREATE POLICY cc_documentos_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'cc-documentos');

COMMENT ON FUNCTION public.cc_actualizar_scoring(integer, integer, integer, numeric, text) IS
  'Paso 26: ajuste scoring/límite con actor admin/gerencia.';
COMMENT ON FUNCTION public.cc_actualizar_condiciones_credito(integer, integer, numeric, numeric, integer, numeric, integer, text) IS
  'Paso 26: condiciones de crédito con actor admin/gerencia.';
