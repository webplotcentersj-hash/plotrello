-- Desglose por medio de pago (planilla Plot Center) y traspaso_id
BEGIN;

ALTER TABLE public.control_caja_movimientos
  ADD COLUMN IF NOT EXISTS traspaso_id uuid,
  ADD COLUMN IF NOT EXISTS medios jsonb;

COMMIT;
