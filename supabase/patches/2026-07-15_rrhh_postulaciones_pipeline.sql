-- Pipeline selección: oferta / ingresado + fechas de etapa + id_usuario + funnel

-- 1) Migrar datos y CHECK de estado
UPDATE public.rrhh_postulaciones
SET estado = 'oferta'
WHERE estado = 'aprobado';

ALTER TABLE public.rrhh_postulaciones
  DROP CONSTRAINT IF EXISTS rrhh_postulaciones_estado_check;

ALTER TABLE public.rrhh_postulaciones
  ADD CONSTRAINT rrhh_postulaciones_estado_check
  CHECK (estado = ANY (ARRAY[
    'nuevo'::text,
    'en_revision'::text,
    'entrevista'::text,
    'oferta'::text,
    'ingresado'::text,
    'descartado'::text
  ]));

-- 2) Columnas de tracking / vínculo
ALTER TABLE public.rrhh_postulaciones
  ADD COLUMN IF NOT EXISTS entrevista_at timestamptz;

ALTER TABLE public.rrhh_postulaciones
  ADD COLUMN IF NOT EXISTS oferta_at timestamptz;

ALTER TABLE public.rrhh_postulaciones
  ADD COLUMN IF NOT EXISTS ingresado_at timestamptz;

ALTER TABLE public.rrhh_postulaciones
  ADD COLUMN IF NOT EXISTS id_usuario integer REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rrhh_postulaciones_entrevista_at
  ON public.rrhh_postulaciones (entrevista_at)
  WHERE entrevista_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rrhh_postulaciones_id_usuario
  ON public.rrhh_postulaciones (id_usuario)
  WHERE id_usuario IS NOT NULL;

-- Backfill timestamps aproximados para filas ya en etapa (histórico)
UPDATE public.rrhh_postulaciones
SET entrevista_at = coalesce(entrevista_at, revisado_at, updated_at, created_at)
WHERE estado IN ('entrevista', 'oferta', 'ingresado')
  AND entrevista_at IS NULL;

UPDATE public.rrhh_postulaciones
SET oferta_at = coalesce(oferta_at, revisado_at, updated_at, created_at)
WHERE estado IN ('oferta', 'ingresado')
  AND oferta_at IS NULL;

UPDATE public.rrhh_postulaciones
SET ingresado_at = coalesce(ingresado_at, revisado_at, updated_at, created_at)
WHERE estado = 'ingresado'
  AND ingresado_at IS NULL;

-- 3) Actualizar estado con timestamps y vínculo usuario
DROP FUNCTION IF EXISTS public.rrhh_postulacion_actualizar_estado(integer, bigint, text, text);

CREATE OR REPLACE FUNCTION public.rrhh_postulacion_actualizar_estado(
  p_usuario_id integer,
  p_id bigint,
  p_estado text,
  p_notas_rrhh text DEFAULT NULL,
  p_entrevista_at timestamptz DEFAULT NULL,
  p_id_usuario integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.rrhh_postulaciones%ROWTYPE;
  v_prev_entrevista timestamptz;
BEGIN
  IF NOT public._rrhh_es_gestor_postulaciones(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_estado NOT IN ('nuevo', 'en_revision', 'entrevista', 'oferta', 'ingresado', 'descartado') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  SELECT entrevista_at INTO v_prev_entrevista
  FROM public.rrhh_postulaciones
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Postulación no encontrada';
  END IF;

  IF p_estado = 'entrevista' AND p_entrevista_at IS NULL AND v_prev_entrevista IS NULL THEN
    RAISE EXCEPTION 'Fecha de entrevista requerida';
  END IF;

  UPDATE public.rrhh_postulaciones
     SET estado = p_estado,
         notas_rrhh = coalesce(nullif(trim(p_notas_rrhh), ''), notas_rrhh),
         revisado_por = p_usuario_id,
         revisado_at = now(),
         updated_at = now(),
         entrevista_at = CASE
           WHEN p_estado = 'entrevista' AND p_entrevista_at IS NOT NULL THEN p_entrevista_at
           WHEN p_estado = 'entrevista' THEN entrevista_at
           WHEN p_entrevista_at IS NOT NULL THEN p_entrevista_at
           ELSE entrevista_at
         END,
         oferta_at = CASE
           WHEN p_estado = 'oferta' THEN coalesce(oferta_at, now())
           ELSE oferta_at
         END,
         ingresado_at = CASE
           WHEN p_estado = 'ingresado' THEN coalesce(ingresado_at, now())
           ELSE ingresado_at
         END,
         id_usuario = CASE
           WHEN p_id_usuario IS NOT NULL THEN p_id_usuario
           ELSE id_usuario
         END
   WHERE id = p_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Postulación no encontrada';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_postulacion_actualizar_estado(integer, bigint, text, text, timestamptz, integer)
  TO anon, authenticated, service_role;

-- 4) Listar incluye columnas nuevas
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
          p.revisado_at,
          p.entrevista_at,
          p.oferta_at,
          p.ingresado_at,
          p.id_usuario
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

GRANT EXECUTE ON FUNCTION public.rrhh_postulaciones_listar(integer, text, text, text, integer, integer, text)
  TO anon, authenticated, service_role;

-- 5) Funnel de conversión
CREATE OR REPLACE FUNCTION public.rrhh_postulaciones_funnel(
  p_usuario_id integer,
  p_tipo text DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
BEGIN
  IF NOT public._rrhh_es_gestor_postulaciones(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_tipo := lower(nullif(trim(p_tipo), ''));

  RETURN (
    SELECT jsonb_build_object(
      'postulan', COUNT(*)::integer,
      'en_revision', COUNT(*) FILTER (WHERE p.estado = 'en_revision' OR p.revisado_at IS NOT NULL)::integer,
      'entrevista', COUNT(*) FILTER (WHERE p.entrevista_at IS NOT NULL OR p.estado IN ('entrevista', 'oferta', 'ingresado'))::integer,
      'oferta', COUNT(*) FILTER (WHERE p.oferta_at IS NOT NULL OR p.estado IN ('oferta', 'ingresado'))::integer,
      'ingresado', COUNT(*) FILTER (WHERE p.ingresado_at IS NOT NULL OR p.estado = 'ingresado')::integer,
      'descartado', COUNT(*) FILTER (WHERE p.estado = 'descartado')::integer
    )
    FROM public.rrhh_postulaciones p
    WHERE (p_fecha_desde IS NULL OR p.created_at::date >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR p.created_at::date <= p_fecha_hasta)
      AND (
        v_tipo IS NULL
        OR (v_tipo = 'cv' AND coalesce(trim(p.cv_url), '') <> '')
        OR (v_tipo = 'formulario' AND coalesce(p.metadata_ia->>'tipo', '') = 'formulario_externo')
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_postulaciones_funnel(integer, text, date, date)
  TO anon, authenticated, service_role;
