-- Listado liviano: no enviar metadata_ia completa (congela el cliente con 500+ postulaciones importadas).

CREATE OR REPLACE FUNCTION public._rrhh_metadata_ia_lista(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR p = '{}'::jsonb THEN '{}'::jsonb
    ELSE jsonb_strip_nulls(
      jsonb_build_object(
        'resumen', left(nullif(trim(p->>'resumen'), ''), 400),
        'habilidades',
          CASE
            WHEN jsonb_typeof(p->'habilidades') = 'array' THEN p->'habilidades'
            ELSE NULL
          END,
        'score_plot', p->'score_plot',
        'tipo', nullif(p->>'tipo', ''),
        'slug', nullif(p->>'slug', ''),
        'respuestas',
          CASE
            WHEN p->>'tipo' = 'formulario_externo' THEN jsonb_strip_nulls(
              jsonb_build_object(
                'motivacion_plot', left(nullif(p#>>'{respuestas,motivacion_plot}', ''), 400)
              )
            )
            ELSE NULL
          END
      )
    )
  END;
$$;

CREATE INDEX IF NOT EXISTS idx_rrhh_postulaciones_estado_created
  ON public.rrhh_postulaciones (estado, created_at DESC);

CREATE OR REPLACE FUNCTION public.rrhh_postulaciones_listar(
  p_usuario_id integer,
  p_busqueda text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_puesto text DEFAULT NULL,
  p_limite integer DEFAULT 80
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
            v_busqueda IS NULL
            OR p.nombre ILIKE '%' || v_busqueda || '%'
            OR p.email ILIKE '%' || v_busqueda || '%'
            OR p.puesto ILIKE '%' || v_busqueda || '%'
            OR coalesce(p.mensaje, '') ILIKE '%' || v_busqueda || '%'
            OR coalesce(p.metadata_ia->>'resumen', '') ILIKE '%' || v_busqueda || '%'
          )
        ORDER BY p.created_at DESC
        LIMIT greatest(1, least(coalesce(p_limite, 80), 200))
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rrhh_postulaciones_contar(
  p_usuario_id integer,
  p_busqueda text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_puesto text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busqueda text;
  v_total integer;
BEGIN
  IF NOT public._rrhh_es_gestor_postulaciones(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_busqueda := nullif(trim(p_busqueda), '');

  SELECT COUNT(*)::integer INTO v_total
  FROM public.rrhh_postulaciones p
  WHERE (p_estado IS NULL OR p_estado = '' OR p.estado = p_estado)
    AND (p_puesto IS NULL OR p_puesto = '' OR p.puesto = p_puesto)
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
