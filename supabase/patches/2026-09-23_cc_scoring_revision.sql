-- Scoring CC — revisión 2026-09-23
--
-- Correcciones sobre 2026-07-23_cc_scoring_puntualidad_fifo.sql:
--  1. Puntualidad de pagos "a cuenta": se reproduce el ledger cronológicamente (FIFO)
--     y un pago es impuntual solo si en ese momento había ventas CON SALDO ya vencidas
--     (antes: cualquier venta vieja vencida, aunque estuviera pagada, lo hacía impuntual).
--  2. Ventas canceladas excluidas de conteos, volumen y vencidas.
--  3. Vencimiento por venta con subconsulta escalar (sin JOIN que duplique filas).
--  4. Penalización por deuda relativa al límite asignado (fallback: montos fijos).
--  5. Pagaré suma para cualquier tipo de cliente.
--  6. Estado de alta usa _cc_estado_efectivo (igual que cc_registrar_pago).
--  7. total_automatico = puntos antes del ajuste manual, recortado a 0–100.
--  8. Historial: no se inserta fila si el score no cambió en recálculos automáticos.
--  9. Recalculo diario de toda la cartera (pg_cron si está disponible).

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
  v_origen text := coalesce(nullif(trim(p_origen), ''), 'automatico');
  v_score_anterior integer;
  v_puntos integer := 0;
  v_ajuste integer;
  v_total integer;
  v_total_auto integer;
  v_nivel text;
  v_detalle jsonb;
  v_factores jsonb := '[]'::jsonb;
  v_p int;
  v_estado text;
  v_docs_ok boolean;
  v_meses_antig integer;
  v_dias_gracia integer;
  -- ventas CC (no canceladas), ordenadas FIFO
  v_ids integer[];
  v_fechas date[];
  v_vencs date[];
  v_rest numeric[];
  v_n integer;
  v_i integer;
  v_idx integer;
  v_aplica numeric;
  v_libre numeric;
  v_pago record;
  v_puntual boolean;
  v_total_ventas integer := 0;
  v_ventas_pagadas integer := 0;
  v_volumen numeric := 0;
  v_deuda_pendiente numeric := 0;
  v_limite_ref numeric;
  v_ratio_deuda numeric;
  v_pagos_puntuales integer := 0;
  v_pagos_con_fecha integer := 0;
  v_vencidas_abiertas integer := 0;
  v_ratio_puntual numeric;
  v_limite_sugerido numeric;
BEGIN
  PERFORM public.cc_actualizar_resumen_saldos(p_id_cliente);
  PERFORM public.cc_sincronizar_estados_ventas_cc(p_id_cliente);

  SELECT * INTO v_cc FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_cliente;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente sin ficha de cuenta corriente' USING ERRCODE = 'P0001';
  END IF;
  v_score_anterior := v_cc.score;
  v_dias_gracia := greatest(0, coalesce(v_cc.dias_gracia, 0));

  -- Estado de alta (efectivo)
  v_estado := public._cc_estado_efectivo(v_cc.estado, v_cc.alta_completa);
  v_p := CASE v_estado
    WHEN 'aprobada' THEN 30
    WHEN 'pendiente' THEN 12
    WHEN 'rechazada' THEN 0
    ELSE 8
  END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','estado','label','Estado de alta','puntos',v_p,'max',30));

  -- Documentación
  v_docs_ok := coalesce(trim(v_cc.url_constancia_afip),'') <> ''
    AND coalesce(trim(v_cc.url_comprobante_domicilio),'') <> ''
    AND (v_cc.tipo_cliente = 'persona_fisica' OR coalesce(trim(v_cc.url_estatuto),'') <> '')
    AND (v_cc.tipo_cliente = 'empresa' OR coalesce(trim(v_cc.url_documento_dni),'') <> '');
  v_p := CASE WHEN v_docs_ok THEN 20 WHEN v_cc.alta_completa THEN 10 ELSE 0 END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','documentacion','label','Documentación','puntos',v_p,'max',20));

  -- Pagaré (cualquier tipo de cliente)
  v_p := CASE WHEN coalesce(trim(v_cc.url_pagare),'') <> '' THEN 5 ELSE 0 END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','pagare','label','Pagaré firmado/archivado','puntos',v_p,'max',5));

  -- Condición IVA
  v_p := CASE lower(trim(coalesce(v_cc.condicion_iva,'')))
    WHEN 'responsable_inscripto' THEN 10
    WHEN 'monotributo' THEN 8
    WHEN 'exento' THEN 7
    WHEN 'consumidor_final' THEN 5
    ELSE 3
  END;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','iva','label','Condición IVA','puntos',v_p,'max',10));

  -- Antigüedad
  v_meses_antig := greatest(0, extract(epoch FROM (now() - coalesce(v_cc.created_at, now())))::int / (30 * 24 * 3600));
  v_p := least(10, v_meses_antig);
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','antiguedad','label','Antigüedad en cuenta corriente (meses)','puntos',v_p,'max',10,'meses',v_meses_antig));

  -- Ventas CC no canceladas (vencimiento: movimiento de venta o fecha + 30, más gracia)
  SELECT
    coalesce(array_agg(x.id ORDER BY x.fecha, x.id), '{}'),
    coalesce(array_agg(x.fecha ORDER BY x.fecha, x.id), '{}'),
    coalesce(array_agg(x.venc ORDER BY x.fecha, x.id), '{}'),
    coalesce(array_agg(x.valor ORDER BY x.fecha, x.id), '{}'),
    coalesce(sum(x.valor), 0)
  INTO v_ids, v_fechas, v_vencs, v_rest, v_volumen
  FROM (
    SELECT
      v.id,
      coalesce(v.fecha_venta::date, CURRENT_DATE) AS fecha,
      coalesce(
        (SELECT max(mv.fecha_vencimiento)
           FROM public.cc_cuenta_movimientos mv
          WHERE mv.id_venta = v.id AND mv.tipo = 'venta'),
        coalesce(v.fecha_venta::date, CURRENT_DATE) + 30
      ) + v_dias_gracia AS venc,
      greatest(coalesce(v.valor_total, 0), 0) AS valor
    FROM public.ventas v
    WHERE v.id_cliente = p_id_cliente
      AND (
        lower(trim(coalesce(v.metodo_pago,''))) LIKE '%cuenta%corriente%'
        OR trim(coalesce(v.metodo_pago,'')) = 'Cuenta Corriente'
      )
      AND lower(trim(coalesce(v.estado_pago,''))) <> 'cancelado'
  ) x;
  v_n := coalesce(array_length(v_ids, 1), 0);
  v_total_ventas := v_n;

  -- Reproducción cronológica del ledger: puntualidad de cada pago + saldo por venta
  FOR v_pago IN
    SELECT p.id, p.fecha::date AS fecha, coalesce(p.haber, 0) AS monto, p.id_venta
    FROM public.cc_cuenta_movimientos p
    WHERE p.id_cliente = p_id_cliente
      AND p.tipo = 'pago'
      AND coalesce(p.haber, 0) > 0.009
    ORDER BY p.fecha, p.id
  LOOP
    v_idx := CASE WHEN v_pago.id_venta IS NULL THEN NULL ELSE array_position(v_ids, v_pago.id_venta) END;

    IF v_idx IS NOT NULL THEN
      -- Pago imputado a una venta: a tiempo si se pagó antes de su vencimiento
      v_puntual := v_pago.fecha <= v_vencs[v_idx];
    ELSE
      -- Pago a cuenta: a tiempo si en ese momento no había saldo vencido
      v_puntual := true;
      FOR v_i IN 1..v_n LOOP
        IF v_fechas[v_i] <= v_pago.fecha AND v_rest[v_i] > 0.009 AND v_pago.fecha > v_vencs[v_i] THEN
          v_puntual := false;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    v_pagos_con_fecha := v_pagos_con_fecha + 1;
    IF v_puntual THEN v_pagos_puntuales := v_pagos_puntuales + 1; END IF;

    -- Aplicar monto: primero a la venta imputada, el resto FIFO
    v_libre := v_pago.monto;
    IF v_idx IS NOT NULL THEN
      v_aplica := least(v_rest[v_idx], v_libre);
      v_rest[v_idx] := v_rest[v_idx] - v_aplica;
      v_libre := v_libre - v_aplica;
    END IF;
    FOR v_i IN 1..v_n LOOP
      EXIT WHEN v_libre <= 0.009;
      IF v_rest[v_i] > 0.009 THEN
        v_aplica := least(v_rest[v_i], v_libre);
        v_rest[v_i] := v_rest[v_i] - v_aplica;
        v_libre := v_libre - v_aplica;
      END IF;
    END LOOP;
  END LOOP;

  FOR v_i IN 1..v_n LOOP
    IF v_rest[v_i] <= 0.009 THEN
      v_ventas_pagadas := v_ventas_pagadas + 1;
    ELSIF CURRENT_DATE > v_vencs[v_i] THEN
      v_vencidas_abiertas := v_vencidas_abiertas + 1;
    END IF;
  END LOOP;

  -- Comportamiento de pago: deuda real = saldo del ledger
  v_deuda_pendiente := greatest(0, coalesce(v_cc.saldo_actual, 0));
  IF v_deuda_pendiente <= 0.009 AND v_total_ventas > 0 THEN
    v_ventas_pagadas := v_total_ventas;
    v_vencidas_abiertas := 0;
  END IF;

  v_p := CASE
    WHEN v_total_ventas = 0 THEN 5
    WHEN v_ventas_pagadas::numeric / v_total_ventas >= 0.9 THEN 15
    WHEN v_ventas_pagadas::numeric / v_total_ventas >= 0.7 THEN 11
    WHEN v_ventas_pagadas::numeric / v_total_ventas >= 0.5 THEN 6
    ELSE 0
  END;

  v_limite_ref := nullif(coalesce(v_cc.limite_credito, 0), 0);
  IF v_deuda_pendiente <= 0.009 THEN
    IF v_total_ventas > 0 THEN v_p := v_p + 3; END IF; -- premio por cuenta saldada
  ELSIF v_limite_ref IS NOT NULL THEN
    v_ratio_deuda := v_deuda_pendiente / v_limite_ref;
    IF v_ratio_deuda > 1 THEN v_p := v_p - 15;
    ELSIF v_ratio_deuda > 0.8 THEN v_p := v_p - 8;
    ELSIF v_ratio_deuda > 0.5 THEN v_p := v_p - 4;
    END IF;
  ELSE
    IF v_deuda_pendiente > 500000 THEN v_p := v_p - 15;
    ELSIF v_deuda_pendiente > 150000 THEN v_p := v_p - 8;
    ELSIF v_deuda_pendiente > 50000 THEN v_p := v_p - 4;
    END IF;
  END IF;
  v_p := greatest(-10, least(15, v_p));
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object(
    'id','comportamiento_pago','label','Comportamiento de pago (CC)',
    'puntos',v_p,'max',15,
    'ventas_cc',v_total_ventas,'pagadas',v_ventas_pagadas,'deuda_pendiente',v_deuda_pendiente,
    'uso_limite_pct', CASE WHEN v_ratio_deuda IS NULL THEN NULL ELSE round(v_ratio_deuda * 100, 1) END
  ));

  -- Puntualidad
  v_ratio_puntual := CASE WHEN v_pagos_con_fecha > 0 THEN v_pagos_puntuales::numeric / v_pagos_con_fecha END;
  v_p := CASE
    WHEN v_pagos_con_fecha = 0 THEN 6
    WHEN v_ratio_puntual >= 0.95 THEN 20
    WHEN v_ratio_puntual >= 0.8 THEN 16
    WHEN v_ratio_puntual >= 0.6 THEN 12
    WHEN v_ratio_puntual >= 0.4 THEN 8
    ELSE 3
  END;
  IF v_pagos_con_fecha > 0 AND v_vencidas_abiertas = 0 AND v_ratio_puntual >= 0.7 THEN
    v_p := least(20, v_p + 2);
  END IF;
  IF v_vencidas_abiertas > 0 THEN
    v_p := greatest(0, v_p - least(12, v_vencidas_abiertas * 3));
  END IF;
  v_puntos := v_puntos + v_p;
  v_factores := v_factores || jsonb_build_array(jsonb_build_object(
    'id','puntualidad','label','Pagos a tiempo',
    'puntos',v_p,'max',20,
    'puntuales',v_pagos_puntuales,
    'con_fecha_pago',v_pagos_con_fecha,
    'vencidas_abiertas',v_vencidas_abiertas,
    'dias_gracia',v_dias_gracia,
    'ratio', round(coalesce(v_ratio_puntual, 0) * 100, 1)
  ));

  -- Ajuste manual
  v_total_auto := greatest(0, least(100, v_puntos));
  v_ajuste := greatest(-30, least(30, coalesce(v_cc.score_ajuste_manual, 0)));
  IF v_ajuste <> 0 THEN
    v_factores := v_factores || jsonb_build_array(jsonb_build_object('id','ajuste_manual','label','Ajuste manual administración','puntos',v_ajuste,'max',30));
  END IF;

  v_total := greatest(0, least(100, v_puntos + v_ajuste));
  v_nivel := public._cc_nivel_desde_score(v_total);
  v_limite_sugerido := round(greatest(50000, least(8000000, v_total * 80000::numeric))::numeric, 2);

  v_detalle := jsonb_build_object(
    'factores', v_factores,
    'total_automatico', v_total_auto,
    'ajuste_manual', v_ajuste,
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

  -- Recalculos automáticos sin cambio no ensucian el historial
  IF v_score_anterior IS DISTINCT FROM v_total
     OR v_origen NOT IN ('automatico', 'apertura', 'cron') THEN
    INSERT INTO public.cc_scoring_historial (id_cliente, score_anterior, score_nuevo, score_nivel, detalle, origen, id_usuario)
    VALUES (p_id_cliente, v_score_anterior, v_total, v_nivel, v_detalle, v_origen, p_id_usuario);
  END IF;

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

-- Recalculo diario de toda la cartera (vencimientos y antigüedad cambian con el tiempo)
CREATE OR REPLACE FUNCTION public.cc_recalcular_scoring_diario()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id integer;
  v_ok integer := 0;
BEGIN
  FOR v_id IN SELECT id_cliente FROM public.clientes_cuenta_corriente LOOP
    BEGIN
      PERFORM public.calcular_scoring_cuenta_corriente(v_id, NULL, 'cron');
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Scoring CC cliente %: %', v_id, SQLERRM;
    END;
  END LOOP;
  RETURN v_ok;
END;
$function$;

REVOKE ALL ON FUNCTION public.cc_recalcular_scoring_diario() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_recalcular_scoring_diario() TO service_role;

-- 06:00 Argentina (09:00 UTC). Si pg_cron no está habilitado, se omite.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cc_scoring_diario';
    PERFORM cron.schedule('cc_scoring_diario', '0 9 * * *', 'SELECT public.cc_recalcular_scoring_diario()');
  ELSE
    RAISE NOTICE 'pg_cron no habilitado: el scoring se recalcula al abrir la ficha del cliente.';
  END IF;
END;
$$;
