-- Paso 6.1 — Activar RLS en ordenes_trabajo (existían policies pero relrowsecurity=false)
-- No revoca SELECT anon todavía (kanban staff sigue con anon key). Cierra DELETE físico.
-- Seguimiento público sigue vía get_orden_seguimiento_publico (SECURITY DEFINER).

BEGIN;

ALTER TABLE public.ordenes_trabajo ENABLE ROW LEVEL SECURITY;

-- Staff PlotLab usa rol Postgres `anon` (anon key). Las policies `authenticated` no aplican.
DROP POLICY IF EXISTS ordenes_trabajo_anon_insert ON public.ordenes_trabajo;
CREATE POLICY ordenes_trabajo_anon_insert
  ON public.ordenes_trabajo FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS ordenes_trabajo_anon_update ON public.ordenes_trabajo;
CREATE POLICY ordenes_trabajo_anon_update
  ON public.ordenes_trabajo FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- SELECT: se mantiene abierto en 6.1 (Paso 6.2 cerrará con RPC list_ordenes_trabajo_tablero)
DROP POLICY IF EXISTS ordenes_trabajo_anon_select ON public.ordenes_trabajo;
CREATE POLICY ordenes_trabajo_anon_select
  ON public.ordenes_trabajo FOR SELECT TO anon
  USING (true);

-- Sin policy DELETE para anon → denegado con RLS activo
REVOKE DELETE, TRUNCATE ON public.ordenes_trabajo FROM anon;

-- RPC tablero (preparación Paso 6.2 — mismo dataset que getOrdenes, vía DEFINER)
CREATE OR REPLACE FUNCTION public.list_ordenes_trabajo_tablero(p_limit integer DEFAULT 800)
RETURNS SETOF public.ordenes_trabajo
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.*
  FROM public.ordenes_trabajo o
  ORDER BY o.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 800), 2500));
$$;

COMMENT ON FUNCTION public.list_ordenes_trabajo_tablero(integer) IS
  'Listado kanban staff. Paso 6.2: revocar SELECT directo anon y usar solo esta RPC.';

GRANT EXECUTE ON FUNCTION public.list_ordenes_trabajo_tablero(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.list_ordenes_trabajo_tablero(integer) TO authenticated;

COMMIT;
