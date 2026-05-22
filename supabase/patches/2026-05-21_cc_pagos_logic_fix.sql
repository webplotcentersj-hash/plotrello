-- Cuenta corriente: estado efectivo en pagos/ventas, imputación parcial, solo clientes aprobados en libro

CREATE OR REPLACE FUNCTION public._cc_estado_efectivo(p_estado text, p_alta_completa boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_estado IN ('aprobada', 'pendiente', 'rechazada') THEN p_estado
    WHEN coalesce(p_alta_completa, false) THEN 'aprobada'
    ELSE 'pendiente'
  END;
$$;

CREATE OR REPLACE FUNCTION public.cc_upsert_movimiento_venta(p_id_venta integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_v public.ventas%ROWTYPE;
  v_id_mov bigint;
  v_fecha_venc date;
BEGIN
  SELECT * INTO v_v FROM public.ventas WHERE id = p_id_venta;
  IF NOT FOUND OR v_v.id_cliente IS NULL THEN RETURN NULL; END IF;
  IF NOT public._cc_es_venta_corriente(v_v.metodo_pago) THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes_cuenta_corriente cc
    WHERE cc.id_cliente = v_v.id_cliente
      AND public._cc_estado_efectivo(cc.estado, cc.alta_completa) = 'aprobada'
  ) THEN
    RETURN NULL;
  END IF;

  v_fecha_venc := (coalesce(v_v.fecha_venta::date, CURRENT_DATE) + interval '30 days')::date;

  SELECT id INTO v_id_mov FROM public.cc_cuenta_movimientos WHERE id_venta = p_id_venta AND tipo = 'venta';

  IF v_id_mov IS NULL THEN
    INSERT INTO public.cc_cuenta_movimientos (
      id_cliente, tipo, id_venta, fecha, fecha_vencimiento, concepto, debe, haber,
      url_comprobante, metadata
    ) VALUES (
      v_v.id_cliente, 'venta', v_v.id,
      coalesce(v_v.fecha_venta::date, CURRENT_DATE), v_fecha_venc,
      'Venta CC N° ' || coalesce(v_v.numero_venta, v_v.id::text),
      greatest(coalesce(v_v.valor_total, 0), 0), 0,
      v_v.comprobante_pago_url,
      jsonb_build_object('estado_pago', v_v.estado_pago, 'numero_venta', v_v.numero_venta)
    ) RETURNING id INTO v_id_mov;
  ELSE
    UPDATE public.cc_cuenta_movimientos SET
      fecha = coalesce(v_v.fecha_venta::date, CURRENT_DATE),
      fecha_vencimiento = v_fecha_venc,
      debe = greatest(coalesce(v_v.valor_total, 0), 0),
      concepto = 'Venta CC N° ' || coalesce(v_v.numero_venta, v_v.id::text),
      metadata = jsonb_build_object('estado_pago', v_v.estado_pago, 'numero_venta', v_v.numero_venta),
      url_comprobante = coalesce(v_v.comprobante_pago_url, url_comprobante)
    WHERE id = v_id_mov;
  END IF;

  PERFORM public.cc_actualizar_resumen_saldos(v_v.id_cliente);
  PERFORM public.calcular_scoring_cuenta_corriente(v_v.id_cliente, NULL, 'venta');
  RETURN v_id_mov;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cc_registrar_pago(
  p_id_cliente integer,
  p_monto numeric,
  p_fecha_pago date,
  p_metodo_pago text,
  p_url_comprobante text,
  p_id_usuario integer,
  p_referencia text DEFAULT NULL::text,
  p_notas text DEFAULT NULL::text,
  p_id_venta integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mov_id bigint;
  v_v public.ventas%ROWTYPE;
  v_concepto text;
  v_pagado_venta numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes_cuenta_corriente cc
    WHERE cc.id_cliente = p_id_cliente
      AND public._cc_estado_efectivo(cc.estado, cc.alta_completa) = 'aprobada'
  ) THEN
    RAISE EXCEPTION 'Cliente no habilitado en cuenta corriente' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_monto, 0) <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(trim(p_url_comprobante), '') = '' THEN RAISE EXCEPTION 'Comprobante de pago obligatorio' USING ERRCODE = 'P0001'; END IF;

  v_concepto := 'Pago / remesa' || CASE WHEN coalesce(trim(p_referencia), '') <> '' THEN ' — Ref. ' || trim(p_referencia) ELSE '' END;

  INSERT INTO public.cc_cuenta_movimientos (
    id_cliente, tipo, id_venta, fecha, concepto, debe, haber,
    url_comprobante, metodo_pago, referencia, notas, id_usuario, metadata
  ) VALUES (
    p_id_cliente, 'pago', p_id_venta,
    coalesce(p_fecha_pago, CURRENT_DATE),
    v_concepto, 0, p_monto,
    trim(p_url_comprobante), nullif(trim(coalesce(p_metodo_pago, '')), ''),
    nullif(trim(coalesce(p_referencia, '')), ''),
    nullif(trim(coalesce(p_notas, '')), ''),
    p_id_usuario,
    jsonb_build_object('id_venta_imputada', p_id_venta)
  ) RETURNING id INTO v_mov_id;

  IF p_id_venta IS NOT NULL THEN
    SELECT * INTO v_v FROM public.ventas WHERE id = p_id_venta AND id_cliente = p_id_cliente;
    IF FOUND THEN
      SELECT coalesce(sum(haber), 0) INTO v_pagado_venta
      FROM public.cc_cuenta_movimientos
      WHERE id_cliente = p_id_cliente AND tipo = 'pago' AND id_venta = p_id_venta;

      IF v_pagado_venta >= greatest(coalesce(v_v.valor_total, 0), 0) THEN
        UPDATE public.ventas SET estado_pago = 'Pagado', updated_at = now() WHERE id = p_id_venta;
      ELSIF lower(trim(coalesce(v_v.estado_pago, ''))) = 'pagado' THEN
        UPDATE public.ventas SET estado_pago = 'Pendiente', updated_at = now() WHERE id = p_id_venta;
      END IF;
    END IF;
  END IF;

  PERFORM public.cc_actualizar_resumen_saldos(p_id_cliente);
  PERFORM public.calcular_scoring_cuenta_corriente(p_id_cliente, p_id_usuario, 'pago');

  RETURN jsonb_build_object('id_movimiento', v_mov_id, 'id_cliente', p_id_cliente);
END;
$function$;
