-- Saldo pendiente en OP (pago parcial). Visible en fichas.
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS monto_saldo_pendiente numeric;

COMMENT ON COLUMN public.ordenes_trabajo.monto_saldo_pendiente IS
  'Saldo pendiente de cobro cuando hay pago parcial. Visible en fichas OP.';
