-- Alertas de vencimiento de pago en cuenta corriente → user_notifications
-- Origen: cc_vencimiento (idempotente por venta + tipo + día)

CREATE OR REPLACE FUNCTION public.cc_verificar_alertas_vencimiento(
  p_dias_aviso integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row record;
  v_dias integer;
  v_tipo text;
  v_title text;
  v_desc text;
  v_notif_type text;
  v_related text;
  v_user record;
  v_creadas integer := 0;
  v_revisadas integer := 0;
  v_dias_aviso integer := greatest(0, coalesce(p_dias_aviso, 7));
BEGIN
  FOR v_row IN
    SELECT
      v.id AS id_venta,
      v.numero_venta,
      v.id_cliente,
      v.id_vendedor,
      coalesce(nullif(trim(v.cliente_empresa), ''), nullif(trim(v.cliente_nombre), ''), 'Cliente #' || v.id_cliente::text) AS cliente_nombre,
      greatest(
        coalesce(v.valor_total, 0) - coalesce(v.monto_pagado, 0),
        0
      ) AS monto_pendiente,
      coalesce(mv.fecha_vencimiento, (coalesce(v.fecha_venta::date, CURRENT_DATE) + 30))::date AS fecha_vencimiento
    FROM public.ventas v
    LEFT JOIN public.cc_cuenta_movimientos mv
      ON mv.id_venta = v.id AND mv.tipo = 'venta'
    WHERE v.id_cliente IS NOT NULL
      AND (
        lower(trim(coalesce(v.metodo_pago, ''))) LIKE '%cuenta%corriente%'
        OR trim(coalesce(v.metodo_pago, '')) = 'Cuenta Corriente'
      )
      AND lower(trim(coalesce(v.estado_pago, ''))) IN ('pendiente', 'parcial')
      AND greatest(coalesce(v.valor_total, 0) - coalesce(v.monto_pagado, 0), 0) > 0.009
      AND EXISTS (
        SELECT 1 FROM public.clientes_cuenta_corriente cc
        WHERE cc.id_cliente = v.id_cliente
          AND public._cc_estado_efectivo(cc.estado, cc.alta_completa) = 'aprobada'
      )
  LOOP
    v_revisadas := v_revisadas + 1;
    v_dias := (CURRENT_DATE - v_row.fecha_vencimiento);

    IF v_dias > 0 THEN
      v_tipo := 'vencido';
      v_title := 'CC vencida';
      v_desc := format(
        'Venta %s de %s venció hace %s día(s). Pendiente $ %s.',
        coalesce(v_row.numero_venta, v_row.id_venta::text),
        v_row.cliente_nombre,
        v_dias,
        to_char(v_row.monto_pendiente, 'FM999G999G999D00')
      );
      v_notif_type := 'error';
    ELSIF v_dias = 0 THEN
      v_tipo := 'vence_hoy';
      v_title := 'CC vence hoy';
      v_desc := format(
        'Venta %s de %s vence HOY. Pendiente $ %s.',
        coalesce(v_row.numero_venta, v_row.id_venta::text),
        v_row.cliente_nombre,
        to_char(v_row.monto_pendiente, 'FM999G999G999D00')
      );
      v_notif_type := 'warning';
    ELSIF v_dias >= -v_dias_aviso THEN
      v_tipo := 'por_vencer';
      v_title := 'CC por vencer';
      v_desc := format(
        'Venta %s de %s vence en %s día(s) (%s). Pendiente $ %s.',
        coalesce(v_row.numero_venta, v_row.id_venta::text),
        v_row.cliente_nombre,
        abs(v_dias),
        to_char(v_row.fecha_vencimiento, 'DD/MM/YYYY'),
        to_char(v_row.monto_pendiente, 'FM999G999G999D00')
      );
      v_notif_type := 'warning';
    ELSE
      CONTINUE;
    END IF;

    v_related := format('cc-venc-%s-%s-%s', v_row.id_venta, v_tipo, to_char(CURRENT_DATE, 'YYYYMMDD'));

    FOR v_user IN
      SELECT u.id
      FROM public.usuarios u
      WHERE coalesce(u.activo, true) = true
        AND (
          lower(trim(coalesce(u.rol, ''))) IN ('administracion', 'gerencia', 'caja', 'mostrador')
          OR (v_row.id_vendedor IS NOT NULL AND u.id = v_row.id_vendedor)
        )
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.user_notifications n
        WHERE n.user_id = v_user.id
          AND n.origen = 'cc_vencimiento'
          AND n.related_id = v_related
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.user_notifications (
        user_id, title, description, type, venta_id, origen, related_id, is_read
      ) VALUES (
        v_user.id,
        v_title,
        v_desc,
        v_notif_type,
        v_row.id_venta,
        'cc_vencimiento',
        v_related,
        false
      );
      v_creadas := v_creadas + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'revisadas', v_revisadas,
    'notificaciones_creadas', v_creadas,
    'dias_aviso', v_dias_aviso
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cc_verificar_alertas_vencimiento(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_verificar_alertas_vencimiento(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.cc_verificar_alertas_vencimiento(integer) TO service_role;
