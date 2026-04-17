-- Menú diario: alinear cierre de pedidos con la app (10:30 hora Argentina).
-- Antes la RPC usaba 09:30 y el front mostraba 10:30 → el usuario veía plazo vigente pero el servidor rechazaba.
--
-- IMPORTANTE: ejecutar TODO el archivo en Supabase (SQL Editor). Si pegás desde chat,
-- puede cortarse a la mitad y dar ERROR 42601 en "turno_almuerzo".

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
AS $seleccionar_plato_menu$
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
  IF v_hora_actual > '10:30:00'::time THEN
    RAISE EXCEPTION 'El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 10:30 AM (hora Argentina)';
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

  INSERT INTO public.menu_selecciones (id_menu, id_usuario, id_plato, turno_almuerzo, emoji_estado)
  VALUES (p_id_menu, p_id_usuario, p_id_plato, p_turno_almuerzo, v_emoji_trim)
  ON CONFLICT (id_menu, id_usuario) DO UPDATE SET id_plato = EXCLUDED.id_plato, turno_almuerzo = EXCLUDED.turno_almuerzo, emoji_estado = EXCLUDED.emoji_estado, fecha_seleccion = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$seleccionar_plato_menu$;

CREATE OR REPLACE FUNCTION public.cancelar_seleccion_menu(
  p_id_menu integer,
  p_id_usuario integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cancelar_seleccion_menu$
DECLARE
  v_menu public.menus_diarios;
  v_hora_actual time;
  v_fecha_argentina date;
BEGIN
  SELECT * INTO v_menu FROM public.menus_diarios WHERE id = p_id_menu;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menú no encontrado';
  END IF;

  v_fecha_argentina := public.get_argentina_date();

  IF v_menu.fecha != v_fecha_argentina THEN
    RAISE EXCEPTION 'Solo se puede cancelar la selección del menú del día actual';
  END IF;

  v_hora_actual := public.get_argentina_time();
  IF v_hora_actual > '10:30:00'::time THEN
    RAISE EXCEPTION 'El plazo para cancelar la selección ha expirado. Debes hacerlo antes de las 10:30 AM (hora Argentina)';
  END IF;

  DELETE FROM public.menu_selecciones
  WHERE id_menu = p_id_menu AND id_usuario = p_id_usuario;

  RETURN FOUND;
END;
$cancelar_seleccion_menu$;
