-- RPC: borrar adjuntos (enlaces_adjuntos) por URL en todo el grupo OP (original + duplicadas).
-- Motivo: con RLS, el cliente puede no poder borrar filas asociadas a otras fichas del mismo numero_op / id_orden_original.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_enlaces_adjuntos_grupo(p_orden_id integer, p_url text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  root_id integer;
  numero_op_comun text;
  eliminadas integer := 0;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RETURN 0;
  END IF;

  SELECT
    CASE
      WHEN ot.es_duplicado = true AND ot.id_orden_original IS NOT NULL THEN ot.id_orden_original
      ELSE ot.id
    END,
    ot.numero_op
  INTO root_id, numero_op_comun
  FROM public.ordenes_trabajo ot
  WHERE ot.id = p_orden_id;

  IF root_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH ids AS (
    SELECT ot2.id
    FROM public.ordenes_trabajo ot2
    WHERE ot2.id = root_id
       OR ot2.id_orden_original = root_id
       OR (ot2.id_orden_original IS NULL AND numero_op_comun IS NOT NULL AND ot2.numero_op = numero_op_comun)
  ),
  del AS (
    DELETE FROM public.enlaces_adjuntos ea
    USING ids
    WHERE ea.id_orden = ids.id
      AND ea.url = btrim(p_url)
    RETURNING ea.id
  )
  SELECT count(*)::int INTO eliminadas FROM del;

  RETURN coalesce(eliminadas, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_enlaces_adjuntos_grupo(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_enlaces_adjuntos_grupo(integer, text) TO anon;

-- La web usa login_usuario (sin sesión JWT): las llamadas REST van como rol `anon`.
-- Sin estos permisos, el fallback .delete() desde el cliente falla aunque el RPC exista (si PostgREST no puede ejecutar la función o no está desplegada).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enlaces_adjuntos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enlaces_adjuntos TO authenticated;

-- Si la tabla tiene RLS activado, GRANT solo no alcanza: políticas permisivas para anon/authenticated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'enlaces_adjuntos'
      AND rowsecurity = true
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'enlaces_adjuntos'
        AND policyname = 'enlaces_adjuntos_anon_all'
    ) THEN
      CREATE POLICY "enlaces_adjuntos_anon_all" ON public.enlaces_adjuntos
        FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'enlaces_adjuntos'
        AND policyname = 'enlaces_adjuntos_authenticated_all'
    ) THEN
      CREATE POLICY "enlaces_adjuntos_authenticated_all" ON public.enlaces_adjuntos
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

COMMIT;
