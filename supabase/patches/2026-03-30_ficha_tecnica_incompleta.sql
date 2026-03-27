-- Casillero manual: ficha técnica aún incompleta (gestión asesor/presupuestos)
-- Aplicar en Supabase SQL Editor.

BEGIN;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS ficha_tecnica_incompleta boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ordenes_trabajo.ficha_tecnica_incompleta IS
  'Marcado manual en UI si la ficha técnica está incompleta (no automático).';

COMMIT;
