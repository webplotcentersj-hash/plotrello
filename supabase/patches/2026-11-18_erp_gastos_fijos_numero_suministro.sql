-- Nº de suministro / cliente en gastos fijos (luz, agua, gas, internet…).
-- Idempotente.

ALTER TABLE public.erp_gastos_fijos
  ADD COLUMN IF NOT EXISTS numero_suministro text;

COMMENT ON COLUMN public.erp_gastos_fijos.numero_suministro IS
  'Nº de suministro / cliente del servicio (luz, agua, gas, internet…).';
