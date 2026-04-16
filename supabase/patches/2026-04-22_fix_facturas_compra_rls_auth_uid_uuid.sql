-- Si ya ejecutaste el bundle y falló con: cannot cast type uuid to integer (42846),
-- corregí las políticas de facturas_compra que usaban auth.uid()::integer.
-- Ejecutá solo este script (es idempotente).

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturas_compra TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturas_compra_items TO anon, authenticated;

DO $$
DECLARE
  s text;
BEGIN
  s := pg_get_serial_sequence('public.facturas_compra', 'id');
  IF s IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', s);
  END IF;
  s := pg_get_serial_sequence('public.facturas_compra_items', 'id');
  IF s IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', s);
  END IF;
END $$;

DROP POLICY IF EXISTS "facturas_compra lectura" ON public.facturas_compra;
CREATE POLICY "facturas_compra lectura" ON public.facturas_compra
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "facturas_compra_items lectura" ON public.facturas_compra_items;
CREATE POLICY "facturas_compra_items lectura" ON public.facturas_compra_items
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "facturas_compra escritura" ON public.facturas_compra;
CREATE POLICY "facturas_compra escritura" ON public.facturas_compra
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "facturas_compra_items escritura" ON public.facturas_compra_items;
CREATE POLICY "facturas_compra_items escritura" ON public.facturas_compra_items
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMIT;
