-- Pagos parciales de gastos fijos: varios movimientos por (id_gasto_fijo, periodo_fijo).
-- Cada fila en erp_gastos queda como trazabilidad (igual que un gasto corriente).
-- Idempotente.

DROP INDEX IF EXISTS public.erp_gastos_fijo_periodo_uidx;

CREATE INDEX IF NOT EXISTS erp_gastos_fijo_periodo_idx
  ON public.erp_gastos (id_gasto_fijo, periodo_fijo)
  WHERE id_gasto_fijo IS NOT NULL;

COMMENT ON COLUMN public.erp_gastos.periodo_fijo IS
  'Período YYYY-MM del gasto fijo. Puede haber varios pagos (parciales) para el mismo id_gasto_fijo+periodo_fijo.';

NOTIFY pgrst, 'reload schema';
