-- Reemplaza registrar_encuesta_satisfaccion_public: tras guardar la encuesta,
-- notifica a usuarios con rol administracion o gerencia (descripción incluye comentario si lo hubo).

CREATE OR REPLACE FUNCTION public.registrar_encuesta_satisfaccion_public(
  p_rating smallint,
  p_departamento text,
  p_distrito text,
  p_edad smallint,
  p_sexo text,
  p_lat double precision,
  p_lng double precision,
  p_comentario text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_dep text;
  v_dis text;
  v_com text;
  v_desc text;
  u record;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'rating inválido';
  END IF;
  IF p_edad IS NULL OR p_edad < 12 OR p_edad > 110 THEN
    RAISE EXCEPTION 'edad inválida';
  END IF;
  IF p_sexo IS NULL OR p_sexo NOT IN ('f', 'm', 'x', 'prefiero_no_decir') THEN
    RAISE EXCEPTION 'sexo inválido';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'ubicación inválida';
  END IF;

  v_dep := trim(both from coalesce(p_departamento, ''));
  v_dis := trim(both from coalesce(p_distrito, ''));
  IF length(v_dep) < 2 OR length(v_dep) > 120 THEN
    RAISE EXCEPTION 'departamento inválido';
  END IF;
  IF length(v_dis) < 2 OR length(v_dis) > 120 THEN
    RAISE EXCEPTION 'distrito inválido';
  END IF;

  v_com := nullif(trim(both from coalesce(p_comentario, '')), '');
  IF v_com IS NOT NULL AND length(v_com) > 600 THEN
    RAISE EXCEPTION 'comentario demasiado largo';
  END IF;

  INSERT INTO public.atencion_satisfaccion_encuestas (
    rating, departamento, distrito, edad, sexo, lat, lng, comentario
  ) VALUES (
    p_rating, v_dep, v_dis, p_edad, p_sexo, p_lat, p_lng, v_com
  )
  RETURNING id INTO v_id;

  v_desc :=
    format(
      'Calificación %s/5 · %s · %s · edad %s · sexo %s.',
      p_rating::text,
      v_dep,
      v_dis,
      p_edad::text,
      p_sexo
    );
  IF v_com IS NOT NULL THEN
    v_desc := v_desc || E'\n\nComentario del cliente:\n' || left(v_com, 2000);
  END IF;

  BEGIN
    FOR u IN
      SELECT id
      FROM public.usuarios
      WHERE rol IN ('administracion', 'gerencia')
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id,
          title,
          description,
          type,
          is_read
        ) VALUES (
          u.id,
          'Encuesta de satisfacción',
          v_desc,
          'info',
          false
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'notif satisfacción usuario %: %', u.id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'notif satisfacción: %', SQLERRM;
  END;

  RETURN json_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_encuesta_satisfaccion_public(smallint, text, text, smallint, text, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_encuesta_satisfaccion_public(smallint, text, text, smallint, text, double precision, double precision, text) TO anon, authenticated;
