-- Columna para migración desde sistema PHP (postulantes legacy)

ALTER TABLE public.rrhh_postulaciones
  ADD COLUMN IF NOT EXISTS legacy_id integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rrhh_postulaciones_legacy_id
  ON public.rrhh_postulaciones (legacy_id)
  WHERE legacy_id IS NOT NULL;

COMMENT ON COLUMN public.rrhh_postulaciones.legacy_id IS
  'ID del sistema PHP u956355532_postulaciones; usado para importación única.';
