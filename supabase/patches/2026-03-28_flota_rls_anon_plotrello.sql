-- Flota + Plotrello: la app usa login propio (usuarios en localStorage), no Supabase Auth.
-- El cliente JS usa la anon key sin sesión JWT → rol `anon`. Sin políticas para `anon`,
-- SELECT devuelve 0 filas aunque existan datos (parece "SIN BD").
--
-- Ejecutar en Supabase SQL Editor después del patch 2025-01-21.

BEGIN;

GRANT SELECT ON public.vehiculos TO anon;
GRANT SELECT, INSERT, UPDATE ON public.registros_salidas_vehiculos TO anon;
-- Inserts con SERIAL necesitan uso de la secuencia:
GRANT USAGE, SELECT ON SEQUENCE public.vehiculos_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.registros_salidas_vehiculos_id_seq TO anon;

DROP POLICY IF EXISTS "anon puede leer vehículos" ON public.vehiculos;
CREATE POLICY "anon puede leer vehículos"
  ON public.vehiculos FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "anon puede leer registros salidas" ON public.registros_salidas_vehiculos;
CREATE POLICY "anon puede leer registros salidas"
  ON public.registros_salidas_vehiculos FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "anon puede insertar registros salidas" ON public.registros_salidas_vehiculos;
CREATE POLICY "anon puede insertar registros salidas"
  ON public.registros_salidas_vehiculos FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon puede actualizar registros salidas" ON public.registros_salidas_vehiculos;
CREATE POLICY "anon puede actualizar registros salidas"
  ON public.registros_salidas_vehiculos FOR UPDATE
  TO anon
  USING (true);

GRANT EXECUTE ON FUNCTION public.actualizar_estado_vehiculos_retrasados() TO anon;

COMMIT;
