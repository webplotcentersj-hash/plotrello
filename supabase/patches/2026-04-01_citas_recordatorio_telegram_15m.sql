-- Recordatorio Telegram 15 min antes de la cita (cron Vercel + bot)
BEGIN;

ALTER TABLE public.citas_asesor_tecnico
  ADD COLUMN IF NOT EXISTS recordatorio_telegram_15m_at timestamptz NULL;

COMMENT ON COLUMN public.citas_asesor_tecnico.recordatorio_telegram_15m_at IS 'Cuándo se envió el aviso por Telegram (~15 min antes de fecha_cita). NULL = aún no enviado.';

-- Si cambia la hora de la cita, volver a permitir un recordatorio
CREATE OR REPLACE FUNCTION public.trg_citas_reset_recordatorio_telegram()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fecha_cita IS DISTINCT FROM OLD.fecha_cita THEN
    NEW.recordatorio_telegram_15m_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS citas_reset_recordatorio_telegram ON public.citas_asesor_tecnico;
CREATE TRIGGER citas_reset_recordatorio_telegram
  BEFORE UPDATE ON public.citas_asesor_tecnico
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_citas_reset_recordatorio_telegram();

-- Citas que entran en la ventana "entre 14 y 16 minutos" antes (cron cada ~1 min)
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
    AND lower(trim(c.estado)) NOT IN ('completada', 'cancelada')
    AND c.fecha_cita >= (now() + interval '14 minutes')
    AND c.fecha_cita <= (now() + interval '16 minutes');
$$;

GRANT EXECUTE ON FUNCTION public.obtener_citas_recordatorio_telegram_15m() TO service_role;

COMMIT;
