-- Pruebas de conocimiento (RRHH): preguntas multiple choice o desarrollo, tiempos por ítem y total.
-- Acceso solo vía RPC SECURITY DEFINER (login por RPC sin JWT Supabase Auth).

BEGIN;

CREATE TABLE IF NOT EXISTS public.pruebas_conocimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  tiempo_total_segundos integer CHECK (tiempo_total_segundos IS NULL OR tiempo_total_segundos > 0),
  id_creador integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pruebas_preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_prueba uuid NOT NULL REFERENCES public.pruebas_conocimiento(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  texto text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('multiple_choice', 'desarrollo')),
  tiempo_segundos integer CHECK (tiempo_segundos IS NULL OR tiempo_segundos > 0),
  opciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  indice_correcto integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pruebas_preguntas_prueba ON public.pruebas_preguntas(id_prueba);

CREATE TABLE IF NOT EXISTS public.pruebas_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_prueba uuid NOT NULL REFERENCES public.pruebas_conocimiento(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'finalizada', 'vencida')),
  iniciado_at timestamptz,
  finalizado_at timestamptz,
  tiempo_limite_fin timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_prueba, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_pruebas_asignaciones_usuario ON public.pruebas_asignaciones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_pruebas_asignaciones_prueba ON public.pruebas_asignaciones(id_prueba);

CREATE TABLE IF NOT EXISTS public.pruebas_respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_asignacion uuid NOT NULL REFERENCES public.pruebas_asignaciones(id) ON DELETE CASCADE,
  id_pregunta uuid NOT NULL REFERENCES public.pruebas_preguntas(id) ON DELETE CASCADE,
  respuesta_texto text,
  opcion_elegida integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_asignacion, id_pregunta)
);

CREATE INDEX IF NOT EXISTS idx_pruebas_respuestas_asignacion ON public.pruebas_respuestas(id_asignacion);

ALTER TABLE public.pruebas_conocimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pruebas_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pruebas_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pruebas_respuestas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._rrhh_es_gestor_pruebas(p_usuario_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('recursos-humanos', 'administracion', 'gerencia')
  );
$$;

CREATE OR REPLACE FUNCTION public.rrhh_prueba_guardar(
  p_usuario_id integer,
  p_id_prueba uuid,
  p_titulo text,
  p_descripcion text,
  p_tiempo_total_segundos integer,
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
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_titulo IS NULL OR trim(p_titulo) = '' THEN
    RAISE EXCEPTION 'Título requerido';
  END IF;

  IF p_id_prueba IS NULL THEN
    INSERT INTO public.pruebas_conocimiento (titulo, descripcion, tiempo_total_segundos, id_creador)
    VALUES (
      trim(p_titulo),
      NULLIF(trim(COALESCE(p_descripcion, '')), ''),
      p_tiempo_total_segundos,
      p_usuario_id
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
        updated_at = now()
      WHERE id = v_id;
      RETURN v_id;
    END IF;

    UPDATE public.pruebas_conocimiento
    SET
      titulo = trim(p_titulo),
      descripcion = NULLIF(trim(COALESCE(p_descripcion, '')), ''),
      tiempo_total_segundos = p_tiempo_total_segundos,
      updated_at = now()
    WHERE id = v_id;

    DELETE FROM public.pruebas_preguntas WHERE id_prueba = v_id;
  END IF;

  IF p_preguntas IS NOT NULL AND jsonb_typeof(p_preguntas) = 'array' THEN
    FOR rec IN SELECT * FROM jsonb_array_elements(p_preguntas)
    LOOP
      INSERT INTO public.pruebas_preguntas (
        id_prueba, orden, texto, tipo, tiempo_segundos, opciones, indice_correcto
      )
      VALUES (
        v_id,
        COALESCE((rec->>'orden')::integer, 0),
        trim(COALESCE(rec->>'texto', '')),
        COALESCE(rec->>'tipo', 'desarrollo'),
        CASE WHEN rec ? 'tiempo_segundos' AND (rec->>'tiempo_segundos') <> '' THEN (rec->>'tiempo_segundos')::integer ELSE NULL END,
        COALESCE(rec->'opciones', '[]'::jsonb),
        CASE WHEN rec ? 'indice_correcto' AND (rec->>'indice_correcto') <> '' THEN (rec->>'indice_correcto')::integer ELSE NULL END
      );
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rrhh_prueba_asignar(
  p_usuario_id integer,
  p_id_prueba uuid,
  p_ids_usuarios integer[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid integer;
  n integer := 0;
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_id_prueba IS NULL OR p_ids_usuarios IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  FOREACH uid IN ARRAY p_ids_usuarios
  LOOP
    IF uid IS NULL THEN
      CONTINUE;
    END IF;
    BEGIN
      INSERT INTO public.pruebas_asignaciones (id_prueba, id_usuario, estado)
      VALUES (p_id_prueba, uid, 'pendiente');
      n := n + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  RETURN n;
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
          'created_at', s.created_at,
          'preguntas_count', (SELECT COUNT(*)::int FROM public.pruebas_preguntas pp WHERE pp.id_prueba = s.id),
          'asignados', (SELECT COUNT(*)::int FROM public.pruebas_asignaciones a WHERE a.id_prueba = s.id),
          'finalizados', (
            SELECT COUNT(*)::int FROM public.pruebas_asignaciones a
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
    'preguntas', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pp.id,
            'orden', pp.orden,
            'texto', pp.texto,
            'tipo', pp.tipo,
            'tiempo_segundos', pp.tiempo_segundos,
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
        'respuestas', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id_pregunta', r.id_pregunta,
                'pregunta_texto', pq.texto,
                'tipo', pq.tipo,
                'respuesta_texto', r.respuesta_texto,
                'opcion_elegida', r.opcion_elegida,
                'opciones', pq.opciones,
                'indice_correcto', pq.indice_correcto
              )
            )
            FROM public.pruebas_respuestas r
            JOIN public.pruebas_preguntas pq ON pq.id = r.id_pregunta
            WHERE r.id_asignacion = x.id
          ),
          '[]'::jsonb
        )
      )
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
      a.tiempo_limite_fin
    FROM public.pruebas_asignaciones a
    JOIN public.usuarios u ON u.id = a.id_usuario
    WHERE a.id_prueba = p_id_prueba
    ORDER BY u.nombre
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
          'estado', s.estado,
          'iniciado_at', s.iniciado_at,
          'finalizado_at', s.finalizado_at,
          'tiempo_limite_fin', s.tiempo_limite_fin
        )
      )
      FROM (
        SELECT
          a.id AS id_asignacion,
          a.id_prueba,
          p.titulo,
          p.descripcion,
          p.tiempo_total_segundos,
          a.estado,
          a.iniciado_at,
          a.finalizado_at,
          a.tiempo_limite_fin
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

CREATE OR REPLACE FUNCTION public.usuario_prueba_iniciar(p_usuario_id integer, p_id_prueba uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aid uuid;
  v_lim timestamptz;
  v_seg integer;
BEGIN
  IF p_usuario_id IS NULL OR p_id_prueba IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  SELECT a.id INTO v_aid
  FROM public.pruebas_asignaciones a
  WHERE a.id_prueba = p_id_prueba AND a.id_usuario = p_usuario_id AND a.estado = 'en_progreso';
  IF v_aid IS NOT NULL THEN
    RETURN v_aid;
  END IF;

  SELECT a.id, p.tiempo_total_segundos
  INTO v_aid, v_seg
  FROM public.pruebas_asignaciones a
  JOIN public.pruebas_conocimiento p ON p.id = a.id_prueba
  WHERE a.id_prueba = p_id_prueba AND a.id_usuario = p_usuario_id AND a.estado = 'pendiente';

  IF v_aid IS NULL THEN
    RAISE EXCEPTION 'No hay prueba pendiente para iniciar';
  END IF;

  v_lim := CASE
    WHEN v_seg IS NOT NULL THEN now() + make_interval(secs => v_seg)
    ELSE NULL
  END;

  UPDATE public.pruebas_asignaciones
  SET
    estado = 'en_progreso',
    iniciado_at = now(),
    tiempo_limite_fin = v_lim
  WHERE id = v_aid;

  RETURN v_aid;
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
      'prueba', jsonb_build_object(
        'id', p.id,
        'titulo', p.titulo,
        'descripcion', p.descripcion,
        'tiempo_total_segundos', p.tiempo_total_segundos
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
              'opcion_elegida', r.opcion_elegida
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

CREATE OR REPLACE FUNCTION public.usuario_prueba_responder(
  p_usuario_id integer,
  p_id_asignacion uuid,
  p_id_pregunta uuid,
  p_respuesta_texto text,
  p_opcion_elegida integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.pruebas_asignaciones a
    WHERE a.id = p_id_asignacion
      AND a.id_usuario = p_usuario_id
      AND a.estado = 'en_progreso'
      AND (a.tiempo_limite_fin IS NULL OR a.tiempo_limite_fin > now())
  )
  INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'No se puede guardar la respuesta (estado o tiempo)';
  END IF;

  INSERT INTO public.pruebas_respuestas (id_asignacion, id_pregunta, respuesta_texto, opcion_elegida)
  VALUES (p_id_asignacion, p_id_pregunta, p_respuesta_texto, p_opcion_elegida)
  ON CONFLICT (id_asignacion, id_pregunta)
  DO UPDATE SET
    respuesta_texto = EXCLUDED.respuesta_texto,
    opcion_elegida = EXCLUDED.opcion_elegida,
    created_at = now();

  RETURN true;
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

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_prueba_guardar(integer, uuid, text, text, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rrhh_prueba_asignar(integer, uuid, integer[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rrhh_pruebas_listar(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rrhh_prueba_resultados(integer, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_mis_pruebas(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_prueba_iniciar(integer, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_prueba_pantalla(integer, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_prueba_responder(integer, uuid, uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_prueba_finalizar(integer, uuid) TO anon, authenticated;

COMMIT;
