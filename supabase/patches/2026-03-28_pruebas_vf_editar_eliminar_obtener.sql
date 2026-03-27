-- Pruebas RRHH: tipo verdadero/falso; obtener prueba para editar; eliminar sin asignaciones.
-- Aplica despues de 2026-03-27_pruebas_puntos_calificacion.sql
-- Usar solo comillas simples ASCII (') al pegar en el SQL Editor de Supabase.

BEGIN;

-- 1) Permitir tipo verdadero_falso
ALTER TABLE public.pruebas_preguntas DROP CONSTRAINT IF EXISTS pruebas_preguntas_tipo_check;
ALTER TABLE public.pruebas_preguntas ADD CONSTRAINT pruebas_preguntas_tipo_check
  CHECK (tipo IN ('multiple_choice', 'desarrollo', 'verdadero_falso'));

-- 2) Autocalificacion: mismo criterio que multiple choice
CREATE OR REPLACE FUNCTION public._prueba_aplicar_autocalificacion_mc(p_id_asignacion uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pruebas_respuestas r
  SET puntos_obtenidos = CASE
    WHEN pq.tipo IN ('multiple_choice', 'verdadero_falso')
      AND r.opcion_elegida IS NOT NULL
      AND r.opcion_elegida = pq.indice_correcto
      THEN pq.puntos
    WHEN pq.tipo IN ('multiple_choice', 'verdadero_falso') THEN 0
    ELSE r.puntos_obtenidos
  END
  FROM public.pruebas_preguntas pq
  WHERE r.id_pregunta = pq.id
    AND r.id_asignacion = p_id_asignacion
    AND pq.tipo IN ('multiple_choice', 'verdadero_falso');
END;
$$;

-- 3) Pantalla examen: opciones para V/F (orden de filas via subconsulta ORDER BY)
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
    RAISE EXCEPTION 'Asignacion no encontrada';
  END IF;
  IF v_estado = 'pendiente' THEN
    RAISE EXCEPTION 'Inicia la prueba antes de abrirla';
  END IF;
  IF v_estado NOT IN ('en_progreso', 'finalizada') THEN
    RAISE EXCEPTION 'Estado de prueba no valido';
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
          SELECT jsonb_agg(s.item)
          FROM (
            SELECT
              (
                jsonb_build_object('id', pp.id, 'orden', pp.orden, 'texto', pp.texto, 'tipo', pp.tipo, 'tiempo_segundos', pp.tiempo_segundos, 'puntos', pp.puntos)
                || jsonb_build_object(
                  'opciones',
                  CASE
                    WHEN pp.tipo IN ('multiple_choice', 'verdadero_falso') THEN pp.opciones
                    ELSE NULL::jsonb
                  END
                )
              ) AS item
            FROM public.pruebas_preguntas pp
            WHERE pp.id_prueba = p.id
            ORDER BY pp.orden, pp.created_at
          ) s
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

-- 4) Resultados: marcar correcto en V/F
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
        SELECT jsonb_agg(s.row_json)
        FROM (
          SELECT
            jsonb_build_object(
              'id', pp.id,
              'orden', pp.orden,
              'texto', pp.texto,
              'tipo', pp.tipo,
              'tiempo_segundos', pp.tiempo_segundos,
              'puntos', pp.puntos,
              'opciones', pp.opciones,
              'indice_correcto', pp.indice_correcto
            ) AS row_json
          FROM public.pruebas_preguntas pp
          WHERE pp.id_prueba = p.id
          ORDER BY pp.orden, pp.created_at
        ) s
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
    (
      SELECT jsonb_agg(s.row_json ORDER BY s.nombre_ord)
      FROM (
        SELECT
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
                SELECT jsonb_agg(s2.row_json)
                FROM (
                  SELECT
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
                        WHEN pq.tipo IN ('multiple_choice', 'verdadero_falso') THEN
                          (r.opcion_elegida IS NOT NULL AND r.opcion_elegida = pq.indice_correcto)
                        ELSE NULL::boolean
                      END,
                      'requiere_calificacion', (pq.tipo = 'desarrollo')
                    ) AS row_json
                  FROM public.pruebas_respuestas r
                  JOIN public.pruebas_preguntas pq ON pq.id = r.id_pregunta
                  WHERE r.id_asignacion = x.id
                  ORDER BY pq.orden, pq.created_at
                ) s2
              ),
              '[]'::jsonb
            )
          ) AS row_json,
          x.nombre_usuario AS nombre_ord
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
        ) x
      ) s
    ),
    '[]'::jsonb
  )
  INTO v_asigs;

  RETURN jsonb_build_object('prueba', v_prueba, 'asignaciones', COALESCE(v_asigs, '[]'::jsonb));
END;
$$;

-- 5) Detalle para editar
CREATE OR REPLACE FUNCTION public.rrhh_prueba_obtener(p_usuario_id integer, p_id_prueba uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', p.id,
      'titulo', p.titulo,
      'descripcion', p.descripcion,
      'tiempo_total_segundos', p.tiempo_total_segundos,
      'porcentaje_aprobacion', p.porcentaje_aprobacion,
      'preguntas', COALESCE(
        (
          SELECT jsonb_agg(s.row_json)
          FROM (
            SELECT
              jsonb_build_object(
                'id', pp.id,
                'orden', pp.orden,
                'texto', pp.texto,
                'tipo', pp.tipo,
                'tiempo_segundos', pp.tiempo_segundos,
                'puntos', pp.puntos,
                'opciones', pp.opciones,
                'indice_correcto', pp.indice_correcto
              ) AS row_json
            FROM public.pruebas_preguntas pp
            WHERE pp.id_prueba = p.id
            ORDER BY pp.orden, pp.created_at
          ) s
        ),
        '[]'::jsonb
      )
    )
    FROM public.pruebas_conocimiento p
    WHERE p.id = p_id_prueba
  );
END;
$$;

-- 6) Eliminar solo si no hay asignaciones
CREATE OR REPLACE FUNCTION public.rrhh_prueba_eliminar(p_usuario_id integer, p_id_prueba uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_id_prueba IS NULL THEN
    RAISE EXCEPTION 'Prueba requerida';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pruebas_asignaciones a WHERE a.id_prueba = p_id_prueba) THEN
    RAISE EXCEPTION 'No se puede eliminar: hay usuarios asignados.';
  END IF;

  DELETE FROM public.pruebas_conocimiento WHERE id = p_id_prueba;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prueba no encontrada';
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_prueba_obtener(integer, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rrhh_prueba_eliminar(integer, uuid) TO anon, authenticated;

COMMIT;
