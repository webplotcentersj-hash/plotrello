-- Lectura del historial de bajas para panel RRHH (indicadores y personal de baja).

BEGIN;

ALTER TABLE public.usuarios_bajas_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_bajas_log_select" ON public.usuarios_bajas_log;

CREATE POLICY "usuarios_bajas_log_select" ON public.usuarios_bajas_log
  FOR SELECT USING (true);

GRANT SELECT ON public.usuarios_bajas_log TO anon, authenticated, service_role;

COMMIT;
