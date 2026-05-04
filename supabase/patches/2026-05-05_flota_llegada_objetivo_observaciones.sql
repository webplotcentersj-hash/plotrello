-- Cierre de viaje (llegada): objetivo cumplido + observaciones del conductor

BEGIN;

ALTER TABLE public.registros_salidas_vehiculos
  ADD COLUMN IF NOT EXISTS objetivo_cumplido boolean NULL,
  ADD COLUMN IF NOT EXISTS observaciones_llegada text NULL;

COMMENT ON COLUMN public.registros_salidas_vehiculos.litros_combustible_llegada IS
  'Combustible que queda en el tanque al marcar llegada (litros).';

COMMENT ON COLUMN public.registros_salidas_vehiculos.objetivo_cumplido IS
  'Indica si se cumplió el objetivo de la salida (sí/no), informado al llegar.';

COMMENT ON COLUMN public.registros_salidas_vehiculos.observaciones_llegada IS
  'Notas del conductor al cerrar el tramo (llegada).';

COMMIT;
