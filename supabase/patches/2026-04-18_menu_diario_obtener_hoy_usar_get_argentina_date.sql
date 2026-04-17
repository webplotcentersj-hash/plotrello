-- obtener_menu_dia_actual: unificar "hoy" con get_argentina_date() (misma regla que seleccionar_plato_menu).
-- Opcional si la app ya filtra por fecha vía obtener_menus_diarios; sirve para llamadas directas al RPC.

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
SET search_path = public
AS $obtener_menu_dia_actual$
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
  WHERE m.fecha = public.get_argentina_date()
  ORDER BY m.id DESC
  LIMIT 1;
END;
$obtener_menu_dia_actual$;
