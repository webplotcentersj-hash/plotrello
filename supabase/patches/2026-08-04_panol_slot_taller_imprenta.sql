-- Pañol Taller de Imprenta: casillero A1–Z3 (letra + fila 1–3).
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS panol_slot text;

COMMENT ON COLUMN public.ordenes_trabajo.panol_slot IS
  'Casillero del pañol de Taller de Imprenta (A1–Z3: letra A–Z + fila 1–3).';

CREATE INDEX IF NOT EXISTS idx_ordenes_panol_slot
  ON public.ordenes_trabajo (panol_slot)
  WHERE panol_slot IS NOT NULL;
