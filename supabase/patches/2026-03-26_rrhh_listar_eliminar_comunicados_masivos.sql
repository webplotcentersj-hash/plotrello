-- Listar y eliminar comunicados del notificador masivo RRHH (solo rol RRHH / administración).

CREATE OR REPLACE FUNCTION public.listar_comunicados_rrhh_masivos(p_usuario_id integer)
RETURNS TABLE (
  titulo text,
  descripcion text,
  tipo text,
  ultima timestamptz,
  copias bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('recursos-humanos', 'administracion')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    un.title::text,
    COALESCE(un.description, '')::text,
    un.type::text,
    max(un."timestamp") AS ultima,
    count(*)::bigint AS copias
  FROM public.user_notifications un
  WHERE un.origen = 'rrhh_masivo'
  GROUP BY un.title, un.description, un.type
  ORDER BY max(un."timestamp") DESC
  LIMIT 50;
END;
$$;

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
    AND COALESCE(un.description, '') = COALESCE(NULLIF(trim(p_descripcion), ''), '');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'eliminadas', v_count
  );
END;
$$;

COMMENT ON FUNCTION public.listar_comunicados_rrhh_masivos(integer) IS
  'Agrupa comunicados enviados con origen rrhh_masivo (notificador masivo).';

COMMENT ON FUNCTION public.eliminar_comunicado_rrhh_masivo(integer, text, text) IS
  'Quita todas las copias de un comunicado masivo (mismo título y descripción).';

GRANT EXECUTE ON FUNCTION public.listar_comunicados_rrhh_masivos(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_comunicado_rrhh_masivo(integer, text, text) TO anon, authenticated;
