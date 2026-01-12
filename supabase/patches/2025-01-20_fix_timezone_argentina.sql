-- Fix: Configurar zona horaria de Argentina para funciones de menú diario
-- Zona horaria: America/Argentina/Buenos_Aires (UTC-3)

-- Función auxiliar para obtener la fecha actual en Argentina
CREATE OR REPLACE FUNCTION public.get_argentina_date()
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
END;
$$;

-- Función auxiliar para obtener la hora actual en Argentina
CREATE OR REPLACE FUNCTION public.get_argentina_time()
RETURNS time
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::time;
END;
$$;

-- Actualizar función obtener_menu_dia_actual para usar fecha de Argentina
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
  LEFT JOIN public.menu_platos mp ON m.id = mp.id_menu
  LEFT JOIN public.menu_selecciones ms ON m.id = ms.id_menu
  WHERE m.fecha = public.get_argentina_date()
  GROUP BY m.id, m.fecha, m.creado_por, u.nombre, m.created_at, m.updated_at
  LIMIT 1;
END;
$$;

-- Actualizar función crear_actualizar_menu_diario para usar fecha de Argentina por defecto
CREATE OR REPLACE FUNCTION public.crear_actualizar_menu_diario(
  p_creado_por integer,
  p_platos varchar(255)[], -- Array de nombres de platos
  p_fecha date DEFAULT NULL
)
RETURNS public.menus_diarios
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result public.menus_diarios;
  v_menu_id integer;
  v_plato varchar(255);
  v_fecha date;
BEGIN
  -- Usar fecha de Argentina si no se especifica
  v_fecha := COALESCE(p_fecha, public.get_argentina_date());
  
  -- Crear o obtener el menú del día
  INSERT INTO public.menus_diarios (fecha, creado_por)
  VALUES (v_fecha, p_creado_por)
  ON CONFLICT (fecha) DO UPDATE SET
    creado_por = EXCLUDED.creado_por,
    updated_at = now()
  RETURNING * INTO v_result;
  
  v_menu_id := v_result.id;
  
  -- Eliminar platos existentes del menú
  DELETE FROM public.menu_platos WHERE id_menu = v_menu_id;
  
  -- Insertar nuevos platos
  IF p_platos IS NOT NULL AND array_length(p_platos, 1) > 0 THEN
    FOR i IN 1..array_length(p_platos, 1) LOOP
      v_plato := p_platos[i];
      IF v_plato IS NOT NULL AND trim(v_plato) != '' THEN
        INSERT INTO public.menu_platos (id_menu, nombre_plato, orden)
        VALUES (v_menu_id, trim(v_plato), i);
      END IF;
    END LOOP;
  END IF;
  
  RETURN v_result;
END;
$$;

-- Actualizar función seleccionar_plato_menu para usar fecha y hora de Argentina
CREATE OR REPLACE FUNCTION public.seleccionar_plato_menu(
  p_id_menu integer,
  p_id_usuario integer,
  p_id_plato integer
)
RETURNS public.menu_selecciones
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_menu public.menus_diarios;
  v_hora_actual time;
  v_fecha_menu date;
  v_fecha_argentina date;
  v_result public.menu_selecciones;
BEGIN
  -- Obtener el menú
  SELECT * INTO v_menu FROM public.menus_diarios WHERE id = p_id_menu;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menú no encontrado';
  END IF;

  -- Obtener fecha actual en Argentina
  v_fecha_argentina := public.get_argentina_date();

  -- Verificar fecha del menú
  v_fecha_menu := v_menu.fecha;
  IF v_fecha_menu != v_fecha_argentina THEN
    RAISE EXCEPTION 'Solo se puede seleccionar el menú del día actual';
  END IF;

  -- Verificar horario (hasta las 9:30 AM hora Argentina)
  v_hora_actual := public.get_argentina_time();
  IF v_hora_actual > '09:30:00'::time THEN
    RAISE EXCEPTION 'El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las 9:30 AM (hora Argentina)';
  END IF;

  -- Verificar que el plato pertenezca al menú
  IF NOT EXISTS (SELECT 1 FROM public.menu_platos WHERE id = p_id_plato AND id_menu = p_id_menu) THEN
    RAISE EXCEPTION 'El plato no pertenece a este menú';
  END IF;

  -- Insertar o actualizar selección
  INSERT INTO public.menu_selecciones (
    id_menu, id_usuario, id_plato
  )
  VALUES (
    p_id_menu, p_id_usuario, p_id_plato
  )
  ON CONFLICT (id_menu, id_usuario) DO UPDATE SET
    id_plato = EXCLUDED.id_plato,
    fecha_seleccion = now()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Actualizar función cancelar_seleccion_menu para usar fecha y hora de Argentina
CREATE OR REPLACE FUNCTION public.cancelar_seleccion_menu(
  p_id_menu integer,
  p_id_usuario integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_menu public.menus_diarios;
  v_hora_actual time;
  v_fecha_argentina date;
BEGIN
  -- Obtener el menú
  SELECT * INTO v_menu FROM public.menus_diarios WHERE id = p_id_menu;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menú no encontrado';
  END IF;

  -- Obtener fecha actual en Argentina
  v_fecha_argentina := public.get_argentina_date();

  -- Verificar fecha del menú
  IF v_menu.fecha != v_fecha_argentina THEN
    RAISE EXCEPTION 'Solo se puede cancelar la selección del menú del día actual';
  END IF;

  -- Verificar horario (hasta las 9:30 AM hora Argentina)
  v_hora_actual := public.get_argentina_time();
  IF v_hora_actual > '09:30:00'::time THEN
    RAISE EXCEPTION 'El plazo para cancelar la selección ha expirado. Debes hacerlo antes de las 9:30 AM (hora Argentina)';
  END IF;

  DELETE FROM public.menu_selecciones 
  WHERE id_menu = p_id_menu AND id_usuario = p_id_usuario;
  
  RETURN FOUND;
END;
$$;

