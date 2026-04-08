-- Recordatorio Telegram: avisar ~30 min antes de la cita (cron ~1 min → ventana 27–33 min).
-- La columna recordatorio_telegram_15m_at se reutiliza como "ya se envió el aviso" (nombre histórico).
BEGIN;

COMMENT ON COLUMN public.citas_asesor_tecnico.recordatorio_telegram_15m_at IS
  'Cuándo se envió el aviso por Telegram (~30 min antes de fecha_cita). NULL = aún no enviado.';

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
    AND c.fecha_cita >= (now() + interval '27 minutes')
    AND c.fecha_cita <= (now() + interval '33 minutes');
$$;

GRANT EXECUTE ON FUNCTION public.obtener_citas_recordatorio_telegram_15m() TO service_role;

COMMIT;
