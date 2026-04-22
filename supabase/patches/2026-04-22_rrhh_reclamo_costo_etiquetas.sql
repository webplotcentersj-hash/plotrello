-- Costo extra (remake/materiales) y etiquetas de causa RRHH por reclamo de OP
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS reclamo_costo_monto numeric(14, 2),
  ADD COLUMN IF NOT EXISTS reclamo_etiquetas text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.ordenes_trabajo.reclamo_costo_monto IS 'Costo monetario extra asociado al reclamo (remake, materiales, etc.) — RRHH incidencias';
COMMENT ON COLUMN public.ordenes_trabajo.reclamo_etiquetas IS 'Etiquetas de clasificación de causa (RRHH incidencias)';
