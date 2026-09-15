-- Paso 18 seguridad (caja): REVOKE DML en movimientos/arqueos/cierres.
-- Lecturas: SELECT sigue para el front. Escrituras: solo RPCs DEFINER (Paso 17).
-- Triggers PlotLab (SECURITY DEFINER / owner) no usan grants de anon.

CREATE OR REPLACE FUNCTION public.caja_delete_arqueo(
  p_actor_id integer,
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  IF p_actor_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado para borrar arqueos de caja';
  END IF;

  SELECT a.caja_slug INTO v_slug
  FROM public.control_caja_arqueos a
  WHERE a.id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug) THEN
    RAISE EXCEPTION 'No autorizado para borrar arqueos de caja';
  END IF;

  DELETE FROM public.control_caja_arqueos WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_delete_arqueo(integer, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.caja_delete_cierre(
  p_actor_id integer,
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  IF p_actor_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado para borrar cierres de caja';
  END IF;

  SELECT c.caja_slug INTO v_slug
  FROM public.control_caja_cierres c
  WHERE c.id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug) THEN
    RAISE EXCEPTION 'No autorizado para borrar cierres de caja';
  END IF;

  -- Desvincular movimientos del cierre (mismo actor)
  UPDATE public.control_caja_movimientos m
  SET cierre_id = NULL, updated_at = now()
  WHERE m.cierre_id = p_id
    AND public.actor_puede_grabar_movimiento_caja(p_actor_id, m.origen_slug, m.destino_slug);

  DELETE FROM public.control_caja_cierres WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_delete_cierre(integer, uuid) TO anon, authenticated;

-- Policies: solo SELECT abierto. Sin DML via PostgREST.
DROP POLICY IF EXISTS control_caja_movimientos_all ON public.control_caja_movimientos;
CREATE POLICY control_caja_movimientos_select ON public.control_caja_movimientos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_arqueos_all ON public.control_caja_arqueos;
CREATE POLICY control_caja_arqueos_select ON public.control_caja_arqueos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_cierres_all ON public.control_caja_cierres;
CREATE POLICY control_caja_cierres_select ON public.control_caja_cierres
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_movimientos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_movimientos FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_arqueos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_arqueos FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_cierres FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_cierres FROM authenticated;

GRANT SELECT ON TABLE public.control_caja_movimientos TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_arqueos TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_cierres TO anon, authenticated;

COMMENT ON TABLE public.control_caja_movimientos IS
  'Paso 18: anon solo SELECT. Escrituras vía caja_upsert_movimiento / caja_delete_movimiento.';
COMMENT ON TABLE public.control_caja_arqueos IS
  'Paso 18: anon solo SELECT. Escrituras vía caja_upsert_arqueo / caja_delete_arqueo.';
COMMENT ON TABLE public.control_caja_cierres IS
  'Paso 18: anon solo SELECT. Escrituras vía caja_upsert_cierre / caja_delete_cierre.';
