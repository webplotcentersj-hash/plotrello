-- Pruebas: puntos por pregunta, % aprobación, autocalificación MC, calificación manual desarrollo, estadísticas.
-- Requiere haber aplicado antes 2026-03-26_pruebas_rrhh_conocimiento.sql

BEGIN;

ALTER TABLE public.pruebas_conocimiento
  ADD COLUMN IF NOT EXISTS porcentaje_aprobacion integer NOT NULL DEFAULT 60
  CHECK (porcentaje_aprobacion >= 1 AND porcentaje_aprobacion <= 100);

ALTER TABLE public.pruebas_preguntas
  ADD COLUMN IF NOT EXISTS puntos numeric(10, 2) NOT NULL DEFAULT 1 CHECK (puntos > 0);

ALTER TABLE public.pruebas_asignaciones
  ADD COLUMN IF NOT EXISTS puntaje_obtenido numeric(12, 2),
  ADD COLUMN IF NOT EXISTS puntaje_maximo numeric(12, 2),
  ADD COLUMN IF NOT EXISTS aprobado boolean,
  ADD COLUMN IF NOT EXISTS calificacion_pendiente boolean NOT NULL DEFAULT false;

ALTER TABLE public.pruebas_respuestas
  ADD COLUMN IF NOT EXISTS puntos_obtenidos numeric(10, 2) CHECK (puntos_obtenidos IS NULL OR puntos_obtenidos >= 0);

-- Helpers
CREATE OR REPLACE FUNCTION public._prueba_aplicar_autocalificacion_mc(p_id_asignacion uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pruebas_respuestas r
  SET puntos_obtenidos = CASE
    WHEN pq.tipo = 'multiple_choice' AND r.opcion_elegida IS NOT NULL AND r.opcion_elegida = pq.indice_correcto
      THEN pq.puntos
    WHEN pq.tipo = 'multiple_choice' THEN 0
    ELSE r.puntos_obtenidos
  END
  FROM public.pruebas_preguntas pq
  WHERE r.id_pregunta = pq.id
    AND r.id_asignacion = p_id_asignacion
    AND pq.tipo = 'multiple_choice';
END;
$$;

CREATE OR REPLACE FUNCTION public._prueba_recalcular_asignacion(p_id_asignacion uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_prueba uuid;
  v_porc integer;
  v_max numeric;
  v_sum numeric;
  v_pending boolean;
BEGIN
  SELECT a.id_prueba INTO v_id_prueba
  FROM public.pruebas_asignaciones a
  WHERE a.id = p_id_asignacion;

  IF v_id_prueba IS NULL THEN
    RETURN;
  END IF;

  SELECT p.porcentaje_aprobacion INTO v_porc
  FROM public.pruebas_conocimiento p
  WHERE p.id = v_id_prueba;

  SELECT COALESCE(SUM(pq.puntos), 0) INTO v_max
  FROM public.pruebas_preguntas pq
  WHERE pq.id_prueba = v_id_prueba;

  SELECT EXISTS (
    SELECT 1
    FROM public.pruebas_respuestas r
    JOIN public.pruebas_preguntas pq ON pq.id = r.id_pregunta
    WHERE r.id_asignacion = p_id_asignacion
      AND pq.tipo = 'desarrollo'
      AND r.puntos_obtenidos IS NULL
  ) INTO v_pending;

  SELECT COALESCE(SUM(r.puntos_obtenidos), 0) INTO v_sum
  FROM public.pruebas_respuestas r
  WHERE r.id_asignacion = p_id_asignacion
    AND r.puntos_obtenidos IS NOT NULL;

  UPDATE public.pruebas_asignaciones
  SET
    puntaje_maximo = v_max,
    puntaje_obtenido = v_sum,
    calificacion_pendiente = v_pending,
    aprobado = CASE
      WHEN v_pending THEN NULL::boolean
      WHEN v_max IS NULL OR v_max <= 0 THEN NULL::boolean
      ELSE ((v_sum / v_max) * 100) >= v_porc::numeric
    END
  WHERE id = p_id_asignacion;
END;
$$;

CREATE OR REPLACE FUNCTION public.rrhh_prueba_calificar_desarrollo(
  p_usuario_id integer,
  p_id_asignacion uuid,
  p_id_pregunta uuid,
  p_puntos numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_max_p numeric;
  v_estado text;
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT a.estado INTO v_estado
  FROM public.pruebas_asignaciones a
  WHERE a.id = p_id_asignacion;

  IF v_estado IS DISTINCT FROM 'finalizada' THEN
    RAISE EXCEPTION 'La prueba debe estar finalizada';
  END IF;

  SELECT pq.tipo, pq.puntos INTO v_tipo, v_max_p
  FROM public.pruebas_respuestas r
  JOIN public.pruebas_preguntas pq ON pq.id = r.id_pregunta
  WHERE r.id_asignacion = p_id_asignacion AND r.id_pregunta = p_id_pregunta;

  IF v_tipo IS DISTINCT FROM 'desarrollo' THEN
    RAISE EXCEPTION 'Solo preguntas de desarrollo';
  END IF;

  IF p_puntos < 0 OR p_puntos > v_max_p THEN
    RAISE EXCEPTION 'Puntos fuera de rango (0 - %)', v_max_p;
  END IF;

  UPDATE public.pruebas_respuestas r
  SET puntos_obtenidos = p_puntos
  WHERE r.id_asignacion = p_id_asignacion AND r.id_pregunta = p_id_pregunta;

  PERFORM public._prueba_recalcular_asignacion(p_id_asignacion);
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.rrhh_prueba_guardar(integer, uuid, text, text, integer, jsonb);

CREATE OR REPLACE FUNCTION public.rrhh_prueba_guardar(
  p_usuario_id integer,
  p_id_prueba uuid,
  p_titulo text,
  p_descripcion text,
  p_tiempo_total_segundos integer,
  p_porcentaje_aprobacion integer,
  p_preguntas jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  rec jsonb;
  v_tiene_asignaciones boolean;
  v_porc integer;
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_titulo IS NULL OR trim(p_titulo) = '' THEN
    RAISE EXCEPTION 'Título requerido';
  END IF;

  v_porc := COALESCE(p_porcentaje_aprobacion, 60);
  IF v_porc < 1 OR v_porc > 100 THEN
    RAISE EXCEPTION 'Porcentaje de aprobación inválido (1-100)';
  END IF;

  IF p_id_prueba IS NULL THEN
    INSERT INTO public.pruebas_conocimiento (titulo, descripcion, tiempo_total_segundos, id_creador, porcentaje_aprobacion)
    VALUES (
      trim(p_titulo),
      NULLIF(trim(COALESCE(p_descripcion, '')), ''),
      p_tiempo_total_segundos,
      p_usuario_id,
      v_porc
    )
    RETURNING id INTO v_id;
  ELSE
    v_id := p_id_prueba;
    SELECT EXISTS (SELECT 1 FROM public.pruebas_asignaciones WHERE id_prueba = v_id)
    INTO v_tiene_asignaciones;

    IF v_tiene_asignaciones THEN
      UPDATE public.pruebas_conocimiento
      SET
        titulo = trim(p_titulo),
        descripcion = NULLIF(trim(COALESCE(p_descripcion, '')), ''),
        tiempo_total_segundos = p_tiempo_total_segundos,
        porcentaje_aprobacion = v_porc,
        updated_at = now()
      WHERE id = v_id;
      RETURN v_id;
    END IF;

    UPDATE public.pruebas_conocimiento
    SET
      titulo = trim(p_titulo),
      descripcion = NULLIF(trim(COALESCE(p_descripcion, '')), ''),
      tiempo_total_segundos = p_tiempo_total_segundos,
      porcentaje_aprobacion = v_porc,
      updated_at = now()
    WHERE id = v_id;

    DELETE FROM public.pruebas_preguntas WHERE id_prueba = v_id;
  END IF;

  IF p_preguntas IS NOT NULL AND jsonb_typeof(p_preguntas) = 'array' THEN
    FOR rec IN SELECT * FROM jsonb_array_elements(p_preguntas)
    LOOP
      INSERT INTO public.pruebas_preguntas (
        id_prueba, orden, texto, tipo, tiempo_segundos, opciones, indice_correcto, puntos
      )
      VALUES (
        v_id,
        COALESCE((rec->>'orden')::integer, 0),
        trim(COALESCE(rec->>'texto', '')),
        COALESCE(rec->>'tipo', 'desarrollo'),
        CASE WHEN rec ? 'tiempo_segundos' AND (rec->>'tiempo_segundos') <> '' THEN (rec->>'tiempo_segundos')::integer ELSE NULL END,
        COALESCE(rec->'opciones', '[]'::jsonb),
        CASE WHEN rec ? 'indice_correcto' AND (rec->>'indice_correcto') <> '' THEN (rec->>'indice_correcto')::integer ELSE NULL END,
        GREATEST(0.01, COALESCE((rec->>'puntos')::numeric, 1))
      );
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rrhh_pruebas_listar(p_usuario_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'titulo', s.titulo,
          'descripcion', s.descripcion,
          'tiempo_total_segundos', s.tiempo_total_segundos,
          'porcentaje_aprobacion', s.porcentaje_aprobacion,
          'created_at', s.created_at,
          'preguntas_count', (SELECT COUNT(*)::int FROM public.pruebas_preguntas pp WHERE pp.id_prueba = s.id),
          'asignados', (SELECT COUNT(*)::int FROM public.pruebas_asignaciones a WHERE a.id_prueba = s.id),
          'finalizados', (
            SELECT COUNT(*)::int FROM public.pruebas_asignaciones a
            WHERE a.id_prueba = s.id AND a.estado = 'finalizada'
          ),
          'promedio_puntaje', (
            SELECT ROUND(AVG(a.puntaje_obtenido)::numeric, 2)
            FROM public.pruebas_asignaciones a
            WHERE a.id_prueba = s.id
              AND a.estado = 'finalizada'
              AND a.calificacion_pendiente = false
              AND a.puntaje_obtenido IS NOT NULL
          ),
          'tasa_aprobacion_pct', (
            SELECT CASE
              WHEN COUNT(*) FILTER (WHERE a.calificacion_pendiente = false AND a.aprobado IS NOT NULL) = 0 THEN NULL
              ELSE ROUND(
                100.0 * COUNT(*) FILTER (WHERE a.aprobado = true)::numeric
                / NULLIF(COUNT(*) FILTER (WHERE a.calificacion_pendiente = false AND a.aprobado IS NOT NULL), 0),
                1
              )
            END
            FROM public.pruebas_asignaciones a
            WHERE a.id_prueba = s.id AND a.estado = 'finalizada'
          )
        )
      )
      FROM (
        SELECT p.*
        FROM public.pruebas_conocimiento p
        ORDER BY p.created_at DESC
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rrhh_prueba_resultados(p_usuario_id integer, p_id_prueba uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prueba jsonb;
  v_asigs jsonb;
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'titulo', p.titulo,
    'descripcion', p.descripcion,
    'tiempo_total_segundos', p.tiempo_total_segundos,
    'porcentaje_aprobacion', p.porcentaje_aprobacion,
    'preguntas', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pp.id,
            'orden', pp.orden,
            'texto', pp.texto,
            'tipo', pp.tipo,
            'tiempo_segundos', pp.tiempo_segundos,
            'puntos', pp.puntos,
            'opciones', pp.opciones,
            'indice_correcto', pp.indice_correcto
          )
        )
        FROM (
          SELECT * FROM public.pruebas_preguntas pp2
          WHERE pp2.id_prueba = p.id
          ORDER BY pp2.orden, pp2.created_at
        ) pp
      ),
      '[]'::jsonb
    )
  )
  INTO v_prueba
  FROM public.pruebas_conocimiento p
  WHERE p.id = p_id_prueba;

  IF v_prueba IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id_asignacion', x.id,
        'id_usuario', x.id_usuario,
        'nombre_usuario', x.nombre_usuario,
        'estado', x.estado,
        'iniciado_at', x.iniciado_at,
        'finalizado_at', x.finalizado_at,
        'tiempo_limite_fin', x.tiempo_limite_fin,
        'puntaje_obtenido', x.puntaje_obtenido,
        'puntaje_maximo', x.puntaje_maximo,
        'aprobado', x.aprobado,
        'calificacion_pendiente', x.calificacion_pendiente,
        'respuestas_count', x.respuestas_count,
        'respuestas', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id_pregunta', r.id_pregunta,
                'pregunta_texto', pq.texto,
                'tipo', pq.tipo,
                'puntos_pregunta', pq.puntos,
                'puntos_obtenidos', r.puntos_obtenidos,
                'respuesta_texto', r.respuesta_texto,
                'opcion_elegida', r.opcion_elegida,
                'opciones', pq.opciones,
                'indice_correcto', pq.indice_correcto,
                'es_correcta_mc', CASE
                  WHEN pq.tipo = 'multiple_choice' THEN (r.opcion_elegida IS NOT NULL AND r.opcion_elegida = pq.indice_correcto)
                  ELSE NULL
                END,
                'requiere_calificacion', pq.tipo = 'desarrollo'
              )
              ORDER BY pq.orden, pq.created_at
            )
            FROM public.pruebas_respuestas r
            JOIN public.pruebas_preguntas pq ON pq.id = r.id_pregunta
            WHERE r.id_asignacion = x.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY x.nombre_usuario
    ),
    '[]'::jsonb
  )
  INTO v_asigs
  FROM (
    SELECT
      a.id,
      a.id_usuario,
      u.nombre AS nombre_usuario,
      a.estado,
      a.iniciado_at,
      a.finalizado_at,
      a.tiempo_limite_fin,
      a.puntaje_obtenido,
      a.puntaje_maximo,
      a.aprobado,
      a.calificacion_pendiente,
      (SELECT COUNT(*)::int FROM public.pruebas_respuestas r2 WHERE r2.id_asignacion = a.id) AS respuestas_count
    FROM public.pruebas_asignaciones a
    JOIN public.usuarios u ON u.id = a.id_usuario
    WHERE a.id_prueba = p_id_prueba
  ) x;

  RETURN jsonb_build_object('prueba', v_prueba, 'asignaciones', COALESCE(v_asigs, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_mis_pruebas(p_usuario_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id_asignacion', s.id_asignacion,
          'id_prueba', s.id_prueba,
          'titulo', s.titulo,
          'descripcion', s.descripcion,
          'tiempo_total_segundos', s.tiempo_total_segundos,
          'porcentaje_aprobacion', s.porcentaje_aprobacion,
          'estado', s.estado,
          'iniciado_at', s.iniciado_at,
          'finalizado_at', s.finalizado_at,
          'tiempo_limite_fin', s.tiempo_limite_fin,
          'puntaje_obtenido', s.puntaje_obtenido,
          'puntaje_maximo', s.puntaje_maximo,
          'aprobado', s.aprobado,
          'calificacion_pendiente', s.calificacion_pendiente
        )
      )
      FROM (
        SELECT
          a.id AS id_asignacion,
          a.id_prueba,
          p.titulo,
          p.descripcion,
          p.tiempo_total_segundos,
          p.porcentaje_aprobacion,
          a.estado,
          a.iniciado_at,
          a.finalizado_at,
          a.tiempo_limite_fin,
          a.puntaje_obtenido,
          a.puntaje_maximo,
          a.aprobado,
          a.calificacion_pendiente
        FROM public.pruebas_asignaciones a
        JOIN public.pruebas_conocimiento p ON p.id = a.id_prueba
        WHERE a.id_usuario = p_usuario_id
        ORDER BY a.created_at DESC
      ) s
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_prueba_pantalla(p_usuario_id integer, p_id_asignacion uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prueba_id uuid;
  v_estado text;
BEGIN
  SELECT a.id_prueba, a.estado
  INTO v_prueba_id, v_estado
  FROM public.pruebas_asignaciones a
  WHERE a.id = p_id_asignacion AND a.id_usuario = p_usuario_id;

  IF v_prueba_id IS NULL THEN
    RAISE EXCEPTION 'Asignación no encontrada';
  END IF;
  IF v_estado = 'pendiente' THEN
    RAISE EXCEPTION 'Iniciá la prueba antes de abrirla';
  END IF;
  IF v_estado NOT IN ('en_progreso', 'finalizada') THEN
    RAISE EXCEPTION 'Estado de prueba no válido';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id_asignacion', a.id,
      'estado', a.estado,
      'tiempo_limite_fin', a.tiempo_limite_fin,
      'iniciado_at', a.iniciado_at,
      'finalizado_at', a.finalizado_at,
      'puntaje_obtenido', a.puntaje_obtenido,
      'puntaje_maximo', a.puntaje_maximo,
      'aprobado', a.aprobado,
      'calificacion_pendiente', a.calificacion_pendiente,
      'prueba', jsonb_build_object(
        'id', p.id,
        'titulo', p.titulo,
        'descripcion', p.descripcion,
        'tiempo_total_segundos', p.tiempo_total_segundos,
        'porcentaje_aprobacion', p.porcentaje_aprobacion
      ),
      'preguntas', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', pp.id,
              'orden', pp.orden,
              'texto', pp.texto,
              'tipo', pp.tipo,
              'tiempo_segundos', pp.tiempo_segundos,
              'puntos', pp.puntos,
              'opciones', CASE WHEN pp.tipo = 'multiple_choice' THEN pp.opciones ELSE NULL END
            )
          )
          FROM (
            SELECT * FROM public.pruebas_preguntas pp2
            WHERE pp2.id_prueba = p.id
            ORDER BY pp2.orden, pp2.created_at
          ) pp
        ),
        '[]'::jsonb
      ),
      'mis_respuestas', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id_pregunta', r.id_pregunta,
              'respuesta_texto', r.respuesta_texto,
              'opcion_elegida', r.opcion_elegida,
              'puntos_obtenidos', r.puntos_obtenidos
            )
          )
          FROM public.pruebas_respuestas r
          WHERE r.id_asignacion = a.id
        ),
        '[]'::jsonb
      )
    )
    FROM public.pruebas_asignaciones a
    JOIN public.pruebas_conocimiento p ON p.id = a.id_prueba
    WHERE a.id = p_id_asignacion
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_prueba_finalizar(p_usuario_id integer, p_id_asignacion uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pruebas_asignaciones
  SET
    estado = 'finalizada',
    finalizado_at = now()
  WHERE id = p_id_asignacion
    AND id_usuario = p_usuario_id
    AND estado = 'en_progreso';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo finalizar';
  END IF;

  PERFORM public._prueba_aplicar_autocalificacion_mc(p_id_asignacion);
  PERFORM public._prueba_recalcular_asignacion(p_id_asignacion);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_prueba_guardar(integer, uuid, text, text, integer, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rrhh_prueba_calificar_desarrollo(integer, uuid, uuid, numeric) TO anon, authenticated;

COMMIT;
