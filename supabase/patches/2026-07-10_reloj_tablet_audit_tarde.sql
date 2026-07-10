-- Auditoría tablet: tardanza + foto legajo
DROP FUNCTION IF EXISTS public.listar_marcaciones_tablet_rango(date, date);

CREATE OR REPLACE FUNCTION public.listar_marcaciones_tablet_rango(
  p_desde date,
  p_hasta date
)
RETURNS TABLE (
  id bigint,
  id_usuario integer,
  empleado text,
  sector text,
  tipo text,
  marcado_at timestamptz,
  hora_argentina text,
  verificacion_confianza numeric,
  verificacion_detalle text,
  dispositivo_id text,
  foto_url text,
  legajo_foto_url text,
  tarde boolean,
  minutos_tarde integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.id_usuario,
    trim(coalesce(l.apellido, '') || ', ' || coalesce(l.nombre, '')) AS empleado,
    coalesce(l.sector, '') AS sector,
    m.tipo,
    m.marcado_at,
    to_char(m.marcado_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI') AS hora_argentina,
    m.verificacion_confianza,
    m.verificacion_detalle,
    m.dispositivo_id,
    m.foto_url,
    l.foto_url AS legajo_foto_url,
    (
      m.tipo = 'entrada'
      AND coalesce(a.tipo_registro, '') = 'tarde'
    ) AS tarde,
    coalesce(
      NULLIF(substring(a.observaciones FROM 'Tardanza ([0-9]+) min'), ''), '0'
    )::integer AS minutos_tarde
  FROM public.rrhh_reloj_tablet_marcaciones m
  LEFT JOIN public.legajos_empleados l ON l.id_usuario = m.id_usuario
  LEFT JOIN public.asistencia a
    ON a.id_usuario = m.id_usuario
   AND a.fecha = (m.marcado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  WHERE (m.marcado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_desde AND p_hasta
  ORDER BY m.marcado_at DESC;
$$;

REVOKE ALL ON FUNCTION public.listar_marcaciones_tablet_rango(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_marcaciones_tablet_rango(date, date) TO service_role;
