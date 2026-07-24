-- Sábados por medio: configuración por empleado (todos / semana ISO par / impar).
-- Usado por RRHH → Turnos para armar la grilla del sábado.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rrhh_sabado_medio (
  id_usuario integer PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  modo text NOT NULL DEFAULT 'todos'
    CHECK (modo IN ('todos', 'par', 'impar')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES public.usuarios(id)
);

COMMENT ON TABLE public.rrhh_sabado_medio IS
  'Regla de sábados por medio por empleado: todos, semanas ISO pares o impares.';

ALTER TABLE public.rrhh_sabado_medio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrhh_sabado_medio_select" ON public.rrhh_sabado_medio;
CREATE POLICY "rrhh_sabado_medio_select" ON public.rrhh_sabado_medio
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rrhh_sabado_medio_insert" ON public.rrhh_sabado_medio;
CREATE POLICY "rrhh_sabado_medio_insert" ON public.rrhh_sabado_medio
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rrhh_sabado_medio_update" ON public.rrhh_sabado_medio;
CREATE POLICY "rrhh_sabado_medio_update" ON public.rrhh_sabado_medio
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rrhh_sabado_medio_delete" ON public.rrhh_sabado_medio;
CREATE POLICY "rrhh_sabado_medio_delete" ON public.rrhh_sabado_medio
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rrhh_sabado_medio TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_sabado_medio(
  p_id_usuario integer,
  p_modo text,
  p_updated_by integer DEFAULT NULL
)
RETURNS public.rrhh_sabado_medio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modo text := lower(trim(COALESCE(p_modo, 'todos')));
  v_result public.rrhh_sabado_medio;
BEGIN
  IF p_id_usuario IS NULL OR p_id_usuario <= 0 THEN
    RAISE EXCEPTION 'id_usuario inválido';
  END IF;

  IF v_modo NOT IN ('todos', 'par', 'impar') THEN
    RAISE EXCEPTION 'modo inválido: % (usar todos|par|impar)', p_modo;
  END IF;

  INSERT INTO public.rrhh_sabado_medio (id_usuario, modo, updated_at, updated_by)
  VALUES (p_id_usuario, v_modo, now(), p_updated_by)
  ON CONFLICT (id_usuario) DO UPDATE
    SET modo = EXCLUDED.modo,
        updated_at = now(),
        updated_by = COALESCE(EXCLUDED.updated_by, public.rrhh_sabado_medio.updated_by)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_sabados_medio()
RETURNS TABLE (id_usuario integer, modo text, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id_usuario, s.modo, s.updated_at
  FROM public.rrhh_sabado_medio s
  ORDER BY s.id_usuario;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_sabado_medio(integer, text, integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obtener_sabados_medio()
  TO anon, authenticated, service_role;

COMMIT;
