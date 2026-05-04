-- Acompañantes en solicitud de salida de flota (JSON: [{ "id_usuario", "nombre" }, ...])

BEGIN;

ALTER TABLE public.registros_salidas_vehiculos
  ADD COLUMN IF NOT EXISTS acompanantes jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.registros_salidas_vehiculos.acompanantes IS
  'Usuarios que acompañan en la salida (id_usuario + nombre). Vacío si viaja solo el conductor.';

COMMIT;
