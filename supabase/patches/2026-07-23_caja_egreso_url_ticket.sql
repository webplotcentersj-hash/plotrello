-- Ticket/comprobante adjunto en solicitudes de egreso de caja.
ALTER TABLE public.control_caja_egreso_solicitudes
  ADD COLUMN IF NOT EXISTS url_ticket text;
