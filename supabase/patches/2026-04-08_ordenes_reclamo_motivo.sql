-- Texto del motivo de reclamo (visible en ficha / modal sin parsear comentarios)
BEGIN;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS reclamo_motivo text;

COMMENT ON COLUMN public.ordenes_trabajo.reclamo_motivo IS
  'Detalle opcional del reclamo; se limpia al quitar la marca en_reclamo.';

COMMIT;
