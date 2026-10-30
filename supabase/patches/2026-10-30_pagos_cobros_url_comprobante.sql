-- Comprobante adjunto en cobros/pagos (transferencia / depósito)
ALTER TABLE public.pagos_cobros
  ADD COLUMN IF NOT EXISTS url_comprobante text;

COMMENT ON COLUMN public.pagos_cobros.url_comprobante IS
  'URL del comprobante adjunto (transferencia/depósito), Storage archivos.';

-- Nota: comercial_upsert se actualiza vía migración aplicada en Supabase
-- (pagos_cobros_url_comprobante) para aceptar url_comprobante en kind pago_cobro.
