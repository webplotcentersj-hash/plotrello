-- Fix: jsonb_agg de platos duplicaba cada plato N veces (N = filas en menu_selecciones)
-- al hacer LEFT JOIN menu_platos y menu_selecciones en el mismo FROM.
-- Se agregan platos y total_selecciones en subconsultas independientes.

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
    u.nombre AS creado_por_nombre,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', mp.id,
            'nombre_plato', mp.nombre_plato,
            'orden', mp.orden
          ) ORDER BY mp.orden
        )
        FROM public.menu_platos mp
        WHERE mp.id_menu = m.id
      ),
      '[]'::jsonb
    ) AS platos,
    (
      SELECT COUNT(DISTINCT ms.id_usuario)::bigint
      FROM public.menu_selecciones ms
      WHERE ms.id_menu = m.id
    ) AS total_selecciones,
    m.created_at,
    m.updated_at
  FROM public.menus_diarios m
  LEFT JOIN public.usuarios u ON m.creado_por = u.id
  WHERE m.fecha = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_menus_diarios(
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
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
    u.nombre AS creado_por_nombre,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', mp.id,
            'nombre_plato', mp.nombre_plato,
            'orden', mp.orden
          ) ORDER BY mp.orden
        )
        FROM public.menu_platos mp
        WHERE mp.id_menu = m.id
      ),
      '[]'::jsonb
    ) AS platos,
    (
      SELECT COUNT(DISTINCT ms.id_usuario)::bigint
      FROM public.menu_selecciones ms
      WHERE ms.id_menu = m.id
    ) AS total_selecciones,
    m.created_at,
    m.updated_at
  FROM public.menus_diarios m
  LEFT JOIN public.usuarios u ON m.creado_por = u.id
  WHERE
    (p_fecha_desde IS NULL OR m.fecha >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR m.fecha <= p_fecha_hasta)
  ORDER BY m.fecha DESC;
END;
$$;
