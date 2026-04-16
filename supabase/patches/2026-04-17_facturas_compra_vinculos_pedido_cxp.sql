-- Vínculos opcionales: factura de compra ↔ pedido de compra / cuenta por pagar (circuito ERP).
-- Aplicar en Supabase después de 2026-04-16_facturas_compra_libro_iva_compras.sql

BEGIN;

ALTER TABLE public.facturas_compra
  ADD COLUMN IF NOT EXISTS id_pedido_compra integer REFERENCES public.pedidos_compras(id) ON DELETE SET NULL;

ALTER TABLE public.facturas_compra
  ADD COLUMN IF NOT EXISTS id_cuenta_por_pagar integer REFERENCES public.cuentas_por_pagar(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_compra_pedido ON public.facturas_compra(id_pedido_compra);
CREATE INDEX IF NOT EXISTS idx_facturas_compra_cxp ON public.facturas_compra(id_cuenta_por_pagar);

COMMENT ON COLUMN public.facturas_compra.id_pedido_compra IS 'Pedido de compra origen (precarga IVA compras / ERP).';
COMMENT ON COLUMN public.facturas_compra.id_cuenta_por_pagar IS 'Cuenta por pagar vinculada al comprobante.';

COMMIT;
