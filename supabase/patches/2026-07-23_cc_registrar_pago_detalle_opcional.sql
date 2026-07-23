-- Pago CC: comprobante opcional (como venta rápida) + detalle_pago en metadata.
DROP FUNCTION IF EXISTS public.cc_registrar_pago(integer, numeric, date, text, text, integer, text, text, integer, jsonb);

CREATE OR REPLACE FUNCTION public.cc_registrar_pago(
  p_id_cliente integer,
  p_monto numeric,
  p_fecha_pago date,
  p_metodo_pago text,
  p_url_comprobante text,
  p_id_usuario integer,
  p_referencia text DEFAULT NULL::text,
  p_notas text DEFAULT NULL::text,
  p_id_venta integer DEFAULT NULL::integer,
  p_detalle_medios jsonb DEFAULT NULL::jsonb,
  p_detalle_pago jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mov_id bigint;
  v_concepto text;
  v_meta jsonb;
  v_url text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes_cuenta_corriente cc
    WHERE cc.id_cliente = p_id_cliente
      AND public._cc_estado_efectivo(cc.estado, cc.alta_completa) = 'aprobada'
  ) THEN
    RAISE EXCEPTION 'Cliente no habilitado en cuenta corriente' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_monto, 0) <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = 'P0001'; END IF;

  v_url := nullif(trim(coalesce(p_url_comprobante, '')), '');

  v_concepto := 'Pago / remesa' || CASE WHEN coalesce(trim(p_referencia), '') <> '' THEN ' — Ref. ' || trim(p_referencia) ELSE '' END;
  v_meta := jsonb_build_object('id_venta_imputada', p_id_venta);
  IF p_detalle_medios IS NOT NULL AND jsonb_typeof(p_detalle_medios) = 'array' AND jsonb_array_length(p_detalle_medios) > 0 THEN
    v_meta := v_meta || jsonb_build_object('medios', p_detalle_medios);
  END IF;
  IF p_detalle_pago IS NOT NULL AND jsonb_typeof(p_detalle_pago) = 'object' AND p_detalle_pago <> '{}'::jsonb THEN
    v_meta := v_meta || jsonb_build_object('detalle_pago', p_detalle_pago);
  END IF;

  INSERT INTO public.cc_cuenta_movimientos (
    id_cliente, tipo, id_venta, fecha, concepto, debe, haber,
    url_comprobante, metodo_pago, referencia, notas, id_usuario, metadata
  ) VALUES (
    p_id_cliente, 'pago', p_id_venta,
    coalesce(p_fecha_pago, CURRENT_DATE),
    v_concepto, 0, p_monto,
    v_url, nullif(trim(coalesce(p_metodo_pago, '')), ''),
    nullif(trim(coalesce(p_referencia, '')), ''),
    nullif(trim(coalesce(p_notas, '')), ''),
    p_id_usuario,
    v_meta
  ) RETURNING id INTO v_mov_id;

  PERFORM public.cc_sincronizar_estados_ventas_cc(p_id_cliente);
  PERFORM public.cc_actualizar_resumen_saldos(p_id_cliente);
  PERFORM public.calcular_scoring_cuenta_corriente(p_id_cliente, p_id_usuario, 'pago');

  RETURN jsonb_build_object('id_movimiento', v_mov_id, 'id_cliente', p_id_cliente);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cc_registrar_pago(integer, numeric, date, text, text, integer, text, text, integer, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_registrar_pago(integer, numeric, date, text, text, integer, text, text, integer, jsonb, jsonb) TO service_role;
