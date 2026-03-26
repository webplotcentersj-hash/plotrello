-- Menú diario: turnos de almuerzo (10 lugares c/u), emoji de estado
-- Turnos: 1 = 13:30-14:15, 2 = 14:20-15:00, 3 = 15:05-15:45
-- Aplicar después de get_argentina_date / get_argentina_time (fix_timezone_argentina)

ALTER TABLE public.menu_selecciones
  ADD COLUMN IF NOT EXISTS turno_almuerzo smallint NOT NULL DEFAULT 1
    CHECK (turno_almuerzo IN (1, 2, 3));

ALTER TABLE public.menu_selecciones
  ADD COLUMN IF NOT EXISTS emoji_estado text NOT NULL DEFAULT '😊';

COMMENT ON COLUMN public.menu_selecciones.turno_almuerzo IS '1: 13:30-14:15, 2: 14:20-15:00, 3: 15:05-15:45';
COMMENT ON COLUMN public.menu_selecciones.emoji_estado IS 'Emoji de cómo se siente (validado en RPC)';

-- Reemplazar firma de selección (nuevos parámetros obligatorios)
DROP FUNCTION IF EXISTS public.seleccionar_plato_menu(integer, integer, integer);

CREATE OR REPLACE FUNCTION public.seleccionar_plato_menu(
  p_id_menu integer,
  p_id_usuario integer,
  p_id_plato integer,
  p_turno_almuerzo smallint,
  p_emoji_estado text
)
RETURNS public.menu_selecciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_menu public.menus_diarios;
  v_hora_actual time;
  v_fecha_menu date;
  v_fecha_argentina date;
  v_result public.menu_selecciones;
  v_otros_en_turno integer;
  v_emoji_trim text;
BEGIN
  IF p_turno_almuerzo IS NULL OR p_turno_almuerzo NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Turno de almuerzo inválido (debe ser 1, 2 o 3)';
  END IF;

  v_emoji_trim := trim(COALESCE(p_emoji_estado, ''));
  IF v_emoji_trim = '' OR NOT (v_emoji_trim = ANY (ARRAY[
    '😊'::text, '😋'::text, '😐'::text, '😴'::text, '🤩'::text, '🙏'::text
  ])) THEN
    RAISE EXCEPTION 'Elegí cómo te sentís con uno de los emojis permitidos';
  END IF;

  SELECT * INTO v_menu FROM public.menus_diarios WHERE id = p_id_menu;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menú no encontrado';
  END IF;

  v_fecha_argentina := public.get_argentina_date();
  v_fecha_menu := v_menu.fecha;
  IF v_fecha_menu != v_fecha_argentina THEN
    RAISE EXCEPTION 'Solo se puede seleccionar el menú del día actual';
  END IF;

  v_hora_actual := public.get_argentina_time();
  IF v_hora_actual > '09:30:00'::time THEN
    RAISE EXCEPTION 'El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 9:30 AM (hora Argentina)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_platos WHERE id = p_id_plato AND id_menu = p_id_menu) THEN
    RAISE EXCEPTION 'El plato no pertenece a este menú';
  END IF;

  SELECT COUNT(*)::integer INTO v_otros_en_turno
  FROM public.menu_selecciones ms
  WHERE ms.id_menu = p_id_menu
    AND ms.turno_almuerzo = p_turno_almuerzo
    AND ms.id_usuario != p_id_usuario;

  IF v_otros_en_turno >= 10 THEN
    RAISE EXCEPTION 'Ese turno de almuerzo ya está completo (máximo 10 personas)';
  END IF;

  INSERT INTO public.menu_selecciones (
    id_menu, id_usuario, id_plato, turno_almuerzo, emoji_estado
  )
  VALUES (
    p_id_menu, p_id_usuario, p_id_plato, p_turno_almuerzo, v_emoji_trim
  )
  ON CONFLICT (id_menu, id_usuario) DO UPDATE SET
    id_plato = EXCLUDED.id_plato,
    turno_almuerzo = EXCLUDED.turno_almuerzo,
    emoji_estado = EXCLUDED.emoji_estado,
    fecha_seleccion = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_selecciones_menu(
  p_id_menu integer
)
RETURNS TABLE (
  id integer,
  id_menu integer,
  id_usuario integer,
  nombre_usuario varchar(255),
  id_plato integer,
  nombre_plato varchar(255),
  fecha_seleccion timestamptz,
  created_at timestamptz,
  turno_almuerzo smallint,
  emoji_estado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.id_menu,
    ms.id_usuario,
    u.nombre::varchar(255) AS nombre_usuario,
    ms.id_plato,
    mp.nombre_plato::varchar(255),
    ms.fecha_seleccion,
    ms.created_at,
    ms.turno_almuerzo,
    ms.emoji_estado
  FROM public.menu_selecciones ms
  JOIN public.usuarios u ON ms.id_usuario = u.id
  JOIN public.menu_platos mp ON ms.id_plato = mp.id
  WHERE ms.id_menu = p_id_menu
  ORDER BY ms.turno_almuerzo ASC, ms.fecha_seleccion ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_seleccion_usuario_menu(
  p_id_menu integer,
  p_id_usuario integer
)
RETURNS TABLE (
  id integer,
  id_menu integer,
  id_usuario integer,
  id_plato integer,
  nombre_plato varchar(255),
  fecha_seleccion timestamptz,
  created_at timestamptz,
  turno_almuerzo smallint,
  emoji_estado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.id_menu,
    ms.id_usuario,
    ms.id_plato,
    mp.nombre_plato::varchar(255),
    ms.fecha_seleccion,
    ms.created_at,
    ms.turno_almuerzo,
    ms.emoji_estado
  FROM public.menu_selecciones ms
  JOIN public.menu_platos mp ON ms.id_plato = mp.id
  WHERE ms.id_menu = p_id_menu AND ms.id_usuario = p_id_usuario;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seleccionar_plato_menu(integer, integer, integer, smallint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_selecciones_menu(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_seleccion_usuario_menu(integer, integer) TO anon, authenticated;
