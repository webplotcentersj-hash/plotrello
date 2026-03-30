-- Mensajería RRHH (DM): evita duplicate key en chat_rooms_pkey cuando la secuencia de id
-- queda por debajo del MAX(id) (p. ej. tras inserts manuales o restores).

CREATE OR REPLACE FUNCTION public.obtener_o_crear_room_dm(p_usuario_a integer, p_usuario_b integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_id integer;
  seq text;
BEGIN
  IF p_usuario_a IS NULL OR p_usuario_b IS NULL THEN
    RAISE EXCEPTION 'usuarios requeridos';
  END IF;
  IF p_usuario_a = p_usuario_b THEN
    RAISE EXCEPTION 'mismos_usuarios';
  END IF;

  IF p_usuario_a < p_usuario_b THEN
    v_nombre := 'dm:' || p_usuario_a::text || ':' || p_usuario_b::text;
  ELSE
    v_nombre := 'dm:' || p_usuario_b::text || ':' || p_usuario_a::text;
  END IF;

  SELECT id INTO v_id FROM public.chat_rooms WHERE nombre = v_nombre LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  seq := pg_get_serial_sequence('public.chat_rooms', 'id');
  IF seq IS NOT NULL THEN
    PERFORM setval(seq, COALESCE((SELECT MAX(id) FROM public.chat_rooms), 1));
  END IF;

  INSERT INTO public.chat_rooms (nombre, tipo)
  VALUES (v_nombre, 'privado')
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.chat_rooms WHERE nombre = v_nombre LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.obtener_o_crear_room_dm(integer, integer) IS
  'Room DM estable dm:min:max para mensajería RRHH; sincroniza secuencia antes de INSERT.';

GRANT EXECUTE ON FUNCTION public.obtener_o_crear_room_dm(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_o_crear_room_dm(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_o_crear_room_dm(integer, integer) TO service_role;
