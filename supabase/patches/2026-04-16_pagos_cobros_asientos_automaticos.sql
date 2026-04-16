-- Asientos automáticos desde pagos/cobros (Tesorería → Contabilidad)
-- Genera asiento al registrar un movimiento en `pagos_cobros`.
-- Usa plan de cuentas base:
-- - Caja: 1.1.1.01
-- - Bancos: 1.1.1.02
-- - Clientes: 1.1.1.03
-- - Proveedores: 2.1.1.01

BEGIN;

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

  -- Cuentas base
  SELECT id INTO v_cuenta_caja FROM public.plan_cuentas WHERE codigo = '1.1.1.01' LIMIT 1;
  SELECT id INTO v_cuenta_bancos FROM public.plan_cuentas WHERE codigo = '1.1.1.02' LIMIT 1;
  SELECT id INTO v_cuenta_clientes FROM public.plan_cuentas WHERE codigo = '1.1.1.03' LIMIT 1;
  SELECT id INTO v_cuenta_proveedores FROM public.plan_cuentas WHERE codigo = '2.1.1.01' LIMIT 1;

  -- Elegir tesorería según método (efectivo → caja; otros → bancos)
  IF COALESCE(v_pc.metodo_pago, '') = 'Efectivo' THEN
    v_cuenta_tesoreria := v_cuenta_caja;
  ELSE
    v_cuenta_tesoreria := v_cuenta_bancos;
  END IF;

  IF v_cuenta_tesoreria IS NULL THEN
    -- fallback
    v_cuenta_tesoreria := v_cuenta_caja;
  END IF;

  -- Concepto
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
    -- Debe: Caja/Bancos | Haber: Clientes
    IF v_cuenta_tesoreria IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_tesoreria, v_monto, 0, 'Ingreso por cobro');
    END IF;
    IF v_cuenta_clientes IS NOT NULL THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_clientes, 0, v_monto, 'Cancelación CxC');
    END IF;
  ELSE
    -- Pago: Debe Proveedores | Haber Caja/Bancos
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

