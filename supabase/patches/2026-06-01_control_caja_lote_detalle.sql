-- Detalle exportable en cierre de turno (planilla resumen, comprobantes, ids movimientos)
BEGIN;

ALTER TABLE public.control_caja_transferencia_lotes
  ADD COLUMN IF NOT EXISTS detalle jsonb;

COMMIT;
