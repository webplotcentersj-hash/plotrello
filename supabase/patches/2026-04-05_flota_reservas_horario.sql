-- Franja horaria en reservas de flota (Argentina).
-- La reserva sigue siendo una por vehículo y día (pendiente/aprobada).
-- Solo bloquea salida si hora_salida (AR) cae dentro de [hora_desde, hora_hasta].

BEGIN;

ALTER TABLE public.reservas_vehiculos_flota
  ADD COLUMN IF NOT EXISTS hora_desde TIME NOT NULL DEFAULT '00:00:00';

ALTER TABLE public.reservas_vehiculos_flota
  ADD COLUMN IF NOT EXISTS hora_hasta TIME NOT NULL DEFAULT '23:59:59';

ALTER TABLE public.reservas_vehiculos_flota
  DROP CONSTRAINT IF EXISTS reservas_flota_horario_coherente;

ALTER TABLE public.reservas_vehiculos_flota
  ADD CONSTRAINT reservas_flota_horario_coherente CHECK (hora_desde <= hora_hasta);

CREATE OR REPLACE FUNCTION public.registro_salida_respeta_reserva_aprobada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  d date;
  t time;
  reservante int;
BEGIN
  d := (timezone('America/Argentina/Buenos_Aires', NEW.hora_salida))::date;
  t := (timezone('America/Argentina/Buenos_Aires', NEW.hora_salida))::time;

  SELECT r.id_usuario INTO reservante
  FROM public.reservas_vehiculos_flota r
  WHERE r.id_vehiculo = NEW.id_vehiculo
    AND r.fecha = d
    AND r.estado = 'aprobada'
    AND t >= r.hora_desde
    AND t <= r.hora_hasta
  LIMIT 1;

  IF FOUND AND reservante IS NOT NULL AND reservante IS DISTINCT FROM NEW.id_usuario THEN
    RAISE EXCEPTION 'Reserva aprobada: este vehículo está reservado en ese horario para ese día por otro usuario.';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
