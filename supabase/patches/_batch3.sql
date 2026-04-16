DROP TRIGGER IF EXISTS trigger_crear_factura_automatica_op ON public.ordenes_trabajo;
CREATE TRIGGER trigger_crear_factura_automatica_op
AFTER UPDATE ON public.ordenes_trabajo
FOR EACH ROW
WHEN (
  (NEW.entregado = true AND (OLD.entregado IS NULL OR OLD.entregado = false))
  OR (NEW.estado = 'Finalizado' AND OLD.estado != 'Finalizado')
)
EXECUTE FUNCTION public.crear_factura_automatica_op();

-- ============================================
-- 13. POLÃTICAS RLS (Row Level Security)
-- VersiÃ³n Supabase: auth.uid() es uuid â€” no usar auth.uid()::integer.
-- PolÃ­ticas permisivas anon + authenticated (alineado a facturas_compra / depÃ³sitos en este proyecto).
-- ============================================

ALTER TABLE public.plan_cuentas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.asientos_contables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.asientos_detalle ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturas_venta ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturas_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.costos_op ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cuentas_por_pagar ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pagos_cobros ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.configuracion_afip ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan cuentas lectura" ON public.plan_cuentas;

DROP POLICY IF EXISTS "Plan cuentas escritura" ON public.plan_cuentas;

DROP POLICY IF EXISTS "Asientos lectura" ON public.asientos_contables;

DROP POLICY IF EXISTS "Asientos escritura" ON public.asientos_contables;

DROP POLICY IF EXISTS "Facturas lectura" ON public.facturas_venta;

DROP POLICY IF EXISTS "Facturas escritura" ON public.facturas_venta;

DROP POLICY IF EXISTS "Costos lectura" ON public.costos_op;

DROP POLICY IF EXISTS "Costos escritura" ON public.costos_op;

DROP POLICY IF EXISTS "CXC lectura" ON public.cuentas_por_cobrar;

DROP POLICY IF EXISTS "CXC escritura" ON public.cuentas_por_cobrar;

DROP POLICY IF EXISTS "CXP lectura" ON public.cuentas_por_pagar;

DROP POLICY IF EXISTS "CXP escritura" ON public.cuentas_por_pagar;

DROP POLICY IF EXISTS "AFIP solo admin" ON public.configuracion_afip;

DROP POLICY IF EXISTS "erp_plan_cuentas_all" ON public.plan_cuentas;

DROP POLICY IF EXISTS "erp_asientos_contables_all" ON public.asientos_contables;

DROP POLICY IF EXISTS "erp_asientos_detalle_all" ON public.asientos_detalle;

DROP POLICY IF EXISTS "erp_facturas_venta_all" ON public.facturas_venta;

DROP POLICY IF EXISTS "erp_facturas_items_all" ON public.facturas_items;

DROP POLICY IF EXISTS "erp_costos_op_all" ON public.costos_op;

DROP POLICY IF EXISTS "erp_cxc_all" ON public.cuentas_por_cobrar;

DROP POLICY IF EXISTS "erp_cxp_all" ON public.cuentas_por_pagar;

DROP POLICY IF EXISTS "erp_pagos_cobros_all" ON public.pagos_cobros;

DROP POLICY IF EXISTS "erp_config_afip_all" ON public.configuracion_afip;

CREATE POLICY "erp_plan_cuentas_all" ON public.plan_cuentas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_asientos_contables_all" ON public.asientos_contables FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_asientos_detalle_all" ON public.asientos_detalle FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_facturas_venta_all" ON public.facturas_venta FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_facturas_items_all" ON public.facturas_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_costos_op_all" ON public.costos_op FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_cxc_all" ON public.cuentas_por_cobrar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_cxp_all" ON public.cuentas_por_pagar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_pagos_cobros_all" ON public.pagos_cobros FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_config_afip_all" ON public.configuracion_afip FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 14. DATOS INICIALES - PLAN DE CUENTAS BÃSICO
-- ============================================

-- Insertar plan de cuentas bÃ¡sico (estructura simplificada)
INSERT INTO public.plan_cuentas (codigo, nombre, tipo, nivel, naturaleza, activa) VALUES
-- Activos
('1', 'ACTIVO', 'Activo', 1, 'Deudora', true),
('1.1', 'Activo Corriente', 'Activo', 2, 'Deudora', true),
('1.1.1', 'Caja y Bancos', 'Activo', 3, 'Deudora', true),
('1.1.1.01', 'Caja', 'Activo', 4, 'Deudora', true),
('1.1.1.02', 'Bancos Cta. Cte.', 'Activo', 4, 'Deudora', true),
('1.1.1.03', 'Clientes', 'Activo', 4, 'Deudora', true),
('1.1.2', 'CrÃ©ditos', 'Activo', 3, 'Deudora', true),
('1.1.2.01', 'IVA DÃ©bito Fiscal', 'Activo', 4, 'Deudora', true),
('1.2', 'Activo No Corriente', 'Activo', 2, 'Deudora', true),
-- Pasivos
('2', 'PASIVO', 'Pasivo', 1, 'Acreedora', true),
('2.1', 'Pasivo Corriente', 'Pasivo', 2, 'Acreedora', true),
('2.1.1', 'Proveedores', 'Pasivo', 3, 'Acreedora', true),
('2.1.1.01', 'Proveedores', 'Pasivo', 4, 'Acreedora', true),
('2.1.2', 'Obligaciones Fiscales', 'Pasivo', 3, 'Acreedora', true),
('2.1.2.01', 'IVA CrÃ©dito Fiscal', 'Pasivo', 4, 'Acreedora', true),
-- Patrimonio
('3', 'PATRIMONIO', 'Patrimonio', 1, 'Acreedora', true),
('3.1', 'Capital', 'Patrimonio', 2, 'Acreedora', true),
('3.1.1', 'Capital Social', 'Patrimonio', 3, 'Acreedora', true),
-- Ingresos
('4', 'INGRESOS', 'Ingreso', 1, 'Acreedora', true),
('4.1', 'Ventas', 'Ingreso', 2, 'Acreedora', true),
('4.1.1', 'Ventas de Productos', 'Ingreso', 3, 'Acreedora', true),
('4.1.1.01', 'Ventas de Productos', 'Ingreso', 4, 'Acreedora', true),
-- Costos
('5', 'COSTOS', 'Costo', 1, 'Deudora', true),
('5.1', 'Costo de Ventas', 'Costo', 2, 'Deudora', true),
('5.1.1', 'Costo de Productos Vendidos', 'Costo', 3, 'Deudora', true),
('5.1.1.01', 'Costo de Productos Vendidos', 'Costo', 4, 'Deudora', true),
-- Gastos
('6', 'GASTOS', 'Gasto', 1, 'Deudora', true),
('6.1', 'Gastos de AdministraciÃ³n', 'Gasto', 2, 'Deudora', true),
('6.1.1', 'Sueldos y Cargas Sociales', 'Gasto', 3, 'Deudora', true),
('6.1.2', 'Alquileres', 'Gasto', 3, 'Deudora', true),
('6.1.3', 'Servicios PÃºblicos', 'Gasto', 3, 'Deudora', true)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- COMENTARIOS FINALES
-- ============================================
COMMENT ON TABLE public.plan_cuentas IS 'Plan de cuentas contable del sistema ERP';

COMMENT ON TABLE public.asientos_contables IS 'Asientos contables con partida doble';

COMMENT ON TABLE public.facturas_venta IS 'Facturas de venta con preparaciÃ³n para AFIP';

COMMENT ON TABLE public.costos_op IS 'Control de costos por orden de trabajo';

COMMENT ON TABLE public.cuentas_por_cobrar IS 'Cuentas por cobrar de clientes';

COMMENT ON TABLE public.cuentas_por_pagar IS 'Cuentas por pagar a proveedores';

COMMENT ON TABLE public.configuracion_afip IS 'ConfiguraciÃ³n para facturaciÃ³n electrÃ³nica AFIP';