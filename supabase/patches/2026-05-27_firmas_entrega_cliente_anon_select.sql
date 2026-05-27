-- Fix: upsert en /firma-cliente fallaba con RLS porque anon no podía SELECT.
-- INSERT ... ON CONFLICT DO UPDATE requiere ver la fila existente (y en PG, validar UPDATE).
CREATE POLICY "firmas_entrega_cliente_anon_select"
  ON public.firmas_entrega_cliente FOR SELECT
  TO anon
  USING (true);
