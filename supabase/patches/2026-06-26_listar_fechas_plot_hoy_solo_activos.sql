-- Excluir personal dado de baja (usuarios.activo = false) de cumples y aniversarios en home.

DROP FUNCTION IF EXISTS public.listar_fechas_plot_hoy();

CREATE OR REPLACE FUNCTION public.listar_fechas_plot_hoy()
RETURNS TABLE (
  id_usuario integer,
  nombre_mostrar text,
  cumple_hoy boolean,
  aniversario_empresa_hoy boolean,
  anios_en_empresa integer,
  foto_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoy date;
BEGIN
  hoy := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

  RETURN QUERY
  SELECT
    l.id_usuario,
    COALESCE(
      NULLIF(TRIM(CONCAT(COALESCE(l.nombre, ''), ' ', COALESCE(l.apellido, ''))), ''),
      u.nombre,
      'Usuario ' || l.id_usuario::text
    )::text AS nombre_mostrar,
    (
      l.fecha_nacimiento IS NOT NULL
      AND EXTRACT(MONTH FROM l.fecha_nacimiento::date) = EXTRACT(MONTH FROM hoy)
      AND EXTRACT(DAY FROM l.fecha_nacimiento::date) = EXTRACT(DAY FROM hoy)
    ) AS cumple_hoy,
    (
      l.fecha_ingreso IS NOT NULL
      AND EXTRACT(MONTH FROM l.fecha_ingreso::date) = EXTRACT(MONTH FROM hoy)
      AND EXTRACT(DAY FROM l.fecha_ingreso::date) = EXTRACT(DAY FROM hoy)
    ) AS aniversario_empresa_hoy,
    CASE
      WHEN l.fecha_ingreso IS NOT NULL
        AND EXTRACT(MONTH FROM l.fecha_ingreso::date) = EXTRACT(MONTH FROM hoy)
        AND EXTRACT(DAY FROM l.fecha_ingreso::date) = EXTRACT(DAY FROM hoy)
      THEN EXTRACT(YEAR FROM age(hoy, l.fecha_ingreso::date))::integer
      ELSE NULL::integer
    END AS anios_en_empresa,
    NULLIF(TRIM(l.foto_url), '')::text AS foto_url
  FROM public.legajos_empleados l
  INNER JOIN public.usuarios u ON u.id = l.id_usuario
  WHERE COALESCE(u.activo, true) = true
    AND (
      (
        l.fecha_nacimiento IS NOT NULL
        AND EXTRACT(MONTH FROM l.fecha_nacimiento::date) = EXTRACT(MONTH FROM hoy)
        AND EXTRACT(DAY FROM l.fecha_nacimiento::date) = EXTRACT(DAY FROM hoy)
      )
      OR
      (
        l.fecha_ingreso IS NOT NULL
        AND EXTRACT(MONTH FROM l.fecha_ingreso::date) = EXTRACT(MONTH FROM hoy)
        AND EXTRACT(DAY FROM l.fecha_ingreso::date) = EXTRACT(DAY FROM hoy)
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_fechas_plot_hoy() TO anon;
GRANT EXECUTE ON FUNCTION public.listar_fechas_plot_hoy() TO authenticated;

COMMENT ON FUNCTION public.listar_fechas_plot_hoy() IS
  'Cumples y aniversarios de alta (mismo día/mes que hoy en AR) solo para usuarios activos.';
