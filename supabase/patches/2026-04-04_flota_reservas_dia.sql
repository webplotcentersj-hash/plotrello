-- Reservas por día: un usuario agenda un vehículo; Caja/Admin aprueba.
-- Solo una reserva activa (pendiente o aprobada) por vehículo y fecha.
-- Si hay reserva aprobada para ese día, solo ese usuario puede insertar solicitud de salida (trigger + app).

BEGIN;

CREATE TABLE IF NOT EXISTS public.reservas_vehiculos_flota (
  id SERIAL PRIMARY KEY,
  id_vehiculo INTEGER NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  id_usuario INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nombre_usuario TEXT NOT NULL,
  fecha DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente_aprobacion'
    CHECK (estado IN ('pendiente_aprobacion', 'aprobada', 'rechazada', 'cancelada')),
  motivo TEXT,
  id_usuario_reviso INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nombre_revisor TEXT,
  revisado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reservas_vehiculos_flota_vehiculo_fecha_activa
  ON public.reservas_vehiculos_flota (id_vehiculo, fecha)
  WHERE estado IN ('pendiente_aprobacion', 'aprobada');

CREATE INDEX IF NOT EXISTS idx_reservas_flota_fecha ON public.reservas_vehiculos_flota (fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_flota_estado ON public.reservas_vehiculos_flota (estado);

DROP TRIGGER IF EXISTS update_reservas_vehiculos_flota_updated_at ON public.reservas_vehiculos_flota;
CREATE TRIGGER update_reservas_vehiculos_flota_updated_at
  BEFORE UPDATE ON public.reservas_vehiculos_flota
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.registro_salida_respeta_reserva_aprobada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  d date;
  reservante int;
BEGIN
  d := (timezone('America/Argentina/Buenos_Aires', NEW.hora_salida))::date;

  SELECT r.id_usuario INTO reservante
  FROM public.reservas_vehiculos_flota r
  WHERE r.id_vehiculo = NEW.id_vehiculo
    AND r.fecha = d
    AND r.estado = 'aprobada'
  LIMIT 1;

  IF FOUND AND reservante IS NOT NULL AND reservante IS DISTINCT FROM NEW.id_usuario THEN
    RAISE EXCEPTION 'Reserva aprobada: este vehículo está reservado para ese día por otro usuario.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registro_salida_reserva_aprobada ON public.registros_salidas_vehiculos;
CREATE TRIGGER trg_registro_salida_reserva_aprobada
  BEFORE INSERT ON public.registros_salidas_vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.registro_salida_respeta_reserva_aprobada();

ALTER TABLE public.reservas_vehiculos_flota ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.reservas_vehiculos_flota TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.reservas_vehiculos_flota_id_seq TO anon;

DROP POLICY IF EXISTS "anon lee reservas flota" ON public.reservas_vehiculos_flota;
CREATE POLICY "anon lee reservas flota"
  ON public.reservas_vehiculos_flota FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "anon inserta reservas flota" ON public.reservas_vehiculos_flota;
CREATE POLICY "anon inserta reservas flota"
  ON public.reservas_vehiculos_flota FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon actualiza reservas flota" ON public.reservas_vehiculos_flota;
CREATE POLICY "anon actualiza reservas flota"
  ON public.reservas_vehiculos_flota FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

COMMIT;
