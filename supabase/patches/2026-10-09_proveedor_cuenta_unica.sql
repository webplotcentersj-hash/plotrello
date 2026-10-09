-- Una sola cuenta por proveedor: factura suma, pago resta.

CREATE OR REPLACE FUNCTION public.proveedor_registrar_en_cuenta(
  p_id_proveedor integer,
  p_tipo text,
  p_monto numeric,
  p_fecha date,
  p_comprobante text DEFAULT '',
  p_usuario text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_tel text;
  v_saldo numeric;
  v_debe numeric := 0;
  v_haber numeric := 0;
  v_tipo text;
  v_comp text;
BEGIN
  IF p_id_proveedor IS NULL OR p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El proveedor y un importe mayor a 0 son obligatorios';
  END IF;
  IF lower(p_tipo) NOT IN ('factura', 'pago') THEN
    RAISE EXCEPTION 'Solo se puede cargar factura o pago';
  END IF;

  SELECT COALESCE(NULLIF(trim(razon_social), ''), nombre), COALESCE(NULLIF(trim(telefono), ''), '-')
    INTO v_nombre, v_tel
  FROM public.proveedores
  WHERE id = p_id_proveedor;
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  SELECT COALESCE(
    (
      SELECT m.saldo
      FROM public.movimientos_proveedores m
      WHERE m.id_proveedor = p_id_proveedor
      ORDER BY m.fecha_hora DESC, m.id DESC
      LIMIT 1
    ),
    (
      SELECT d.saldo
      FROM public.deudas_proveedores d
      WHERE d.id_proveedor = p_id_proveedor
      ORDER BY d.fecha_corte DESC, d.id DESC
      LIMIT 1
    ),
    0
  ) INTO v_saldo;

  IF lower(p_tipo) = 'factura' THEN
    v_debe := p_monto;
    v_saldo := v_saldo + p_monto;
    v_tipo := 'FACTURA';
    v_comp := NULLIF(trim(p_comprobante), '');
    IF v_comp IS NULL THEN
      v_comp := 'FAC-' || to_char(p_fecha, 'YYYYMMDD') || '-' || p_id_proveedor::text;
    END IF;
  ELSE
    v_haber := p_monto;
    v_saldo := v_saldo - p_monto;
    v_tipo := 'PAGO';
    v_comp := NULLIF(trim(p_comprobante), '');
    IF v_comp IS NULL THEN
      v_comp := 'PA-' || to_char(now(), 'YYYYMMDDHH24MISS');
    END IF;
  END IF;

  INSERT INTO public.movimientos_proveedores (
    proveedor_nombre, moneda, fecha_hora, fecha_comprobante, tipo_movimiento,
    comprobante, debe, haber, saldo, es_saldo_inicial, id_proveedor
  ) VALUES (
    v_nombre, 'PESOS', (p_fecha::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'),
    p_fecha, v_tipo, v_comp, v_debe, v_haber, v_saldo, false, p_id_proveedor
  );

  IF lower(p_tipo) = 'pago' THEN
    INSERT INTO public.pagos_proveedores (
      fecha, numero_pago, numero_recibo, proveedor_nombre, usuario, monto, id_proveedor
    ) VALUES (
      p_fecha, v_comp, '', v_nombre, p_usuario, p_monto, p_id_proveedor
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.deudas_proveedores WHERE id_proveedor = p_id_proveedor) THEN
    UPDATE public.deudas_proveedores
    SET saldo = v_saldo, fecha_corte = p_fecha, updated_at = now(), razon_social = v_nombre
    WHERE id_proveedor = p_id_proveedor;
  ELSE
    INSERT INTO public.deudas_proveedores (codigo, razon_social, telefono, saldo, id_proveedor, fecha_corte)
    VALUES ('P' || p_id_proveedor::text, v_nombre, v_tel, v_saldo, p_id_proveedor, p_fecha);
  END IF;

  RETURN json_build_object('success', true, 'saldo', v_saldo, 'tipo', v_tipo);
END;
$$;

REVOKE ALL ON FUNCTION public.proveedor_registrar_en_cuenta(integer, text, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proveedor_registrar_en_cuenta(integer, text, numeric, date, text, text) TO anon, authenticated;
