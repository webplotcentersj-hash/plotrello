-- Admin/Caja: borrar vehículos desde la app (Supabase anon, igual que UPDATE en flota).
-- registros_salidas_vehiculos tiene ON DELETE CASCADE → se elimina el historial de ese vehículo.

BEGIN;

GRANT DELETE ON public.vehiculos TO anon;

DROP POLICY IF EXISTS "anon puede borrar vehículos" ON public.vehiculos;
CREATE POLICY "anon puede borrar vehículos"
  ON public.vehiculos FOR DELETE
  TO anon
  USING (true);

COMMIT;
