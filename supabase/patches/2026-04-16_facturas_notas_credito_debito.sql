-- Agrega relación comprobante ↔ comprobante origen y corrige asiento automático para Notas de Crédito.
-- Aplicar en Supabase (SQL Editor) cuando habilites el módulo de notas.

BEGIN;

SET LOCAL check_function_bodies TO FALSE;

-- 1) Relación: nota / débito / crédito puede referenciar un comprobante origen
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

-- 2) Asiento automático: para Nota de Crédito se invierten los movimientos (Cliente al Haber; Ventas/IVA al Debe).
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

  -- Cuentas configurables (ejemplos)
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
    -- Debe: Ventas / IVA | Haber: Cliente
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
    -- Factura / Nota débito: Debe Cliente | Haber Ventas / IVA
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

