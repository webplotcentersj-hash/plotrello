-- Hotfix: la app Plotrello usa rol `anon` (login vía RPC, no Supabase Auth).
-- Las políticas "TO authenticated" bloqueaban INSERT. Alinear con solicitudes_permisos.

BEGIN;

DROP POLICY IF EXISTS "rrhh_novedades_select_authenticated" ON public.rrhh_novedades;
DROP POLICY IF EXISTS "rrhh_novedades_insert_authenticated" ON public.rrhh_novedades;
DROP POLICY IF EXISTS "rrhh_novedades_update_authenticated" ON public.rrhh_novedades;
DROP POLICY IF EXISTS "rrhh_novedades_delete_authenticated" ON public.rrhh_novedades;

DROP POLICY IF EXISTS "rrhh_novedades_select" ON public.rrhh_novedades;
DROP POLICY IF EXISTS "rrhh_novedades_insert" ON public.rrhh_novedades;
DROP POLICY IF EXISTS "rrhh_novedades_update" ON public.rrhh_novedades;
DROP POLICY IF EXISTS "rrhh_novedades_delete" ON public.rrhh_novedades;

CREATE POLICY "rrhh_novedades_select" ON public.rrhh_novedades FOR SELECT USING (true);
CREATE POLICY "rrhh_novedades_insert" ON public.rrhh_novedades FOR INSERT WITH CHECK (true);
CREATE POLICY "rrhh_novedades_update" ON public.rrhh_novedades FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_novedades_delete" ON public.rrhh_novedades FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rrhh_novedades TO anon, authenticated, service_role;

COMMIT;
