-- Paso 6.1 — historial_movimientos: activar RLS, permitir lectura/escritura staff (anon), bloquear DELETE

BEGIN;

ALTER TABLE public.historial_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historial_movimientos_anon_select ON public.historial_movimientos;
CREATE POLICY historial_movimientos_anon_select
  ON public.historial_movimientos FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS historial_movimientos_anon_insert ON public.historial_movimientos;
CREATE POLICY historial_movimientos_anon_insert
  ON public.historial_movimientos FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS historial_movimientos_anon_update ON public.historial_movimientos;
CREATE POLICY historial_movimientos_anon_update
  ON public.historial_movimientos FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

REVOKE DELETE, TRUNCATE ON public.historial_movimientos FROM anon;

COMMIT;
