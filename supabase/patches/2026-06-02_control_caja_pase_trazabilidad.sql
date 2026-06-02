-- Pase de caja: montos en origen/destino antes y después del movimiento (trazabilidad)
BEGIN;

ALTER TABLE public.control_caja_movimientos
  ADD COLUMN IF NOT EXISTS origen_efectivo_antes numeric(15,2),
  ADD COLUMN IF NOT EXISTS origen_otros_antes numeric(15,2),
  ADD COLUMN IF NOT EXISTS destino_efectivo_antes numeric(15,2),
  ADD COLUMN IF NOT EXISTS destino_otros_antes numeric(15,2),
  ADD COLUMN IF NOT EXISTS origen_efectivo_despues numeric(15,2),
  ADD COLUMN IF NOT EXISTS origen_otros_despues numeric(15,2),
  ADD COLUMN IF NOT EXISTS destino_efectivo_despues numeric(15,2),
  ADD COLUMN IF NOT EXISTS destino_otros_despues numeric(15,2);

COMMENT ON COLUMN public.control_caja_movimientos.origen_efectivo_antes IS 'Efectivo en caja origen al momento del pase';
COMMENT ON COLUMN public.control_caja_movimientos.destino_efectivo_antes IS 'Efectivo en caja destino al momento del pase';
COMMENT ON COLUMN public.control_caja_movimientos.origen_efectivo_despues IS 'Efectivo en caja origen después del pase (calculado)';

COMMIT;
