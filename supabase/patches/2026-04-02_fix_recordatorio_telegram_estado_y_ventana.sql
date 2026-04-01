-- Ajuste recordatorio Telegram: incluir citas con estado NULL y ventana un poco más ancha (cron ~1 min)
BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_citas_recordatorio_telegram_15m()
RETURNS TABLE (
  id integer,
  id_asesor integer,
  titulo varchar,
  fecha_cita timestamptz,
  duracion_minutos integer,
  estado varchar,
  direccion text,
  ubicacion_link text,
  cliente_nombre text,
  ficha_numero text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.id_asesor,
    c.titulo,
    c.fecha_cita,
    c.duracion_minutos,
    c.estado,
    c.direccion,
    c.ubicacion_link,
    cl.nombre::text,
    ot.numero_op::text
  FROM public.citas_asesor_tecnico c
  LEFT JOIN public.clientes cl ON c.id_cliente = cl.id
  LEFT JOIN public.ordenes_trabajo ot ON c.id_ficha_no_op = ot.id
  WHERE c.recordatorio_telegram_15m_at IS NULL
    AND (
      c.estado IS NULL
      OR lower(trim(c.estado)) NOT IN ('completada', 'cancelada')
    )
    AND c.fecha_cita >= (now() + interval '12 minutes')
    AND c.fecha_cita <= (now() + interval '18 minutes');
$$;

GRANT EXECUTE ON FUNCTION public.obtener_citas_recordatorio_telegram_15m() TO service_role;

COMMIT;
