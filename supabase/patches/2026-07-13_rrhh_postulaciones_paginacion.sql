-- Paginación de a 50 + filtro tipo (cv / formulario). Metadata liviana.

DROP FUNCTION IF EXISTS public.rrhh_postulaciones_listar(integer, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.rrhh_postulaciones_listar(
  p_usuario_id integer,
  p_busqueda text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_puesto text DEFAULT NULL,
  p_limite integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_tipo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busqueda text;
  v_tipo text;
BEGIN
  IF NOT public._rrhh_es_gestor_postulaciones(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_busqueda := nullif(trim(p_busqueda), '');
  v_tipo := lower(nullif(trim(p_tipo), ''));

  RETURN coalesce(
    (
      SELECT jsonb_agg(row_to_json(s)::jsonb ORDER BY s.created_at DESC)
      FROM (
        SELECT
          p.id,
          p.legacy_id,
          p.nombre,
          p.email,
          p.telefono,
          p.puesto,
          p.categoria_puesto,
          left(coalesce(p.mensaje, ''), 500) AS mensaje,
          p.cv_url,
          p.cv_nombre,
          p.cv_mime,
          p.estado,
          public._rrhh_metadata_ia_lista(p.metadata_ia) AS metadata_ia,
          p.score_ia,
          p.notas_rrhh,
          p.created_at,
          p.updated_at,
          p.revisado_por,
          p.revisado_at
        FROM public.rrhh_postulaciones p
        WHERE (p_estado IS NULL OR p_estado = '' OR p.estado = p_estado)
          AND (p_puesto IS NULL OR p_puesto = '' OR p.puesto = p_puesto)
          AND (
            v_tipo IS NULL
            OR (v_tipo = 'cv' AND coalesce(trim(p.cv_url), '') <> '')
            OR (v_tipo = 'formulario' AND coalesce(p.metadata_ia->>'tipo', '') = 'formulario_externo')
          )
          AND (
            v_busqueda IS NULL
            OR p.nombre ILIKE '%' || v_busqueda || '%'
            OR p.email ILIKE '%' || v_busqueda || '%'
            OR p.puesto ILIKE '%' || v_busqueda || '%'
            OR coalesce(p.mensaje, '') ILIKE '%' || v_busqueda || '%'
            OR coalesce(p.metadata_ia->>'resumen', '') ILIKE '%' || v_busqueda || '%'
          )
        ORDER BY p.created_at DESC
        LIMIT greatest(1, least(coalesce(p_limite, 50), 100))
        OFFSET greatest(0, coalesce(p_offset, 0))
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

DROP FUNCTION IF EXISTS public.rrhh_postulaciones_contar(integer, text, text, text);

CREATE OR REPLACE FUNCTION public.rrhh_postulaciones_contar(
  p_usuario_id integer,
  p_busqueda text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_puesto text DEFAULT NULL,
  p_tipo text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busqueda text;
  v_tipo text;
  v_total integer;
BEGIN
  IF NOT public._rrhh_es_gestor_postulaciones(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_busqueda := nullif(trim(p_busqueda), '');
  v_tipo := lower(nullif(trim(p_tipo), ''));

  SELECT COUNT(*)::integer INTO v_total
  FROM public.rrhh_postulaciones p
  WHERE (p_estado IS NULL OR p_estado = '' OR p.estado = p_estado)
    AND (p_puesto IS NULL OR p_puesto = '' OR p.puesto = p_puesto)
    AND (
      v_tipo IS NULL
      OR (v_tipo = 'cv' AND coalesce(trim(p.cv_url), '') <> '')
      OR (v_tipo = 'formulario' AND coalesce(p.metadata_ia->>'tipo', '') = 'formulario_externo')
    )
    AND (
      v_busqueda IS NULL
      OR p.nombre ILIKE '%' || v_busqueda || '%'
      OR p.email ILIKE '%' || v_busqueda || '%'
      OR p.puesto ILIKE '%' || v_busqueda || '%'
      OR coalesce(p.mensaje, '') ILIKE '%' || v_busqueda || '%'
      OR coalesce(p.metadata_ia->>'resumen', '') ILIKE '%' || v_busqueda || '%'
    );

  RETURN coalesce(v_total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_postulaciones_listar(integer, text, text, text, integer, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rrhh_postulaciones_contar(integer, text, text, text, text) TO anon, authenticated, service_role;
