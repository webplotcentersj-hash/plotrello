-- Facturación: emisión atada a AFIP, CxC / notas de crédito / asiento en el servidor, numeración por tipo.
-- Aplicar ANTES de deployar el código que usa afip_numero_intento / aplicar_efectos_factura.
--
--  1. Columnas afip_numero_intento (recuperar CAE sin duplicar) y efectos_aplicados_at.
--  2. generar_numero_factura: SECURITY DEFINER (anon ya no lee configuracion_afip desde el Paso 4)
--     y numeración propia por tipo de comprobante (Factura / NC / ND no comparten contador).
--  3. crear_asiento_desde_factura: idempotente, cuenta Clientes (1.1.1.03), reversa para NC,
--     SECURITY DEFINER (desde el Paso 22 fallaba el UPDATE de facturas_venta y no se generaba asiento).
--  4. aplicar_efectos_factura: CxC (descontando lo ya cobrado en la venta), ajuste de la CxC
--     original por nota de crédito y asiento. Solo service_role (lo llama /api/erp/afip-autorizar).
--  5. erp_crear_asiento_factura: wrapper con actor para "Sincronizar asientos" del front.
--  6. comercial_upsert / comercial_delete: una factura emitida no se edita ni se borra desde el front,
--     y la emisión / datos AFIP solo los escribe el servidor.
--  7. Plan de cuentas: IVA Débito Fiscal es Pasivo e IVA Crédito Fiscal es Activo (estaban invertidos).
--  8. Backfill: facturas ya autorizadas se marcan con efectos aplicados.
--  9. Concepto AFIP (productos / servicios / ambos) y período del servicio.
--
-- Es idempotente: si ya lo corriste, podés volver a correrlo entero.

BEGIN;

-- 1) Columnas ------------------------------------------------------------------
ALTER TABLE public.facturas_venta
  ADD COLUMN IF NOT EXISTS afip_numero_intento integer,
  ADD COLUMN IF NOT EXISTS efectos_aplicados_at timestamptz,
  ADD COLUMN IF NOT EXISTS concepto smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fecha_servicio_desde date,
  ADD COLUMN IF NOT EXISTS fecha_servicio_hasta date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facturas_venta_concepto_check') THEN
    ALTER TABLE public.facturas_venta
      ADD CONSTRAINT facturas_venta_concepto_check CHECK (concepto IN (1, 2, 3));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facturas_venta_periodo_servicio_check') THEN
    ALTER TABLE public.facturas_venta
      ADD CONSTRAINT facturas_venta_periodo_servicio_check
      CHECK (fecha_servicio_desde IS NULL OR fecha_servicio_hasta IS NULL OR fecha_servicio_desde <= fecha_servicio_hasta);
  END IF;
END$$;

COMMENT ON COLUMN public.facturas_venta.afip_numero_intento IS
  'Número enviado a AFIP en el último intento. Si la respuesta se cortó, se consulta en AFIP para recuperar el CAE en vez de autorizar otro comprobante.';
COMMENT ON COLUMN public.facturas_venta.efectos_aplicados_at IS
  'Cuándo se generó la CxC / ajuste por nota de crédito / asiento. NULL = pendiente.';
COMMENT ON COLUMN public.facturas_venta.concepto IS
  'Concepto AFIP: 1 Productos, 2 Servicios, 3 Productos y Servicios. 2/3 informan período del servicio y vencimiento del pago (fecha_vencimiento).';

CREATE INDEX IF NOT EXISTS idx_facturas_tipo_pv_numero
  ON public.facturas_venta (tipo_comprobante, punto_venta, numero_comprobante);

-- 2) Numeración provisoria por tipo ------------------------------------------------
-- El número definitivo lo asigna AFIP al autorizar; esto es solo la numeración del borrador.
CREATE OR REPLACE FUNCTION public.generar_numero_factura(
  p_tipo_comprobante varchar,
  p_punto_venta integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer := 0;
  v_config integer := 0;
BEGIN
  SELECT COALESCE(MAX(numero_comprobante), 0) INTO v_max
  FROM public.facturas_venta
  WHERE tipo_comprobante = p_tipo_comprobante
    AND punto_venta = COALESCE(p_punto_venta, 1)
    AND estado_afip = 'Autorizada';

  SELECT COALESCE(CASE p_tipo_comprobante
      WHEN 'Factura A' THEN c.ultimo_numero_factura_a
      WHEN 'Factura B' THEN c.ultimo_numero_factura_b
      WHEN 'Factura C' THEN c.ultimo_numero_factura_c
    END, 0) INTO v_config
  FROM public.configuracion_afip c
  WHERE c.activo = true
  LIMIT 1;

  RETURN GREATEST(COALESCE(v_max, 0), COALESCE(v_config, 0)) + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generar_numero_factura(varchar, integer) TO anon, authenticated;

-- 3) Asiento automático ------------------------------------------------------------
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

  -- Idempotente: nunca dos asientos para el mismo comprobante
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

  SELECT id INTO v_cuenta_ventas FROM public.plan_cuentas WHERE codigo = '4.1.1.01' LIMIT 1;
  SELECT id INTO v_cuenta_iva FROM public.plan_cuentas WHERE codigo = '1.1.2.01' LIMIT 1;
  SELECT id INTO v_cuenta_clientes FROM public.plan_cuentas WHERE codigo = '1.1.1.03' LIMIT 1;

  -- Sin estas cuentas el asiento quedaría desbalanceado
  IF v_cuenta_clientes IS NULL THEN
    RAISE EXCEPTION 'Falta la cuenta 1.1.1.03 (Clientes) en el plan de cuentas';
  END IF;
  IF v_cuenta_ventas IS NULL THEN
    RAISE EXCEPTION 'Falta la cuenta 4.1.1.01 (Ventas) en el plan de cuentas';
  END IF;
  IF v_cuenta_iva IS NULL AND v_iva > 0 THEN
    RAISE EXCEPTION 'Falta la cuenta 1.1.2.01 (IVA Débito Fiscal) en el plan de cuentas';
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
    -- Debe: Ventas / IVA | Haber: Clientes
    INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
    VALUES (v_asiento_id, v_cuenta_ventas, v_subtotal, 0, 'Reversa ventas (nota crédito)');
    IF v_iva > 0 THEN
      INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
      VALUES (v_asiento_id, v_cuenta_iva, v_iva, 0, 'Reversa IVA débito fiscal (nota crédito)');
    END IF;
    INSERT INTO public.asientos_detalle (id_asiento, id_cuenta, debe, haber, concepto)
    VALUES (v_asiento_id, v_cuenta_clientes, 0, v_total, 'Cliente (nota crédito): ' || v_factura.cliente_nombre);
  ELSE
    -- Factura / Nota de débito: Debe Clientes | Haber Ventas / IVA
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

-- 4) Efectos de un comprobante autorizado -------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_efectos_factura(
  p_id_factura integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f public.facturas_venta%ROWTYPE;
  v_cxc public.cuentas_por_cobrar%ROWTYPE;
  v_estado_pago text;
  v_venta_pagado numeric;
  v_total numeric;
  v_pagado numeric := 0;
  v_nuevo_total numeric;
  v_excedente numeric := 0;
  v_out jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_f FROM public.facturas_venta WHERE id = p_id_factura FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura % no encontrada', p_id_factura;
  END IF;
  IF v_f.estado <> 'Emitida' OR COALESCE(v_f.estado_afip, '') <> 'Autorizada' THEN
    RAISE EXCEPTION 'El comprobante % no está emitido y autorizado en AFIP', v_f.numero_factura;
  END IF;
  IF v_f.efectos_aplicados_at IS NOT NULL THEN
    RETURN jsonb_build_object('ya_aplicado', true);
  END IF;

  v_total := ABS(COALESCE(v_f.total, 0));

  IF v_f.tipo_comprobante LIKE 'Nota de Crédito%' THEN
    -- La nota de crédito baja la deuda del comprobante original (sin quedar por debajo de lo ya cobrado)
    IF v_f.id_factura_referencia IS NOT NULL THEN
      SELECT * INTO v_cxc
      FROM public.cuentas_por_cobrar
      WHERE id_factura = v_f.id_factura_referencia
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE;

      IF FOUND THEN
        v_nuevo_total := GREATEST(COALESCE(v_cxc.monto_pagado, 0), COALESCE(v_cxc.monto_total, 0) - v_total);
        v_excedente := v_total - (COALESCE(v_cxc.monto_total, 0) - v_nuevo_total);

        UPDATE public.cuentas_por_cobrar SET
          monto_total = v_nuevo_total,
          monto_pendiente = GREATEST(0, v_nuevo_total - COALESCE(monto_pagado, 0)),
          estado = CASE
            WHEN v_nuevo_total - COALESCE(monto_pagado, 0) > 0 THEN estado
            WHEN COALESCE(monto_pagado, 0) > 0 THEN 'Pagado'
            ELSE 'Cancelado'
          END,
          observaciones = concat_ws(
            E'\n',
            NULLIF(observaciones, ''),
            format('%s %s: -$%s', v_f.tipo_comprobante, v_f.numero_factura, to_char(v_total, 'FM999999999990.00'))
              || CASE WHEN v_excedente > 0
                   THEN format(' (saldo a favor del cliente $%s)', to_char(v_excedente, 'FM999999999990.00'))
                   ELSE '' END
          ),
          updated_at = now()
        WHERE id = v_cxc.id;

        v_out := v_out || jsonb_build_object('cxc_ajustada', v_cxc.id, 'saldo_a_favor', v_excedente);
      END IF;
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.cuentas_por_cobrar WHERE id_factura = v_f.id) THEN
    -- Factura / Nota de débito: una CxC por comprobante; si la venta ya se cobró, no queda deuda fantasma
    IF v_f.id_venta IS NOT NULL AND v_f.tipo_comprobante LIKE 'Factura%' THEN
      SELECT estado_pago, monto_pagado INTO v_estado_pago, v_venta_pagado
      FROM public.ventas
      WHERE id = v_f.id_venta;

      IF v_estado_pago = 'Pagado' THEN
        v_pagado := v_total;
      ELSIF v_estado_pago = 'Parcial' THEN
        v_pagado := LEAST(v_total, GREATEST(0, COALESCE(v_venta_pagado, 0)));
      END IF;
    END IF;

    INSERT INTO public.cuentas_por_cobrar (
      id_factura, id_cliente, cliente_nombre, monto_total, monto_pagado, monto_pendiente,
      fecha_emision, fecha_vencimiento, estado, observaciones
    ) VALUES (
      v_f.id,
      v_f.id_cliente,
      COALESCE(NULLIF(v_f.cliente_nombre, ''), 'Cliente'),
      v_total,
      v_pagado,
      v_total - v_pagado,
      v_f.fecha_emision,
      v_f.fecha_vencimiento,
      CASE WHEN v_total - v_pagado <= 0 THEN 'Pagado' WHEN v_pagado > 0 THEN 'Parcial' ELSE 'Pendiente' END,
      CASE WHEN v_pagado > 0 THEN format('Cobrado en la venta #%s', v_f.id_venta) END
    );
    v_out := v_out || jsonb_build_object('cxc_creada', true, 'monto_pagado_venta', v_pagado);
  END IF;

  -- El asiento no bloquea la CxC: si falta configurar el plan de cuentas, queda pendiente para "Sincronizar asientos"
  BEGIN
    PERFORM public.crear_asiento_desde_factura(v_f.id);
  EXCEPTION WHEN OTHERS THEN
    v_out := v_out || jsonb_build_object('asiento_error', SQLERRM);
  END;

  UPDATE public.facturas_venta SET efectos_aplicados_at = now() WHERE id = v_f.id;
  RETURN v_out || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_efectos_factura(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_efectos_factura(integer) TO service_role;

-- 5) Wrapper con actor para el front (Asientos → Sincronizar) --------------------------
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

-- 6) comercial_upsert / comercial_delete (Paso 22) con reglas de facturación -----------
CREATE OR REPLACE FUNCTION public.comercial_upsert(
  p_actor_id integer,
  p_kind text,
  p_row jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_out jsonb;
  v_item jsonb;
  v_items jsonb;
  v_estado text;
  v_id_factura integer;
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL OR NULLIF(btrim(p_kind), '') IS NULL
     OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para escribir comercial (% )', COALESCE(p_kind, '?');
  END IF;

  IF p_kind = 'pago_cobro' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      INSERT INTO public.pagos_cobros (
        tipo, id_cuenta_por_cobrar, id_cuenta_por_pagar, monto, fecha_pago,
        metodo_pago, numero_comprobante, id_cuenta_bancaria, observaciones, id_usuario
      ) VALUES (
        COALESCE(NULLIF(p_row->>'tipo', ''), 'Cobro'),
        NULLIF(p_row->>'id_cuenta_por_cobrar', '')::integer,
        NULLIF(p_row->>'id_cuenta_por_pagar', '')::integer,
        COALESCE(NULLIF(p_row->>'monto', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'fecha_pago', '')::date, CURRENT_DATE),
        NULLIF(p_row->>'metodo_pago', ''),
        NULLIF(p_row->>'numero_comprobante', ''),
        NULLIF(p_row->>'id_cuenta_bancaria', '')::integer,
        NULLIF(p_row->>'observaciones', ''),
        COALESCE(NULLIF(p_row->>'id_usuario', '')::integer, p_actor_id)
      )
      RETURNING to_jsonb(pagos_cobros.*) INTO v_out;
      RETURN v_out;
    END IF;
    UPDATE public.pagos_cobros AS t SET
      monto = CASE WHEN p_row ? 'monto' THEN NULLIF(p_row->>'monto', '')::numeric ELSE t.monto END,
      fecha_pago = CASE WHEN p_row ? 'fecha_pago' THEN NULLIF(p_row->>'fecha_pago', '')::date ELSE t.fecha_pago END,
      metodo_pago = CASE WHEN p_row ? 'metodo_pago' THEN NULLIF(p_row->>'metodo_pago', '') ELSE t.metodo_pago END,
      numero_comprobante = CASE WHEN p_row ? 'numero_comprobante' THEN NULLIF(p_row->>'numero_comprobante', '') ELSE t.numero_comprobante END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      id_cuenta_bancaria = CASE WHEN p_row ? 'id_cuenta_bancaria' THEN NULLIF(p_row->>'id_cuenta_bancaria', '')::integer ELSE t.id_cuenta_bancaria END
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    IF v_out IS NULL THEN RAISE EXCEPTION 'pago_cobro % no encontrado', v_id; END IF;
    RETURN v_out;
  END IF;

  IF p_kind = 'cxc' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      INSERT INTO public.cuentas_por_cobrar (
        id_factura, id_cliente, cliente_nombre, monto_total, monto_pagado, monto_pendiente,
        fecha_emision, fecha_vencimiento, estado, observaciones
      ) VALUES (
        NULLIF(p_row->>'id_factura', '')::integer,
        NULLIF(p_row->>'id_cliente', '')::integer,
        NULLIF(p_row->>'cliente_nombre', ''),
        COALESCE(NULLIF(p_row->>'monto_total', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'monto_pagado', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'monto_pendiente', '')::numeric, 0),
        NULLIF(p_row->>'fecha_emision', '')::date,
        NULLIF(p_row->>'fecha_vencimiento', '')::date,
        COALESCE(NULLIF(p_row->>'estado', ''), 'Pendiente'),
        NULLIF(p_row->>'observaciones', '')
      )
      RETURNING to_jsonb(cuentas_por_cobrar.*) INTO v_out;
      RETURN v_out;
    END IF;
    UPDATE public.cuentas_por_cobrar AS t SET
      monto_pagado = CASE WHEN p_row ? 'monto_pagado' THEN NULLIF(p_row->>'monto_pagado', '')::numeric ELSE t.monto_pagado END,
      monto_pendiente = CASE WHEN p_row ? 'monto_pendiente' THEN NULLIF(p_row->>'monto_pendiente', '')::numeric ELSE t.monto_pendiente END,
      monto_total = CASE WHEN p_row ? 'monto_total' THEN NULLIF(p_row->>'monto_total', '')::numeric ELSE t.monto_total END,
      estado = CASE WHEN p_row ? 'estado' THEN NULLIF(p_row->>'estado', '') ELSE t.estado END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      updated_at = COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    IF v_out IS NULL THEN RAISE EXCEPTION 'cxc % no encontrado', v_id; END IF;
    RETURN v_out;
  END IF;

  IF p_kind = 'factura' THEN
    v_id := NULLIF(p_row->>'id', '')::integer;
    IF v_id IS NULL THEN
      -- Siempre nace como borrador: la emisión la hace el servidor al autorizar en AFIP
      INSERT INTO public.facturas_venta (
        numero_factura, punto_venta, numero_comprobante, tipo_comprobante,
        fecha_emision, fecha_vencimiento, id_cliente, cliente_nombre, cliente_dni_cuit,
        cliente_direccion, cliente_condicion_iva, id_op, numero_op, id_venta,
        id_factura_referencia, subtotal, descuento, iva, total, estado, estado_afip,
        observaciones, id_usuario, concepto, fecha_servicio_desde, fecha_servicio_hasta
      ) VALUES (
        COALESCE(NULLIF(p_row->>'numero_factura', ''), 'TMP'),
        COALESCE(NULLIF(p_row->>'punto_venta', '')::integer, 1),
        COALESCE(NULLIF(p_row->>'numero_comprobante', '')::integer, 0),
        COALESCE(NULLIF(p_row->>'tipo_comprobante', ''), 'Factura B'),
        COALESCE(NULLIF(p_row->>'fecha_emision', '')::date, CURRENT_DATE),
        NULLIF(p_row->>'fecha_vencimiento', '')::date,
        NULLIF(p_row->>'id_cliente', '')::integer,
        NULLIF(p_row->>'cliente_nombre', ''),
        NULLIF(p_row->>'cliente_dni_cuit', ''),
        NULLIF(p_row->>'cliente_direccion', ''),
        NULLIF(p_row->>'cliente_condicion_iva', ''),
        NULLIF(p_row->>'id_op', '')::integer,
        NULLIF(p_row->>'numero_op', ''),
        NULLIF(p_row->>'id_venta', '')::integer,
        NULLIF(p_row->>'id_factura_referencia', '')::integer,
        COALESCE(NULLIF(p_row->>'subtotal', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'descuento', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'iva', '')::numeric, 0),
        COALESCE(NULLIF(p_row->>'total', '')::numeric, 0),
        'Borrador',
        'Pendiente',
        NULLIF(p_row->>'observaciones', ''),
        COALESCE(NULLIF(p_row->>'id_usuario', '')::integer, p_actor_id),
        COALESCE(NULLIF(p_row->>'concepto', '')::smallint, 1),
        NULLIF(p_row->>'fecha_servicio_desde', '')::date,
        NULLIF(p_row->>'fecha_servicio_hasta', '')::date
      )
      RETURNING to_jsonb(facturas_venta.*) INTO v_out;
      RETURN v_out;
    END IF;

    SELECT estado INTO v_estado FROM public.facturas_venta WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'factura % no encontrada', v_id; END IF;

    IF p_row ?| ARRAY['estado_afip', 'cae', 'numero_cae', 'fecha_vencimiento_cae', 'resultado_afip',
                      'codigo_resultado_afip', 'fecha_autorizacion_afip', 'id_asiento_contable'] THEN
      RAISE EXCEPTION 'Los datos de AFIP y el asiento los asigna el servidor al emitir';
    END IF;
    IF p_row ? 'estado' AND NULLIF(p_row->>'estado', '') IS DISTINCT FROM v_estado
       AND NOT (v_estado = 'Borrador' AND p_row->>'estado' = 'Anulada') THEN
      RAISE EXCEPTION 'Cambio de estado no permitido (% → %): se emite con "Emitir" (AFIP) y un comprobante emitido se corrige con nota de crédito',
        v_estado, p_row->>'estado';
    END IF;
    IF v_estado <> 'Borrador'
       AND p_row ?| ARRAY['fecha_emision', 'fecha_vencimiento', 'subtotal', 'descuento', 'iva', 'total',
                          'concepto', 'fecha_servicio_desde', 'fecha_servicio_hasta'] THEN
      RAISE EXCEPTION 'El comprobante % ya fue emitido: solo se pueden editar las observaciones', v_id;
    END IF;

    UPDATE public.facturas_venta AS t SET
      estado = CASE WHEN p_row ? 'estado' THEN NULLIF(p_row->>'estado', '') ELSE t.estado END,
      observaciones = CASE WHEN p_row ? 'observaciones' THEN NULLIF(p_row->>'observaciones', '') ELSE t.observaciones END,
      fecha_emision = CASE WHEN p_row ? 'fecha_emision' THEN NULLIF(p_row->>'fecha_emision', '')::date ELSE t.fecha_emision END,
      fecha_vencimiento = CASE WHEN p_row ? 'fecha_vencimiento' THEN NULLIF(p_row->>'fecha_vencimiento', '')::date ELSE t.fecha_vencimiento END,
      subtotal = CASE WHEN p_row ? 'subtotal' THEN NULLIF(p_row->>'subtotal', '')::numeric ELSE t.subtotal END,
      descuento = CASE WHEN p_row ? 'descuento' THEN NULLIF(p_row->>'descuento', '')::numeric ELSE t.descuento END,
      iva = CASE WHEN p_row ? 'iva' THEN NULLIF(p_row->>'iva', '')::numeric ELSE t.iva END,
      total = CASE WHEN p_row ? 'total' THEN NULLIF(p_row->>'total', '')::numeric ELSE t.total END,
      concepto = CASE WHEN p_row ? 'concepto' THEN COALESCE(NULLIF(p_row->>'concepto', '')::smallint, 1) ELSE t.concepto END,
      fecha_servicio_desde = CASE WHEN p_row ? 'fecha_servicio_desde' THEN NULLIF(p_row->>'fecha_servicio_desde', '')::date ELSE t.fecha_servicio_desde END,
      fecha_servicio_hasta = CASE WHEN p_row ? 'fecha_servicio_hasta' THEN NULLIF(p_row->>'fecha_servicio_hasta', '')::date ELSE t.fecha_servicio_hasta END,
      updated_at = COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    WHERE t.id = v_id
    RETURNING to_jsonb(t.*) INTO v_out;
    RETURN v_out;
  END IF;

  IF p_kind = 'factura_item' THEN
    v_id_factura := (p_row->>'id_factura')::integer;
    IF NOT EXISTS (SELECT 1 FROM public.facturas_venta WHERE id = v_id_factura AND estado = 'Borrador') THEN
      RAISE EXCEPTION 'Solo se agregan ítems a comprobantes en borrador (factura %)', v_id_factura;
    END IF;
    INSERT INTO public.facturas_items (
      id_factura, item_numero, descripcion, cantidad, unidad_medida,
      precio_unitario, descuento, iva_porcentaje, iva_monto, subtotal, total, id_articulo
    ) VALUES (
      v_id_factura,
      COALESCE(NULLIF(p_row->>'item_numero', '')::integer, 1),
      COALESCE(NULLIF(p_row->>'descripcion', ''), ''),
      COALESCE(NULLIF(p_row->>'cantidad', '')::numeric, 1),
      COALESCE(NULLIF(p_row->>'unidad_medida', ''), 'UN'),
      COALESCE(NULLIF(p_row->>'precio_unitario', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'descuento', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'iva_porcentaje', '')::numeric, 21),
      COALESCE(NULLIF(p_row->>'iva_monto', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'subtotal', '')::numeric, 0),
      COALESCE(NULLIF(p_row->>'total', '')::numeric, 0),
      NULLIF(p_row->>'id_articulo', '')::integer
    )
    RETURNING to_jsonb(facturas_items.*) INTO v_out;
    RETURN v_out;
  END IF;

  IF p_kind = 'factura_items' THEN
    v_items := COALESCE(p_row->'items', '[]'::jsonb);
    IF jsonb_typeof(v_items) <> 'array' THEN
      RAISE EXCEPTION 'factura_items requiere p_row.items array';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
    LOOP
      v_id_factura := COALESCE(NULLIF(v_item->>'id_factura', '')::integer, NULLIF(p_row->>'id_factura', '')::integer);
      IF NOT EXISTS (SELECT 1 FROM public.facturas_venta WHERE id = v_id_factura AND estado = 'Borrador') THEN
        RAISE EXCEPTION 'Solo se agregan ítems a comprobantes en borrador (factura %)', v_id_factura;
      END IF;
      INSERT INTO public.facturas_items (
        id_factura, item_numero, descripcion, cantidad, unidad_medida,
        precio_unitario, descuento, iva_porcentaje, iva_monto, subtotal, total, id_articulo
      ) VALUES (
        v_id_factura,
        COALESCE(NULLIF(v_item->>'item_numero', '')::integer, 1),
        COALESCE(NULLIF(v_item->>'descripcion', ''), ''),
        COALESCE(NULLIF(v_item->>'cantidad', '')::numeric, 1),
        COALESCE(NULLIF(v_item->>'unidad_medida', ''), 'UN'),
        COALESCE(NULLIF(v_item->>'precio_unitario', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'descuento', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'iva_porcentaje', '')::numeric, 21),
        COALESCE(NULLIF(v_item->>'iva_monto', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'subtotal', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'total', '')::numeric, 0),
        NULLIF(v_item->>'id_articulo', '')::integer
      );
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_items));
  END IF;

  RAISE EXCEPTION 'comercial_upsert kind desconocido: %', p_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.comercial_upsert(integer, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.comercial_delete(
  p_actor_id integer,
  p_kind text,
  p_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f public.facturas_venta%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_id IS NULL OR NULLIF(btrim(p_kind), '') IS NULL
     OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para borrar comercial (% )', COALESCE(p_kind, '?');
  END IF;

  IF p_kind = 'factura' THEN
    SELECT * INTO v_f FROM public.facturas_venta WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    IF v_f.estado <> 'Borrador' OR COALESCE(v_f.estado_afip, '') IN ('Autorizada', 'Enviando') THEN
      RAISE EXCEPTION 'Solo se pueden borrar borradores sin autorizar (comprobante %)', v_f.numero_factura;
    END IF;
    IF v_f.afip_numero_intento IS NOT NULL THEN
      RAISE EXCEPTION 'El borrador % tuvo un envío a AFIP sin respuesta: reintentá "Emitir" para verificarlo antes de borrarlo', v_f.numero_factura;
    END IF;
    DELETE FROM public.facturas_items WHERE id_factura = p_id;
    DELETE FROM public.facturas_venta WHERE id = p_id;
    RETURN;
  END IF;

  IF p_kind = 'pago_cobro' THEN
    DELETE FROM public.pagos_cobros WHERE id = p_id;
    RETURN;
  END IF;

  IF p_kind = 'cxc' THEN
    DELETE FROM public.cuentas_por_cobrar WHERE id = p_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'comercial_delete kind desconocido: %', p_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.comercial_delete(integer, text, integer) TO anon, authenticated;

-- 7) Plan de cuentas: clasificación de las cuentas de IVA ------------------------------
-- Se corrige solo tipo/naturaleza (no el código) para no mover asientos históricos.
UPDATE public.plan_cuentas
SET tipo = 'Pasivo', naturaleza = 'Acreedora', updated_at = now()
WHERE codigo = '1.1.2.01' AND nombre ILIKE 'IVA D%bito%' AND tipo = 'Activo';

UPDATE public.plan_cuentas
SET tipo = 'Activo', naturaleza = 'Deudora', updated_at = now()
WHERE codigo = '2.1.2.01' AND nombre ILIKE 'IVA Cr%dito%' AND tipo = 'Pasivo';

-- 8) Backfill -------------------------------------------------------------------
-- Lo autorizado antes de este patch ya generó CxC/asiento al emitirse.
-- (El flujo nuevo siempre guarda afip_numero_intento, así que re-correr el patch no pisa pendientes nuevos.)
UPDATE public.facturas_venta
SET efectos_aplicados_at = COALESCE(fecha_autorizacion_afip, updated_at, now())
WHERE estado = 'Emitida' AND estado_afip = 'Autorizada' AND efectos_aplicados_at IS NULL
  AND afip_numero_intento IS NULL;

COMMIT;
