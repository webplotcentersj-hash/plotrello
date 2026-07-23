-- Scoring CC: deuda real (saldo ledger) + puntualidad por pagos a tiempo
-- + sincronizar estado de ventas al pagar (FIFO, incl. pagos sin venta)

CREATE OR REPLACE FUNCTION public.cc_sincronizar_estados_ventas_cc(p_id_cliente integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row record;
  v_libre numeric := 0;
  v_rest numeric;
  v_aplica numeric;
  v_pagado numeric;
BEGIN
  PERFORM set_config('plotlab.cc_skip_scoring', '1', true);

  SELECT coalesce(sum(haber), 0) INTO v_libre
  FROM public.cc_cuenta_movimientos
  WHERE id_cliente = p_id_cliente
    AND tipo = 'pago'
    AND id_venta IS NULL;

  FOR v_row IN
    SELECT
      v.id,
      greatest(coalesce(v.valor_total, 0), 0) AS valor_total,
      coalesce((
        SELECT sum(p.haber)
        FROM public.cc_cuenta_movimientos p
        WHERE p.id_cliente = p_id_cliente
          AND p.tipo = 'pago'
          AND p.id_venta = v.id
      ), 0) AS pagado_linked
    FROM public.ventas v
    WHERE v.id_cliente = p_id_cliente
      AND (
        lower(trim(coalesce(v.metodo_pago, ''))) LIKE '%cuenta%corriente%'
        OR trim(coalesce(v.metodo_pago, '')) = 'Cuenta Corriente'
      )
      AND lower(trim(coalesce(v.estado_pago, ''))) NOT IN ('cancelado')
    ORDER BY coalesce(v.fecha_venta::date, CURRENT_DATE), v.id
  LOOP
    v_rest := greatest(v_row.valor_total - v_row.pagado_linked, 0);
    v_aplica := 0;
    IF v_rest > 0.009 AND v_libre > 0.009 THEN
      v_aplica := least(v_rest, v_libre);
      v_libre := v_libre - v_aplica;
      v_rest := v_rest - v_aplica;
    END IF;
    v_pagado := least(v_row.valor_total, v_row.pagado_linked + v_aplica);

    IF v_rest <= 0.009 THEN
      UPDATE public.ventas
      SET estado_pago = 'Pagado',
          monto_pagado = v_row.valor_total,
          updated_at = now()
      WHERE id = v_row.id
        AND (
          lower(trim(coalesce(estado_pago, ''))) <> 'pagado'
          OR coalesce(monto_pagado, 0) < v_row.valor_total - 0.009
        );
    ELSIF v_pagado > 0.009 THEN
      UPDATE public.ventas
      SET estado_pago = 'Parcial',
          monto_pagado = v_pagado,
          updated_at = now()
      WHERE id = v_row.id
        AND lower(trim(coalesce(estado_pago, ''))) <> 'pagado';
    END IF;
  END LOOP;

  PERFORM set_config('plotlab.cc_skip_scoring', '0', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calcular_scoring_cuenta_corriente(
  p_id_cliente integer,
  p_id_usuario integer DEFAULT NULL::integer,
  p_origen text DEFAULT 'automatico'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cc public.clientes_cuenta_corriente%ROWTYPE;
  v_score_anterior integer;
  v_puntos integer := 0;
  v_total integer;
  v_nivel text;
  v_detalle jsonb := '{}'::jsonb;
  v_factores jsonb := '[]'::jsonb;
  v_meses_antig integer;
  v_total_ventas integer := 0;
  v_ventas_pagadas integer := 0;
  v_deuda_pendiente numeric := 0;
  v_volumen numeric := 0;
  v_limite_sugerido numeric;
  v_p int;
  v_docs_ok boolean;
  v_dias_gracia integer := 0;
  v_pagos_puntuales integer := 0;
  v_pagos_con_fecha integer := 0;
  v_vencidas_abiertas integer := 0;
  v_ratio_puntual numeric := 0;
BEGIN
  PERFORM public.cc_actualizar_resumen_saldos(p_id_cliente);
  PERFORM public.cc_sincronizar_estados_ventas_cc(p_id_cliente);

  SELECT * INTO v_cc FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_cliente;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente sin ficha de cuenta corriente' USING ERRCODE = 'P0001';
  END IF;
  v_score_anterior := v_cc.score;
  v_dias_gracia := greatest(0, coalesce(v_cc.dias_gracia, 0));

  v_p := CASE v_cc.estado
    WHEN 'aprobada' THEN 30
    WHEN 'pendiente' THEN 12
    WHEN 'rechazada' THEN 0
    ELSE 8
  END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','estado','label','Estado de alta','puntos',v_p,'max',30));

  v_docs_ok := coalesce(trim(v_cc.url_constancia_afip),'') <> ''
    AND coalesce(trim(v_cc.url_comprobante_domicilio),'') <> ''
    AND (v_cc.tipo_cliente = 'persona_fisica' OR coalesce(trim(v_cc.url_estatuto),'') <> '')
    AND (v_cc.tipo_cliente = 'empresa' OR coalesce(trim(v_cc.url_documento_dni),'') <> '');
  v_p := CASE WHEN v_docs_ok THEN 20 WHEN v_cc.alta_completa THEN 10 ELSE 0 END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','documentacion','label','Documentación','puntos',v_p,'max',20));

  v_p := CASE WHEN v_cc.tipo_cliente = 'persona_fisica' AND coalesce(trim(v_cc.url_pagare),'') <> '' THEN 5 ELSE 0 END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','pagare','label','Pagaré firmado/archivado','puntos',v_p,'max',5));

  v_p := CASE lower(trim(coalesce(v_cc.condicion_iva,'')))
    WHEN 'responsable_inscripto' THEN 10
    WHEN 'monotributo' THEN 8
    WHEN 'exento' THEN 7
    WHEN 'consumidor_final' THEN 5
    ELSE 3
  END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','iva','label','Condición IVA','puntos',v_p,'max',10));

  v_meses_antig := greatest(0, extract(epoch FROM (now() - coalesce(v_cc.created_at, now())))::int / (30 * 24 * 3600));
  v_p := least(10, v_meses_antig);
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','antiguedad','label','Antigüedad en cuenta corriente (meses)','puntos',v_p,'max',10,'meses',v_meses_antig));

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE lower(trim(coalesce(estado_pago,''))) = 'pagado')::int,
    coalesce(sum(valor_total), 0)
  INTO v_total_ventas, v_ventas_pagadas, v_volumen
  FROM public.ventas v
  WHERE v.id_cliente = p_id_cliente
    AND (
      lower(trim(coalesce(v.metodo_pago,''))) LIKE '%cuenta%corriente%'
      OR trim(coalesce(v.metodo_pago,'')) = 'Cuenta Corriente'
    );

  -- Deuda real = saldo ledger (no ventas “pendientes” ya cobradas a cuenta)
  v_deuda_pendiente := greatest(0, coalesce(v_cc.saldo_actual, 0));
  IF v_deuda_pendiente <= 0.009 AND v_total_ventas > 0 THEN
    v_ventas_pagadas := v_total_ventas;
  END IF;

  v_p := CASE
    WHEN v_total_ventas = 0 THEN 5
    WHEN v_ventas_pagadas::numeric / nullif(v_total_ventas, 0) >= 0.9 THEN 15
    WHEN v_ventas_pagadas::numeric / nullif(v_total_ventas, 0) >= 0.7 THEN 11
    WHEN v_ventas_pagadas::numeric / nullif(v_total_ventas, 0) >= 0.5 THEN 6
    ELSE 0
  END;
  IF v_deuda_pendiente > 500000 THEN v_p := v_p - 15;
  ELSIF v_deuda_pendiente > 150000 THEN v_p := v_p - 8;
  ELSIF v_deuda_pendiente > 50000 THEN v_p := v_p - 4;
  ELSIF v_deuda_pendiente <= 0.009 AND v_total_ventas > 0 THEN
    v_p := least(15, v_p + 3); -- premio por cuenta saldada
  END IF;
  v_p := greatest(-10, least(15, v_p));
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object(
    'id','comportamiento_pago','label','Comportamiento de pago (CC)',
    'puntos',v_p,'max',15,
    'ventas_cc',v_total_ventas,'pagadas',v_ventas_pagadas,'deuda_pendiente',v_deuda_pendiente
  ));

  -- Puntualidad: cada pago del ledger (con o sin venta imputada)
  SELECT
    count(*) FILTER (WHERE x.puntual)::int,
    count(*)::int
  INTO v_pagos_puntuales, v_pagos_con_fecha
  FROM (
    SELECT
      p.id,
      CASE
        WHEN p.id_venta IS NOT NULL THEN
          p.fecha::date <= (
            coalesce(mv.fecha_vencimiento, coalesce(v.fecha_venta::date, p.fecha::date) + 30)
            + v_dias_gracia
          )
        ELSE
          NOT EXISTS (
            SELECT 1
            FROM public.ventas vx
            LEFT JOIN public.cc_cuenta_movimientos mvx
              ON mvx.id_venta = vx.id AND mvx.tipo = 'venta'
            WHERE vx.id_cliente = p_id_cliente
              AND (
                lower(trim(coalesce(vx.metodo_pago,''))) LIKE '%cuenta%corriente%'
                OR trim(coalesce(vx.metodo_pago,'')) = 'Cuenta Corriente'
              )
              AND coalesce(vx.fecha_venta::date, p.fecha::date) <= p.fecha::date
              AND p.fecha::date > (
                coalesce(mvx.fecha_vencimiento, coalesce(vx.fecha_venta::date, p.fecha::date) + 30)
                + v_dias_gracia
              )
          )
      END AS puntual
    FROM public.cc_cuenta_movimientos p
    LEFT JOIN public.ventas v ON v.id = p.id_venta
    LEFT JOIN public.cc_cuenta_movimientos mv
      ON mv.id_venta = p.id_venta AND mv.tipo = 'venta'
    WHERE p.id_cliente = p_id_cliente
      AND p.tipo = 'pago'
      AND coalesce(p.haber, 0) > 0.009
  ) x;

  SELECT count(*)::int INTO v_vencidas_abiertas
  FROM public.ventas v
  LEFT JOIN public.cc_cuenta_movimientos mv
    ON mv.id_venta = v.id AND mv.tipo = 'venta'
  WHERE v.id_cliente = p_id_cliente
    AND (
      lower(trim(coalesce(v.metodo_pago,''))) LIKE '%cuenta%corriente%'
      OR trim(coalesce(v.metodo_pago,'')) = 'Cuenta Corriente'
    )
    AND lower(trim(coalesce(v.estado_pago,''))) NOT IN ('pagado','cancelado')
    AND greatest(coalesce(v.valor_total,0) - coalesce(v.monto_pagado,0), 0) > 0.009
    AND CURRENT_DATE > (coalesce(mv.fecha_vencimiento, coalesce(v.fecha_venta::date, CURRENT_DATE) + 30) + v_dias_gracia);

  v_ratio_puntual := CASE
    WHEN v_pagos_con_fecha > 0 THEN v_pagos_puntuales::numeric / v_pagos_con_fecha
    ELSE NULL
  END;

  v_p := CASE
    WHEN v_pagos_con_fecha = 0 THEN 6
    WHEN v_ratio_puntual >= 0.95 THEN 20
    WHEN v_ratio_puntual >= 0.8 THEN 16
    WHEN v_ratio_puntual >= 0.6 THEN 12
    WHEN v_ratio_puntual >= 0.4 THEN 8
    ELSE 3
  END;
  -- Premio extra si paga y hoy no tiene vencidas
  IF v_pagos_con_fecha > 0 AND v_vencidas_abiertas = 0 AND coalesce(v_ratio_puntual, 0) >= 0.7 THEN
    v_p := least(20, v_p + 2);
  END IF;
  IF v_vencidas_abiertas > 0 THEN
    v_p := greatest(0, v_p - least(12, v_vencidas_abiertas * 3));
  END IF;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object(
    'id','puntualidad',
    'label','Pagos a tiempo',
    'puntos',v_p,'max',20,
    'puntuales',v_pagos_puntuales,
    'con_fecha_pago',v_pagos_con_fecha,
    'vencidas_abiertas',v_vencidas_abiertas,
    'dias_gracia',v_dias_gracia,
    'ratio', round(coalesce(v_ratio_puntual, 0) * 100, 1)
  ));

  v_p := greatest(-30, least(30, coalesce(v_cc.score_ajuste_manual, 0)));
  v_puntos := v_puntos + v_p;
  IF v_p <> 0 THEN
    v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','ajuste_manual','label','Ajuste manual administración','puntos',v_p,'max',30));
  END IF;

  v_total := greatest(0, least(100, v_puntos));
  v_nivel := public._cc_nivel_desde_score(v_total);
  v_limite_sugerido := round(greatest(50000, least(8000000, v_total * 80000::numeric))::numeric, 2);

  v_detalle := jsonb_build_object(
    'factores', v_factores,
    'total_automatico', v_total - CASE WHEN coalesce(v_cc.score_ajuste_manual,0) <> 0 THEN greatest(-30, least(30, v_cc.score_ajuste_manual)) ELSE 0 END,
    'ajuste_manual', coalesce(v_cc.score_ajuste_manual, 0),
    'total', v_total,
    'nivel', v_nivel,
    'limite_credito_sugerido', v_limite_sugerido,
    'limite_credito_asignado', v_cc.limite_credito,
    'ventas_cc', jsonb_build_object('total', v_total_ventas, 'pagadas', v_ventas_pagadas, 'deuda_pendiente', v_deuda_pendiente, 'volumen', v_volumen),
    'puntualidad', jsonb_build_object('puntuales', v_pagos_puntuales, 'con_fecha_pago', v_pagos_con_fecha, 'vencidas_abiertas', v_vencidas_abiertas, 'ratio', round(coalesce(v_ratio_puntual,0)*100,1)),
    'calculado_at', now()
  );

  UPDATE public.clientes_cuenta_corriente SET
    score = v_total,
    score_nivel = v_nivel,
    score_detalle = v_detalle,
    score_actualizado_at = now(),
    limite_credito_sugerido = v_limite_sugerido,
    updated_at = now()
  WHERE id_cliente = p_id_cliente;

  INSERT INTO public.cc_scoring_historial (id_cliente, score_anterior, score_nuevo, score_nivel, detalle, origen, id_usuario)
  VALUES (p_id_cliente, v_score_anterior, v_total, v_nivel, v_detalle, coalesce(nullif(trim(p_origen),''), 'automatico'), p_id_usuario);

  RETURN jsonb_build_object(
    'id_cliente', p_id_cliente,
    'score', v_total,
    'score_nivel', v_nivel,
    'score_detalle', v_detalle,
    'limite_credito_sugerido', v_limite_sugerido,
    'limite_credito', v_cc.limite_credito
  );
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
  p_id_venta integer DEFAULT NULL::integer,
  p_detalle_medios jsonb DEFAULT NULL::jsonb
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
  v_meta := jsonb_build_object('id_venta_imputada', p_id_venta);
  IF p_detalle_medios IS NOT NULL AND jsonb_typeof(p_detalle_medios) = 'array' AND jsonb_array_length(p_detalle_medios) > 0 THEN
    v_meta := v_meta || jsonb_build_object('medios', p_detalle_medios);
  END IF;

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
    v_meta
  ) RETURNING id INTO v_mov_id;

  PERFORM public.cc_sincronizar_estados_ventas_cc(p_id_cliente);
  PERFORM public.cc_actualizar_resumen_saldos(p_id_cliente);
  PERFORM public.calcular_scoring_cuenta_corriente(p_id_cliente, p_id_usuario, 'pago');

  RETURN jsonb_build_object('id_movimiento', v_mov_id, 'id_cliente', p_id_cliente);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cc_sincronizar_estados_ventas_cc(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_sincronizar_estados_ventas_cc(integer) TO service_role;
