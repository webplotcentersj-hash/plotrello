-- Litros de combustible declarados al marcar llegada (historial / cierre de viaje)
ALTER TABLE public.registros_salidas_vehiculos
  ADD COLUMN IF NOT EXISTS litros_combustible_llegada NUMERIC(10, 2);

COMMENT ON COLUMN public.registros_salidas_vehiculos.litros_combustible_llegada IS
  'Litros cargados o informados al momento de marcar llegada (conductor).';
