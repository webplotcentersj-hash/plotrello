-- Compensación cruzada: baja deuda cliente CC y baja deuda con proveedor (mismo tercero por CUIT).
CREATE OR REPLACE FUNCTION public.cc_compensar_con_proveedor(
  p_actor_id integer,
  p_id_cliente integer,
  p_id_proveedor integer,
  p_monto numeric,
  p_fecha date,
  p_notas text DEFAULT NULL,
  p_url_comprobante text DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_actor_nombre text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cc json;
  v_prov json;
  v_id_cc integer;
  v_id_prov integer;
  v_ref text;
  v_notas text;
  v_nombre_prov text;
BEGIN
  IF p_actor_id IS NULL OR p_id_cliente IS NULL OR p_id_proveedor IS NULL THEN
    RAISE EXCEPTION 'Actor, cliente y proveedor son obligatorios';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'La fecha es obligatoria';
  END IF;

  SELECT COALESCE(NULLIF(trim(razon_social), ''), nombre)
    INTO v_nombre_prov
  FROM public.proveedores
  WHERE id = p_id_proveedor;
  IF v_nombre_prov IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  v_ref := COALESCE(
    NULLIF(trim(p_referencia), ''),
    'COMP-PROV-' || p_id_proveedor::text || '-' || to_char(p_fecha, 'YYYYMMDD')
  );
  v_notas := trim(both E'\n' from concat_ws(E'\n',
    NULLIF(trim(COALESCE(p_notas, '')), ''),
    'Compensación con proveedor #' || p_id_proveedor::text || ' (' || v_nombre_prov || ')'
  ));

  v_cc := public.cc_registrar_pago_actor(
    p_actor_id,
    p_id_cliente,
    p_monto,
    p_fecha,
    'Compensación proveedor',
    NULLIF(trim(COALESCE(p_url_comprobante, '')), ''),
    v_ref,
    v_notas,
    NULL,
    NULL,
    jsonb_build_object(
      'compensacion', true,
      'id_proveedor', p_id_proveedor,
      'proveedor_nombre', v_nombre_prov
    )
  );
  v_id_cc := COALESCE((v_cc->>'id_movimiento')::integer, (v_cc->>'id')::integer);

  v_prov := public.proveedor_registrar_en_cuenta(
    p_id_proveedor,
    'pago',
    p_monto,
    p_fecha,
    v_ref,
    COALESCE(NULLIF(trim(p_actor_nombre), ''), 'CC #' || p_id_cliente::text),
    NULLIF(trim(COALESCE(p_url_comprobante, '')), ''),
    CASE
      WHEN NULLIF(trim(COALESCE(p_url_comprobante, '')), '') IS NULL THEN '[]'::jsonb
      ELSE jsonb_build_array(jsonb_build_object('url', trim(p_url_comprobante), 'nombre', 'Compensación CC'))
    END
  );

  IF v_prov IS NULL OR COALESCE((v_prov->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_prov->>'error', 'No se pudo registrar el pago en cuenta proveedor');
  END IF;
  v_id_prov := (v_prov->>'id')::integer;

  UPDATE public.cc_cuenta_movimientos
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'compensacion', true,
    'id_proveedor', p_id_proveedor,
    'proveedor_nombre', v_nombre_prov,
    'id_movimiento_proveedor', v_id_prov
  ),
  metodo_pago = COALESCE(NULLIF(trim(metodo_pago), ''), 'Compensación proveedor')
  WHERE id = v_id_cc;

  RETURN json_build_object(
    'success', true,
    'id_movimiento_cc', v_id_cc,
    'id_movimiento_proveedor', v_id_prov,
    'id_cliente', p_id_cliente,
    'id_proveedor', p_id_proveedor,
    'monto', p_monto,
    'saldo_proveedor', (v_prov->>'saldo')::numeric,
    'referencia', v_ref
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cc_compensar_con_proveedor(integer, integer, integer, numeric, date, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_compensar_con_proveedor(integer, integer, integer, numeric, date, text, text, text, text) TO service_role;
