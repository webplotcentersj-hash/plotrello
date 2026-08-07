-- Estado de cobro OP: Cuenta corriente (CC)
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS pago_cuenta_corriente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ordenes_trabajo.pago_cuenta_corriente IS
  'OP a cuenta corriente (CC). Excluyente con marcada_pagada / sin_pago / monto_pago_parcial en UI.';

UPDATE public.ordenes_trabajo
SET pago_cuenta_corriente = false
WHERE marcada_pagada IS TRUE AND pago_cuenta_corriente IS TRUE;
