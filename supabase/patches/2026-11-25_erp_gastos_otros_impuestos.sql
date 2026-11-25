-- 2026-11-25 — Otros impuestos en erp_gastos (además de IVA), alineados a facturas_compra / Libro IVA.
ALTER TABLE public.erp_gastos
  ADD COLUMN IF NOT EXISTS percepcion_iva numeric(14, 2),
  ADD COLUMN IF NOT EXISTS percepcion_otros_nac numeric(14, 2),
  ADD COLUMN IF NOT EXISTS percepcion_iibb numeric(14, 2),
  ADD COLUMN IF NOT EXISTS percepcion_municipal numeric(14, 2),
  ADD COLUMN IF NOT EXISTS impuestos_internos numeric(14, 2),
  ADD COLUMN IF NOT EXISTS otros_tributos numeric(14, 2);

COMMENT ON COLUMN public.erp_gastos.percepcion_iva IS 'Percepción de IVA del comprobante de compra';
COMMENT ON COLUMN public.erp_gastos.percepcion_otros_nac IS 'Otras percepciones / pagos a cuenta nacionales';
COMMENT ON COLUMN public.erp_gastos.percepcion_iibb IS 'Percepción de Ingresos Brutos';
COMMENT ON COLUMN public.erp_gastos.percepcion_municipal IS 'Percepción municipal';
COMMENT ON COLUMN public.erp_gastos.impuestos_internos IS 'Impuestos internos';
COMMENT ON COLUMN public.erp_gastos.otros_tributos IS 'Otros tributos del comprobante';
