-- Reparación: GRANT + reload PostgREST (la función ya debe existir).
-- Si no existe ninguna crear_atencion_mostrador, ejecutá antes:
--   supabase/patches/2026-05-13_recover_crear_atencion_mostrador_full.sql

DO $$
DECLARE
  fn text;
BEGIN
  SELECT p.oid::regprocedure::text
  INTO fn
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'crear_atencion_mostrador'
  ORDER BY p.oid DESC
  LIMIT 1;
  IF fn IS NULL THEN
    RAISE NOTICE 'No hay función crear_atencion_mostrador. Ejecutá el patch 2026-05-13_recover_crear_atencion_mostrador_full.sql';
    RETURN;
  END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', fn);
END$$;

NOTIFY pgrst, 'reload schema';
