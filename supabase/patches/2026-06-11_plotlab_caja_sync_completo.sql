-- PlotLab ↔ Control de Cajas: columnas venta + sync servidor

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS monto_pagado numeric(12,2),
  ADD COLUMN IF NOT EXISTS caja_slug_cobro text REFERENCES public.control_caja_cajas(slug);

COMMENT ON COLUMN public.ventas.monto_pagado IS 'Monto ya cobrado (ventas parciales) para sync con caja.';
COMMENT ON COLUMN public.ventas.caja_slug_cobro IS 'Caja operativa donde se registró el cobro en mostrador.';

CREATE OR REPLACE FUNCTION public.plotlab_monto_cobrado_venta(p_venta_id integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v public.ventas%ROWTYPE;
  v_pagado numeric;
BEGIN
  SELECT * INTO v FROM public.ventas WHERE id = p_venta_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v.estado_pago = 'Pagado' THEN RETURN COALESCE(v.valor_total, 0); END IF;
  IF v.estado_pago <> 'Parcial' THEN RETURN 0; END IF;
  IF v.monto_pagado IS NOT NULL AND v.monto_pagado > 0 THEN
    RETURN LEAST(v.monto_pagado, COALESCE(v.valor_total, v.monto_pagado));
  END IF;
  SELECT cxc.monto_pagado INTO v_pagado
  FROM public.facturas_venta f
  JOIN public.cuentas_por_cobrar cxc ON cxc.id_factura = f.id
  WHERE f.id_venta = p_venta_id
  LIMIT 1;
  IF v_pagado IS NOT NULL AND v_pagado > 0 THEN
    RETURN LEAST(v_pagado, COALESCE(v.valor_total, v_pagado));
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.plotlab_caja_slug_venta(p_venta public.ventas)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_venta.caja_slug_cobro IS NOT NULL AND trim(p_venta.caja_slug_cobro) <> '' THEN
    RETURN p_venta.caja_slug_cobro;
  END IF;
  RETURN (
    SELECT slug FROM public.control_caja_cajas
    WHERE activa AND slug NOT IN ('admin', 'vuelto')
    ORDER BY slug
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.plotlab_sync_venta_caja_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monto numeric;
  v_slug text;
  v_ref text;
  v_mov uuid;
  v_ef numeric := 0;
  v_tj numeric := 0;
  v_tr numeric := 0;
  v_cc numeric := 0;
  v_ot numeric := 0;
  v_met text;
BEGIN
  v_ref := 'PL-VENTA-' || NEW.id::text;
  v_met := COALESCE(NULLIF(trim(NEW.metodo_pago), ''), 'Otro');

  IF NEW.estado_pago = 'Cancelado'
     OR (NEW.estado_pago = 'Pendiente' AND v_met <> 'Cuenta Corriente') THEN
    UPDATE public.control_caja_movimientos
    SET anulado = true, updated_at = now()
    WHERE origen_importacion = 'plotlab_venta'
      AND anulado = false
      AND observacion LIKE '%' || v_ref || '%';
    RETURN NEW;
  END IF;

  IF NEW.estado_pago NOT IN ('Pagado', 'Parcial', 'Pendiente') THEN
    RETURN NEW;
  END IF;

  v_monto := public.plotlab_monto_cobrado_venta(NEW.id);
  IF NEW.estado_pago = 'Parcial' AND v_monto <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.estado_pago = 'Pendiente' AND v_met = 'Cuenta Corriente' THEN
    v_monto := COALESCE(NEW.valor_total, 0);
  ELSIF v_monto <= 0 THEN
    v_monto := COALESCE(NEW.valor_total, 0);
  END IF;
  IF v_monto <= 0 THEN RETURN NEW; END IF;

  v_slug := public.plotlab_caja_slug_venta(NEW);
  IF v_slug IS NULL THEN RETURN NEW; END IF;

  IF v_met = 'Efectivo' THEN v_ef := v_monto;
  ELSIF v_met IN ('Tarjeta') OR v_met ILIKE '%mercado%pago%' THEN v_tj := v_monto;
  ELSIF v_met IN ('Transferencia', 'Depósito') THEN v_tr := v_monto;
  ELSIF v_met = 'Cuenta Corriente' THEN v_cc := v_monto;
  ELSIF v_met = 'Cheque' THEN v_ot := v_monto;
  ELSE v_ot := v_monto;
  END IF;

  SELECT id INTO v_mov
  FROM public.control_caja_movimientos
  WHERE origen_importacion = 'plotlab_venta'
    AND observacion LIKE '%' || v_ref || '%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_mov IS NULL THEN
    INSERT INTO public.control_caja_movimientos (
      fecha, hora, concepto, tipo_movimiento, categoria, tercero_nombre,
      origen_slug, destino_slug, efectivo, otros, monto_total,
      tarjeta, transferencia_bancaria, cuenta_corriente, cheque_tercero,
      nro_comprobante, observacion, id_usuario, usuario_nombre,
      origen_importacion, anulado, medios
    ) VALUES (
      COALESCE(NEW.fecha_venta, CURRENT_DATE),
      LOCALTIME,
      left('Venta ' || NEW.cliente_nombre, 120),
      'ingreso', 'Venta', NEW.cliente_nombre,
      'admin', v_slug,
      v_ef, v_tj + v_tr + v_cc + v_ot, v_monto,
      v_tj, v_tr, v_cc, CASE WHEN v_met = 'Cheque' THEN v_ot ELSE 0 END,
      NEW.numero_venta,
      'PlotLab venta (' || v_ref || ') — ' || v_met,
      NEW.id_vendedor, NEW.nombre_vendedor,
      'plotlab_venta', false,
      jsonb_build_object(
        'total', v_monto, 'efectivo', v_ef, 'tarjetas', v_tj,
        'trans_b', v_tr, 'cta_cte', v_cc, 'otros', CASE WHEN v_met NOT IN ('Efectivo','Tarjeta','Transferencia','Depósito','Cuenta Corriente','Cheque') THEN v_ot ELSE 0 END
      )
    );
  ELSE
    UPDATE public.control_caja_movimientos SET
      fecha = COALESCE(NEW.fecha_venta, fecha),
      destino_slug = v_slug,
      efectivo = v_ef,
      tarjeta = v_tj,
      transferencia_bancaria = v_tr,
      cuenta_corriente = v_cc,
      cheque_tercero = CASE WHEN v_met = 'Cheque' THEN v_ot ELSE 0 END,
      otros = v_tj + v_tr + v_cc + v_ot,
      monto_total = v_monto,
      observacion = 'PlotLab venta (' || v_ref || ') — ' || v_met,
      anulado = false,
      medios = jsonb_build_object(
        'total', v_monto, 'efectivo', v_ef, 'tarjetas', v_tj,
        'trans_b', v_tr, 'cta_cte', v_cc
      ),
      updated_at = now()
    WHERE id = v_mov;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plotlab_sync_venta_caja ON public.ventas;
CREATE TRIGGER trg_plotlab_sync_venta_caja
  AFTER INSERT OR UPDATE OF estado_pago, metodo_pago, valor_total, monto_pagado, caja_slug_cobro, fecha_venta
  ON public.ventas
  FOR EACH ROW
  EXECUTE FUNCTION public.plotlab_sync_venta_caja_trigger();

CREATE OR REPLACE FUNCTION public.plotlab_sync_cobro_caja_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta_id integer;
  v_ref text;
  v_slug text;
  v_met text;
BEGIN
  IF NEW.tipo IS DISTINCT FROM 'Cobro' THEN RETURN NEW; END IF;

  SELECT f.id_venta INTO v_venta_id
  FROM public.cuentas_por_cobrar cxc
  JOIN public.facturas_venta f ON f.id = cxc.id_factura
  WHERE cxc.id = NEW.id_cuenta_por_cobrar
  LIMIT 1;

  IF v_venta_id IS NOT NULL THEN
    UPDATE public.ventas v SET
      estado_pago = CASE
        WHEN cxc.monto_pendiente <= 0 THEN 'Pagado'
        WHEN cxc.monto_pagado > 0 THEN 'Parcial'
        ELSE v.estado_pago
      END,
      monto_pagado = cxc.monto_pagado,
      metodo_pago = COALESCE(NULLIF(trim(v.metodo_pago), ''), NEW.metodo_pago),
      updated_at = now()
    FROM public.cuentas_por_cobrar cxc
    JOIN public.facturas_venta f ON f.id = cxc.id_factura
    WHERE f.id_venta = v.id AND cxc.id = NEW.id_cuenta_por_cobrar AND v.id = v_venta_id;
    RETURN NEW;
  END IF;

  v_ref := 'PL-COBRO-' || NEW.id::text;
  v_met := COALESCE(NULLIF(trim(NEW.metodo_pago), ''), 'Otro');
  v_slug := (
    SELECT slug FROM public.control_caja_cajas
    WHERE activa AND slug NOT IN ('admin', 'vuelto')
    ORDER BY slug LIMIT 1
  );
  IF v_slug IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.control_caja_movimientos
    WHERE origen_importacion = 'plotlab_venta' AND observacion LIKE '%' || v_ref || '%'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.control_caja_movimientos (
    fecha, hora, concepto, tipo_movimiento, categoria,
    origen_slug, destino_slug, efectivo, tarjeta, transferencia_bancaria,
    monto_total, otros, nro_comprobante, observacion, id_usuario,
    origen_importacion, anulado
  ) VALUES (
    COALESCE(NEW.fecha_pago, CURRENT_DATE),
    LOCALTIME,
    'Cobro CxC',
    'ingreso', 'Cobro',
    'admin', v_slug,
    CASE WHEN v_met = 'Efectivo' THEN NEW.monto ELSE 0 END,
    CASE WHEN v_met = 'Tarjeta' THEN NEW.monto ELSE 0 END,
    CASE WHEN v_met IN ('Transferencia', 'Depósito') THEN NEW.monto ELSE 0 END,
    NEW.monto,
    CASE WHEN v_met NOT IN ('Efectivo', 'Tarjeta', 'Transferencia', 'Depósito') THEN NEW.monto ELSE 0 END,
    NEW.numero_comprobante,
    'PlotLab cobro (' || v_ref || ') — ' || v_met,
    NEW.id_usuario,
    'plotlab_venta', false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plotlab_sync_cobro_caja ON public.pagos_cobros;
CREATE TRIGGER trg_plotlab_sync_cobro_caja
  AFTER INSERT ON public.pagos_cobros
  FOR EACH ROW
  EXECUTE FUNCTION public.plotlab_sync_cobro_caja_trigger();
