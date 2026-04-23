-- Menú diario: editar platos sin borrar selecciones históricas.
-- Problema: `crear_actualizar_menu_diario` hacía DELETE de `menu_platos`, y por FK `menu_selecciones.id_plato -> menu_platos(id) ON DELETE CASCADE`
-- eso borraba las selecciones al editar el menú.
--
-- Solución:
-- - Agregar `activo boolean` a `menu_platos` (default true)
-- - Reescribir `crear_actualizar_menu_diario` para:
--   - mantener IDs existentes (actualiza por `orden`)
--   - insertar nuevos si hacen falta
--   - marcar como inactivos los platos que “sobran” (NO borrar filas)
-- - Ajustar `obtener_menu_dia_actual` para devolver solo platos activos
-- - Ajustar `seleccionar_plato_menu` para exigir `menu_platos.activo = true`

ALTER TABLE public.menu_platos
ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- Asegurar que filas viejas queden activas
UPDATE public.menu_platos SET activo = true WHERE activo IS DISTINCT FROM true;

CREATE OR REPLACE FUNCTION public.crear_actualizar_menu_diario(
  p_creado_por integer,
  p_platos varchar(255)[],
  p_fecha date DEFAULT NULL
)
RETURNS public.menus_diarios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.menus_diarios;
  v_menu_id integer;
  v_plato varchar(255);
  v_fecha date;
  v_existing_id integer;
BEGIN
  v_fecha := COALESCE(p_fecha, public.get_argentina_date());

  INSERT INTO public.menus_diarios (fecha, creado_por)
  VALUES (v_fecha, p_creado_por)
  ON CONFLICT (fecha) DO UPDATE SET
    creado_por = EXCLUDED.creado_por,
    updated_at = now()
  RETURNING * INTO v_result;

  v_menu_id := v_result.id;

  -- Marcar todo como inactivo (se re-activa lo que esté en la nueva lista).
  UPDATE public.menu_platos
  SET activo = false
  WHERE id_menu = v_menu_id;

  IF p_platos IS NOT NULL AND array_length(p_platos, 1) > 0 THEN
    FOR i IN 1..array_length(p_platos, 1) LOOP
      v_plato := p_platos[i];
      IF v_plato IS NULL OR trim(v_plato) = '' THEN
        CONTINUE;
      END IF;

      SELECT mp.id INTO v_existing_id
      FROM public.menu_platos mp
      WHERE mp.id_menu = v_menu_id AND mp.orden = i
      ORDER BY mp.id ASC
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        UPDATE public.menu_platos
        SET nombre_plato = trim(v_plato),
            activo = true,
            orden = i
        WHERE id = v_existing_id;
      ELSE
        INSERT INTO public.menu_platos (id_menu, nombre_plato, orden, activo)
        VALUES (v_menu_id, trim(v_plato), i, true);
      END IF;
    END LOOP;
  END IF;

  RETURN v_result;
END;
$$;

-- Solo platos activos para mostrar/seleccionar
CREATE OR REPLACE FUNCTION public.obtener_menu_dia_actual()
RETURNS TABLE (
  id integer,
  fecha date,
  creado_por integer,
  creado_por_nombre varchar(255),
  platos jsonb,
  total_selecciones bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.fecha,
    m.creado_por,
    u.nombre as creado_por_nombre,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', mp.id,
          'nombre_plato', mp.nombre_plato,
          'orden', mp.orden
        ) ORDER BY mp.orden
      ) FILTER (WHERE mp.id IS NOT NULL),
      '[]'::jsonb
    ) as platos,
    COUNT(DISTINCT ms.id_usuario)::bigint as total_selecciones,
    m.created_at,
    m.updated_at
  FROM public.menus_diarios m
  LEFT JOIN public.usuarios u ON m.creado_por = u.id
  LEFT JOIN public.menu_platos mp ON m.id = mp.id_menu AND mp.activo = true
  LEFT JOIN public.menu_selecciones ms ON m.id = ms.id_menu
  WHERE m.fecha = public.get_argentina_date()
  GROUP BY m.id, m.fecha, m.creado_por, u.nombre, m.created_at, m.updated_at
  LIMIT 1;
END;
$$;

-- Validación: solo se puede elegir plato activo
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
  IF v_hora_actual > '09:30:00'::time THEN
    RAISE EXCEPTION 'El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 9:30 AM (hora Argentina)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.menu_platos
    WHERE id = p_id_plato AND id_menu = p_id_menu AND activo = true
  ) THEN
    RAISE EXCEPTION 'El plato no pertenece a este menú o está inactivo';
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
  ON CONFLICT (id_menu, id_usuario) DO UPDATE
  SET id_plato = EXCLUDED.id_plato,
      turno_almuerzo = EXCLUDED.turno_almuerzo,
      emoji_estado = EXCLUDED.emoji_estado,
      fecha_seleccion = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$seleccionar_plato_menu$;

