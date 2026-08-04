-- Estado de cobro manual en OP: pago parcial (monto) y sin pago.
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS sin_pago boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monto_pago_parcial numeric;

COMMENT ON COLUMN public.ordenes_trabajo.sin_pago IS
  'Marca manual: OP sin pago (visible en ficha del tablero).';
COMMENT ON COLUMN public.ordenes_trabajo.monto_pago_parcial IS
  'Monto de seña / pago parcial marcado al crear o editar la OP.';
