-- Marca de reclamo en ficha (trazabilidad + UI: bordes en tablero)
BEGIN;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS en_reclamo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ordenes_trabajo.en_reclamo IS
  'Cliente/equipo marcó reclamo: trabajo a rehacer; visible en tablero y comentarios.';

COMMIT;
