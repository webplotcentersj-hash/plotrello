-- Permitir que anon lea ordenes_trabajo para la página pública de firma (tablet) y estado OP (QR)
-- Sin esto, la tablet sin login ve "Orden no encontrada".
CREATE POLICY "ordenes_trabajo_anon_select"
  ON public.ordenes_trabajo FOR SELECT
  TO anon
  USING (true);
