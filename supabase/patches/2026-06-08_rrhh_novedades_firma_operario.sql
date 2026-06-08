-- Firma del operario en notificación de novedad RRHH.

BEGIN;

ALTER TABLE public.rrhh_novedades
  ADD COLUMN IF NOT EXISTS firma_data_url text,
  ADD COLUMN IF NOT EXISTS firmado_at timestamptz;

COMMENT ON COLUMN public.rrhh_novedades.firma_data_url IS
  'Firma digital del empleado (data URL PNG) al tomar conocimiento de la novedad.';
COMMENT ON COLUMN public.rrhh_novedades.firmado_at IS
  'Fecha/hora en que el empleado firmó la notificación.';

COMMIT;
