-- Aumentar límite de listado RRHH postulaciones (base ~560+ candidatos)

CREATE OR REPLACE FUNCTION public.rrhh_postulaciones_listar(
  p_usuario_id integer,
  p_busqueda text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_puesto text DEFAULT NULL,
  p_limite integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busqueda text;
BEGIN
  IF NOT public._rrhh_es_gestor_postulaciones(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_busqueda := nullif(trim(p_busqueda), '');

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
          p.mensaje,
          p.cv_url,
          p.cv_nombre,
          p.cv_mime,
          p.estado,
          p.metadata_ia,
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
            v_busqueda IS NULL
            OR p.nombre ILIKE '%' || v_busqueda || '%'
            OR p.email ILIKE '%' || v_busqueda || '%'
            OR p.puesto ILIKE '%' || v_busqueda || '%'
            OR coalesce(p.mensaje, '') ILIKE '%' || v_busqueda || '%'
            OR coalesce(p.metadata_ia::text, '') ILIKE '%' || v_busqueda || '%'
          )
        ORDER BY p.created_at DESC
        LIMIT greatest(1, least(coalesce(p_limite, 2000), 5000))
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;
