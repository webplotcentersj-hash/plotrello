-- =============================================================================
-- RRHH Notificador Masivo: fix "Quitar comunicado" que elimina 0.
--
-- Causa: la función eliminaba comparando contra `p_descripcion` trimmeada,
-- pero `user_notifications.description` podía tener espacios/saltos extra.
--
-- Solución: comparar `trim()` en ambos lados.
-- Aplicar en Supabase: SQL Editor → Run.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.eliminar_comunicado_rrhh_masivo(
  p_usuario_id integer,
  p_titulo text,
  p_descripcion text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('recursos-humanos', 'administracion')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.user_notifications un
  WHERE un.origen = 'rrhh_masivo'
    AND un.title = p_titulo
    AND COALESCE(trim(un.description), '') = COALESCE(trim(p_descripcion), '');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'eliminadas', v_count
  );
END;
$$;

COMMIT;

