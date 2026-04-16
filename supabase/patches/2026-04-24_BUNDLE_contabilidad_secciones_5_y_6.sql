-- =============================================================================
-- POST 1–4: contabilidad / tesorería (secciones 5 y 6 del bundle 2026-04-21).
-- Ejecutar en Supabase SQL Editor DESPUÉS de 2026-04-23_BUNDLE_iva_compras_y_stock.
--
-- Antes de correr, verificá que exista lo que usa cada parte:
--
--   SELECT proname FROM pg_proc WHERE proname = 'generar_numero_asiento';
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--     AND tablename IN (
--       'facturas_venta', 'plan_cuentas', 'asientos_contables', 'asientos_detalle',
--       'pagos_cobros', 'cuentas_por_cobrar', 'cuentas_por_pagar'
--     );
--
-- Si falta facturas_venta o plan_cuentas / asientos / pagos_cobros, NO ejecutes
-- la sección que los requiere (o aplicá antes el ERP base, p. ej. 2025-01-23).
--
-- Sección 5: columna id_factura_referencia + función crear_asiento_desde_factura
-- Sección 6: función crear_asiento_desde_pago_cobro
-- =============================================================================


-- =============================================================================
-- SECCIÓN 5 — 2026-04-16_facturas_notas_credito_debito.sql (ventas / AFIP)
-- Sobrescribe public.crear_asiento_desde_factura si ya existía.
-- =============================================================================
BEGIN;

SET LOCAL check_function_bodies TO FALSE;

ALTER TABLE IF EXISTS public.facturas_venta
  ADD COLUMN IF NOT EXISTS id_factura_referencia integer NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facturas_venta'
      AND column_name = 'id_factura_referencia'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'facturas_venta'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'facturas_venta_id_factura_referencia_fkey'
    ) THEN
      ALTER TABLE public.facturas_venta
        ADD CONSTRAINT facturas_venta_id_factura_referencia_fkey
        FOREIGN KEY (id_factura_referencia)
        REFERENCES public.facturas_venta(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END$$;

DO $$
BEGIN
  IF to_regclass('public.facturas_venta') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_facturas_referencia ON public.facturas_venta(id_factura_referencia)';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.crear_asiento_desde_factura(
  p_id_factura integer
)
RETURNS integer AS $$
DECLARE
  v_factura RECORD;
  v_asiento_id integer;
  v_numero_asiento varchar(50);
  v_cuenta_ventas integer;
  v_cuenta_iva integer;
  v_cuenta_clientes integer;
  v_total numeric;
  v_subtotal numeric;
  v_iva numeric;
  v_es_nota_credito boolean := false;
BEGIN
  SELECT * INTO v_factura
  FROM public.facturas_venta
  WHERE id = p_id_factura;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada: %', p_id_factura;
  END IF;

  v_es_nota_credito := (v_factura.tipo_comprobante LIKE 'Nota de Crédito%');
  v_total := ABS(COALESCE(v_factura.total, 0));
  v_subtotal := ABS(COALESCE(v_factura.subtotal, 0));
  v_iva := ABS(COALESCE(v_factura.iva, 0));

  SELECT id INTO v_cuenta_ventas
  FROM public.plan_cuentas
  WHERE codigo = '4.1.1.01'
  LIMIT 1;

  SELECT id INTO v_cuenta_iva
  FROM public.plan_cuentas
  WHERE codigo = '1.1.2.01'
  LIMIT 1;

  SELECT id INTO v_cuenta_clientes
  FROM public.plan_cuentas
  WHERE codigo = '1.1.1.03'
  LIMIT 1;

  v_numero_asiento := public.generar_numero_asiento();

  INSERT INTO public.asientos_contables (
    numero_asiento,
    fecha,
    concepto,
    tipo_asiento,
    id_origen,
    tipo_origen,
    total_debe,
    total_haber,
    estado
  ) VALUES (
    v_numero_asiento,
    v_factura.fecha_emision,
    v_factura.tipo_comprobante || ' ' || v_factura.numero_factura || ' - ' || v_factura.cliente_nombre,
    'Facturación',
    v_factura.id,
    'factura',
    v_total,
    v_total,
    'Contabilizado'
  ) RETURNING id INTO v_asiento_id;

  IF v_es_nota_credito THEN
    IF v_cuenta_ventas IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_ventas, v_subtotal, 0, 'Reversa ventas (nota crédito)');
    END IF;

    IF v_cuenta_iva IS NOT NULL AND v_iva > 0 THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_iva, v_iva, 0, 'Reversa IVA débito fiscal (nota crédito)');
    END IF;

    IF v_cuenta_clientes IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_clientes, 0, v_total, 'Cliente (nota crédito): ' || v_factura.cliente_nombre);
    END IF;
  ELSE
    IF v_cuenta_clientes IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_clientes, v_total, 0, 'Cliente: ' || v_factura.cliente_nombre);
    END IF;

    IF v_cuenta_ventas IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_ventas, 0, v_subtotal, 'Ventas');
    END IF;

    IF v_cuenta_iva IS NOT NULL AND v_iva > 0 THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_iva, 0, v_iva, 'IVA Débito Fiscal');
    END IF;
  END IF;

  UPDATE public.facturas_venta
  SET id_asiento_contable = v_asiento_id
  WHERE id = p_id_factura;

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;


-- =============================================================================
-- SECCIÓN 6 — 2026-04-16_pagos_cobros_asientos_automaticos.sql
-- =============================================================================
BEGIN;

SET LOCAL check_function_bodies TO FALSE;

CREATE OR REPLACE FUNCTION public.crear_asiento_desde_pago_cobro(
  p_id_pago_cobro integer
)
RETURNS integer AS $$
DECLARE
  v_pc RECORD;
  v_cxc RECORD;
  v_cxp RECORD;
  v_asiento_id integer;
  v_numero_asiento varchar(50);
  v_cuenta_caja integer;
  v_cuenta_bancos integer;
  v_cuenta_clientes integer;
  v_cuenta_proveedores integer;
  v_cuenta_tesoreria integer;
  v_monto numeric;
  v_concepto text;
BEGIN
  SELECT * INTO v_pc
  FROM public.pagos_cobros
  WHERE id = p_id_pago_cobro;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago/Cobro no encontrado: %', p_id_pago_cobro;
  END IF;

  v_monto := ABS(COALESCE(v_pc.monto, 0));
  IF v_monto <= 0 THEN
    RAISE EXCEPTION 'Monto inválido en Pago/Cobro %', p_id_pago_cobro;
  END IF;

  SELECT id INTO v_cuenta_caja FROM public.plan_cuentas WHERE codigo = '1.1.1.01' LIMIT 1;
  SELECT id INTO v_cuenta_bancos FROM public.plan_cuentas WHERE codigo = '1.1.1.02' LIMIT 1;
  SELECT id INTO v_cuenta_clientes FROM public.plan_cuentas WHERE codigo = '1.1.1.03' LIMIT 1;
  SELECT id INTO v_cuenta_proveedores FROM public.plan_cuentas WHERE codigo = '2.1.1.01' LIMIT 1;

  IF COALESCE(v_pc.metodo_pago, '') = 'Efectivo' THEN
    v_cuenta_tesoreria := v_cuenta_caja;
  ELSE
    v_cuenta_tesoreria := v_cuenta_bancos;
  END IF;

  IF v_cuenta_tesoreria IS NULL THEN
    v_cuenta_tesoreria := v_cuenta_caja;
  END IF;

  IF v_pc.tipo = 'Cobro' THEN
    SELECT * INTO v_cxc FROM public.cuentas_por_cobrar WHERE id = v_pc.id_cuenta_por_cobrar;
    v_concepto := 'Cobro ' || COALESCE(v_cxc.cliente_nombre, '') || ' (' || COALESCE(v_pc.metodo_pago, '') || ')';
  ELSE
    SELECT * INTO v_cxp FROM public.cuentas_por_pagar WHERE id = v_pc.id_cuenta_por_pagar;
    v_concepto := 'Pago ' || COALESCE(v_cxp.proveedor_nombre, '') || ' (' || COALESCE(v_pc.metodo_pago, '') || ')';
  END IF;

  v_numero_asiento := public.generar_numero_asiento();

  INSERT INTO public.asientos_contables (
    numero_asiento,
    fecha,
    concepto,
    tipo_asiento,
    id_origen,
    tipo_origen,
    total_debe,
    total_haber,
    estado
  ) VALUES (
    v_numero_asiento,
    v_pc.fecha_pago,
    v_concepto,
    'Tesorería',
    v_pc.id,
    'pago_cobro',
    v_monto,
    v_monto,
    'Contabilizado'
  ) RETURNING id INTO v_asiento_id;

  IF v_pc.tipo = 'Cobro' THEN
    IF v_cuenta_tesoreria IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_tesoreria, v_monto, 0, 'Ingreso por cobro');
    END IF;
    IF v_cuenta_clientes IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_clientes, 0, v_monto, 'Cancelación CxC');
    END IF;
  ELSE
    IF v_cuenta_proveedores IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_proveedores, v_monto, 0, 'Cancelación CxP');
    END IF;
    IF v_cuenta_tesoreria IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_tesoreria, 0, v_monto, 'Egreso por pago');
    END IF;
  END IF;

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
