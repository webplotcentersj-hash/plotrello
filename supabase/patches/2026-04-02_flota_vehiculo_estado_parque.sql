-- Estado operativo del parque (fuera de servicio, taller, etc.) editable por admin/caja vía la app.
-- Solo vehículos en estado_parque = 'disponible' pueden tener nuevas solicitudes de salida.

BEGIN;

ALTER TABLE public.vehiculos
  ADD COLUMN IF NOT EXISTS estado_parque TEXT NOT NULL DEFAULT 'disponible';

ALTER TABLE public.vehiculos
  ADD COLUMN IF NOT EXISTS estado_parque_detalle TEXT;

UPDATE public.vehiculos
SET estado_parque = 'disponible'
WHERE estado_parque IS NULL OR trim(estado_parque) = '';

ALTER TABLE public.vehiculos DROP CONSTRAINT IF EXISTS vehiculos_estado_parque_check;
ALTER TABLE public.vehiculos ADD CONSTRAINT vehiculos_estado_parque_check
  CHECK (estado_parque IN ('disponible', 'fuera_servicio', 'en_taller', 'otro'));

CREATE OR REPLACE FUNCTION public.registro_salida_solo_vehiculo_disponible()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ep text;
  act boolean;
BEGIN
  SELECT COALESCE(v.estado_parque, 'disponible'), COALESCE(v.activo, true)
  INTO ep, act
  FROM public.vehiculos v
  WHERE v.id = NEW.id_vehiculo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehículo no encontrado';
  END IF;

  IF act = false OR ep <> 'disponible' THEN
    RAISE EXCEPTION 'El vehículo no está disponible para solicitar salida (estado: %)', ep;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registro_salida_vehiculo_disponible ON public.registros_salidas_vehiculos;
CREATE TRIGGER trg_registro_salida_vehiculo_disponible
  BEFORE INSERT ON public.registros_salidas_vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.registro_salida_solo_vehiculo_disponible();

GRANT UPDATE ON public.vehiculos TO anon;

DROP POLICY IF EXISTS "anon puede actualizar vehículos estado parque" ON public.vehiculos;
CREATE POLICY "anon puede actualizar vehículos estado parque"
  ON public.vehiculos FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

COMMIT;
