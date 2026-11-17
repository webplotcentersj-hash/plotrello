-- Wrapper erp_crear_asiento_factura (faltaba en plot2) + crear_asiento_desde_factura
-- usa clave_sistema tras el plan de cuentas 2026-11-17 (deudores_ventas / iva_debito / ventas).
-- Idempotente. Requiere: actor_puede_escribir_comercial, plan_cuentas.clave_sistema.

CREATE OR REPLACE FUNCTION public.crear_asiento_desde_factura(
  p_id_factura integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas_venta%ROWTYPE;
  v_asiento_id integer;
  v_numero_asiento varchar(50);
  v_cuenta_ventas integer;
  v_cuenta_iva integer;
  v_cuenta_clientes integer;
  v_total numeric;
  v_subtotal numeric;
  v_iva numeric;
  v_es_nota_credito boolean;
BEGIN
  SELECT * INTO v_factura
  FROM public.facturas_venta
  WHERE id = p_id_factura
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada: %', p_id_factura;
  END IF;
  IF v_factura.estado <> 'Emitida' THEN
    RAISE EXCEPTION 'Solo se contabilizan comprobantes emitidos (% está en %)', v_factura.numero_factura, v_factura.estado;
  END IF;

  IF v_factura.id_asiento_contable IS NOT NULL THEN
    RETURN v_factura.id_asiento_contable;
  END IF;
  SELECT id INTO v_asiento_id
  FROM public.asientos_contables
  WHERE tipo_origen = 'factura' AND id_origen = v_factura.id
  ORDER BY id
  LIMIT 1;
  IF v_asiento_id IS NOT NULL THEN
    UPDATE public.facturas_venta SET id_asiento_contable = v_asiento_id WHERE id = p_id_factura;
    RETURN v_asiento_id;
  END IF;

  v_es_nota_credito := (v_factura.tipo_comprobante LIKE 'Nota de Crédito%');
  v_total := ABS(COALESCE(v_factura.total, 0));
  v_subtotal := ABS(COALESCE(v_factura.subtotal, 0));
  v_iva := ABS(COALESCE(v_factura.iva, 0));

  SELECT id INTO v_cuenta_ventas FROM public.plan_cuentas WHERE clave_sistema = 'ventas' LIMIT 1;
  SELECT id INTO v_cuenta_iva FROM public.plan_cuentas WHERE clave_sistema = 'iva_debito' LIMIT 1;
  SELECT id INTO v_cuenta_clientes FROM public.plan_cuentas WHERE clave_sistema = 'deudores_ventas' LIMIT 1;

  IF v_cuenta_clientes IS NULL THEN
    RAISE EXCEPTION 'Falta la cuenta con clave_sistema deudores_ventas en el plan de cuentas';
  END IF;
  IF v_cuenta_ventas IS NULL THEN
    RAISE EXCEPTION 'Falta la cuenta con clave_sistema ventas en el plan de cuentas';
  END IF;
  IF v_cuenta_iva IS NULL AND v_iva > 0 THEN
    RAISE EXCEPTION 'Falta la cuenta con clave_sistema iva_debito en el plan de cuentas';
  END IF;

  v_numero_asiento := public.generar_numero_asiento();

  INSERT INTO public.asientos_contables (
    numero_asiento, fecha, concepto, tipo_asiento, id_origen, tipo_origen,
    total_debe, total_haber, estado
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
    INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
    VALUES (v_asiento_id, v_cuenta_ventas, v_subtotal, 0, 'Reversa ventas (nota crédito)');
    IF v_iva > 0 THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_iva, v_iva, 0, 'Reversa IVA débito fiscal (nota crédito)');
    END IF;
    INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
    VALUES (v_asiento_id, v_cuenta_clientes, 0, v_total, 'Cliente (nota crédito): ' || v_factura.cliente_nombre);
  ELSE
    INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
    VALUES (v_asiento_id, v_cuenta_clientes, v_total, 0, 'Cliente: ' || v_factura.cliente_nombre);
    INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
    VALUES (v_asiento_id, v_cuenta_ventas, 0, v_subtotal, 'Ventas');
    IF v_iva > 0 THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_iva, 0, v_iva, 'IVA Débito Fiscal');
    END IF;
  END IF;

  UPDATE public.facturas_venta
  SET id_asiento_contable = v_asiento_id
  WHERE id = p_id_factura;

  RETURN v_asiento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_asiento_desde_factura(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_asiento_desde_factura(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.erp_crear_asiento_factura(
  p_actor_id integer,
  p_id_factura integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para generar asientos';
  END IF;
  RETURN public.crear_asiento_desde_factura(p_id_factura);
END;
$$;

REVOKE ALL ON FUNCTION public.erp_crear_asiento_factura(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.erp_crear_asiento_factura(integer, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
