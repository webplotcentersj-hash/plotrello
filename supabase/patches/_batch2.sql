-- Flujo de Caja
CREATE OR REPLACE FUNCTION public.obtener_flujo_caja(
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS TABLE (
  fecha date,
  concepto varchar,
  tipo varchar,
  ingreso numeric,
  egreso numeric,
  saldo_acumulado numeric
) AS $$
DECLARE
  v_saldo_inicial numeric := 0;
  v_saldo_actual numeric := 0;
BEGIN
  -- Calcular saldo inicial (hasta fecha_desde)
  SELECT COALESCE(SUM(
    CASE
      WHEN pc.tipo IN ('Activo') AND pc.codigo LIKE '1.1.1%' THEN
        CASE WHEN pc.naturaleza = 'Deudora' THEN ad.debe - ad.haber ELSE ad.haber - ad.debe END
      ELSE 0
    END
  ), 0) INTO v_saldo_inicial
  FROM public.asientos_detalle ad
  JOIN public.plan_cuentas pc ON pc.id = ad.id_cuenta
  JOIN public.asientos_contables ac ON ac.id = ad.id_asiento
  WHERE ac.fecha < p_fecha_desde
    AND ac.estado = 'Contabilizado'
    AND pc.codigo LIKE '1.1.1%'; -- Caja y Bancos

  v_saldo_actual := v_saldo_inicial;

  -- Retornar movimientos en el perÃ­odo
  RETURN QUERY
  WITH movimientos AS (
    SELECT
      ac.fecha,
      ac.concepto,
      CASE
        WHEN pc.codigo LIKE '4.%' THEN 'Ingreso'
        WHEN pc.codigo LIKE '5.%' OR pc.codigo LIKE '6.%' THEN 'Egreso'
        WHEN pc.codigo LIKE '1.1.1%' THEN 'Movimiento'
        ELSE 'Otro'
      END as tipo_movimiento,
      CASE
        WHEN pc.codigo LIKE '4.%' AND ad.haber > 0 THEN ad.haber
        WHEN pc.codigo LIKE '1.1.1%' AND ad.debe > 0 THEN ad.debe
        ELSE 0
      END as ingreso,
      CASE
        WHEN (pc.codigo LIKE '5.%' OR pc.codigo LIKE '6.%') AND ad.debe > 0 THEN ad.debe
        WHEN pc.codigo LIKE '1.1.1%' AND ad.haber > 0 THEN ad.haber
        ELSE 0
      END as egreso
    FROM public.asientos_detalle ad
    JOIN public.plan_cuentas pc ON pc.id = ad.id_cuenta
    JOIN public.asientos_contables ac ON ac.id = ad.id_asiento
    WHERE ac.fecha >= p_fecha_desde
      AND ac.fecha <= p_fecha_hasta
      AND ac.estado = 'Contabilizado'
      AND (
        pc.codigo LIKE '1.1.1%' OR -- Caja y Bancos
        pc.codigo LIKE '4.%' OR     -- Ingresos
        pc.codigo LIKE '5.%' OR     -- Costos
        pc.codigo LIKE '6.%'        -- Gastos
      )
  )
  SELECT
    m.fecha,
    m.concepto::varchar,
    m.tipo_movimiento::varchar,
    SUM(m.ingreso) OVER (ORDER BY m.fecha, m.concepto) as ingreso,
    SUM(m.egreso) OVER (ORDER BY m.fecha, m.concepto) as egreso,
    v_saldo_inicial + SUM(m.ingreso - m.egreso) OVER (ORDER BY m.fecha, m.concepto) as saldo_acumulado
  FROM movimientos m
  WHERE m.ingreso > 0 OR m.egreso > 0
  ORDER BY m.fecha, m.concepto;
END;
$$ LANGUAGE plpgsql;

-- Obtener resumen de cuentas por tipo
CREATE OR REPLACE FUNCTION public.obtener_resumen_cuentas(
  p_fecha_corte date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  tipo_cuenta varchar,
  total_deudor numeric,
  total_acreedor numeric,
  saldo_final numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH saldos_por_tipo AS (
    SELECT
      pc.tipo,
      COALESCE(SUM(ad.debe), 0) as total_debe,
      COALESCE(SUM(ad.haber), 0) as total_haber
    FROM public.plan_cuentas pc
    LEFT JOIN public.asientos_detalle ad ON ad.id_cuenta = pc.id
    LEFT JOIN public.asientos_contables ac ON ac.id = ad.id_asiento
    WHERE pc.activa = true
      AND (ac.fecha IS NULL OR ac.fecha <= p_fecha_corte)
      AND (ac.estado IS NULL OR ac.estado = 'Contabilizado')
    GROUP BY pc.tipo
  )
  SELECT
    spt.tipo::varchar,
    spt.total_debe as total_deudor,
    spt.total_haber as total_acreedor,
    CASE
      WHEN spt.tipo IN ('Activo', 'Costo', 'Gasto') THEN spt.total_debe - spt.total_haber
      ELSE spt.total_haber - spt.total_debe
    END as saldo_final
  FROM saldos_por_tipo spt
  WHERE spt.total_debe > 0 OR spt.total_haber > 0
  ORDER BY spt.tipo;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. TRIGGERS
-- ============================================

-- Trigger para actualizar monto pendiente en cuentas por cobrar
CREATE OR REPLACE FUNCTION public.actualizar_cxc_pendiente()
RETURNS TRIGGER AS $$
DECLARE
  v_cxc_id integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo IS DISTINCT FROM 'Cobro' OR OLD.id_cuenta_por_cobrar IS NULL THEN
      RETURN OLD;
    END IF;
    v_cxc_id := OLD.id_cuenta_por_cobrar;
  ELSE
    IF NEW.tipo IS DISTINCT FROM 'Cobro' OR NEW.id_cuenta_por_cobrar IS NULL THEN
      RETURN NEW;
    END IF;
    v_cxc_id := NEW.id_cuenta_por_cobrar;
  END IF;

  UPDATE public.cuentas_por_cobrar
  SET 
    monto_pagado = (
      SELECT COALESCE(SUM(monto), 0)
      FROM public.pagos_cobros
      WHERE id_cuenta_por_cobrar = v_cxc_id
        AND tipo = 'Cobro'
    ),
    monto_pendiente = monto_total - (
      SELECT COALESCE(SUM(monto), 0)
      FROM public.pagos_cobros
      WHERE id_cuenta_por_cobrar = v_cxc_id
        AND tipo = 'Cobro'
    ),
    estado = CASE
      WHEN monto_total - (
        SELECT COALESCE(SUM(monto), 0)
        FROM public.pagos_cobros
        WHERE id_cuenta_por_cobrar = v_cxc_id
          AND tipo = 'Cobro'
      ) <= 0 THEN 'Pagado'
      WHEN monto_total - (
        SELECT COALESCE(SUM(monto), 0)
        FROM public.pagos_cobros
        WHERE id_cuenta_por_cobrar = v_cxc_id
          AND tipo = 'Cobro'
      ) < monto_total THEN 'Parcial'
      WHEN fecha_vencimiento < CURRENT_DATE THEN 'Vencido'
      ELSE 'Pendiente'
    END,
    updated_at = now()
  WHERE id = v_cxc_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_cxc_pago ON public.pagos_cobros;
CREATE TRIGGER trigger_actualizar_cxc_pago
AFTER INSERT OR UPDATE OR DELETE ON public.pagos_cobros
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_cxc_pendiente();

-- Trigger para actualizar monto pendiente en cuentas por pagar
CREATE OR REPLACE FUNCTION public.actualizar_cxp_pendiente()
RETURNS TRIGGER AS $$
DECLARE
  v_cxp_id integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo IS DISTINCT FROM 'Pago' OR OLD.id_cuenta_por_pagar IS NULL THEN
      RETURN OLD;
    END IF;
    v_cxp_id := OLD.id_cuenta_por_pagar;
  ELSE
    IF NEW.tipo IS DISTINCT FROM 'Pago' OR NEW.id_cuenta_por_pagar IS NULL THEN
      RETURN NEW;
    END IF;
    v_cxp_id := NEW.id_cuenta_por_pagar;
  END IF;

  UPDATE public.cuentas_por_pagar
  SET 
    monto_pagado = (
      SELECT COALESCE(SUM(monto), 0)
      FROM public.pagos_cobros
      WHERE id_cuenta_por_pagar = v_cxp_id
        AND tipo = 'Pago'
    ),
    monto_pendiente = monto_total - (
      SELECT COALESCE(SUM(monto), 0)
      FROM public.pagos_cobros
      WHERE id_cuenta_por_pagar = v_cxp_id
        AND tipo = 'Pago'
    ),
    estado = CASE
      WHEN monto_total - (
        SELECT COALESCE(SUM(monto), 0)
        FROM public.pagos_cobros
        WHERE id_cuenta_por_pagar = v_cxp_id
          AND tipo = 'Pago'
      ) <= 0 THEN 'Pagado'
      WHEN monto_total - (
        SELECT COALESCE(SUM(monto), 0)
        FROM public.pagos_cobros
        WHERE id_cuenta_por_pagar = v_cxp_id
          AND tipo = 'Pago'
      ) < monto_total THEN 'Parcial'
      WHEN fecha_vencimiento < CURRENT_DATE THEN 'Vencido'
      ELSE 'Pendiente'
    END,
    updated_at = now()
  WHERE id = v_cxp_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_cxp_pago ON public.pagos_cobros;
CREATE TRIGGER trigger_actualizar_cxp_pago
AFTER INSERT OR UPDATE OR DELETE ON public.pagos_cobros
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_cxp_pendiente();

-- Trigger para crear factura automÃ¡tica al entregar OP
CREATE OR REPLACE FUNCTION public.crear_factura_automatica_op()
RETURNS TRIGGER AS $$
DECLARE
  v_venta RECORD;
  v_config_afip RECORD;
  v_numero_comprobante integer;
  v_numero_factura varchar(50);
  v_factura_id integer;
  v_items_factura RECORD;
BEGIN
  -- Solo procesar si la OP cambiÃ³ a estado "Entregado" o "Finalizado"
  IF (NEW.entregado = true AND (OLD.entregado IS NULL OR OLD.entregado = false))
     OR (NEW.estado = 'Finalizado' AND OLD.estado != 'Finalizado') THEN
    
    -- Verificar si ya existe una factura para esta OP
    IF EXISTS (SELECT 1 FROM public.facturas_venta WHERE id_op = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Buscar venta asociada
    SELECT * INTO v_venta
    FROM public.ventas
    WHERE id_op = NEW.id
    LIMIT 1;

    -- Si no hay venta, no crear factura automÃ¡ticamente
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Obtener configuraciÃ³n AFIP
    SELECT * INTO v_config_afip
    FROM public.configuracion_afip
    WHERE activo = true
    LIMIT 1;

    IF NOT FOUND THEN
      -- Si no hay configuraciÃ³n AFIP, no crear factura
      RETURN NEW;
    END IF;

    -- Determinar tipo de comprobante segÃºn cliente
    DECLARE
      v_tipo_comprobante varchar(50) := 'Factura B';
    BEGIN
      IF NEW.dni_cuit IS NOT NULL AND LENGTH(NEW.dni_cuit) = 11 THEN
        v_tipo_comprobante := 'Factura A';
      END IF;

      -- Generar nÃºmero de comprobante
      SELECT public.generar_numero_factura(v_tipo_comprobante, v_config_afip.punto_venta)
      INTO v_numero_comprobante;

      -- Crear nÃºmero de factura
      v_numero_factura := LPAD(v_config_afip.punto_venta::text, 4, '0') || '-' || LPAD(v_numero_comprobante::text, 8, '0');

      -- Obtener items de la venta
      -- Calcular totales
      DECLARE
        v_subtotal numeric := 0;
        v_descuento_total numeric := 0;
        v_iva_total numeric := 0;
        v_total numeric := 0;
      BEGIN
        -- Calcular desde items de venta
        SELECT 
          COALESCE(SUM((cantidad * precio_unitario) - COALESCE(descuento, 0)), 0),
          COALESCE(SUM(descuento), 0),
          COALESCE(SUM(((cantidad * precio_unitario) - COALESCE(descuento, 0)) * 0.21), 0)
        INTO v_subtotal, v_descuento_total, v_iva_total
        FROM public.ventas_items
        WHERE id_venta = v_venta.id;

        v_total := v_subtotal + v_iva_total;

        -- Crear factura
        INSERT INTO public.facturas_venta (
          numero_factura,
          punto_venta,
          numero_comprobante,
          tipo_comprobante,
          fecha_emision,
          id_cliente,
          cliente_nombre,
          cliente_dni_cuit,
          cliente_direccion,
          id_op,
          numero_op,
          id_venta,
          subtotal,
          descuento,
          iva,
          total,
          estado,
          estado_afip
        ) VALUES (
          v_numero_factura,
          v_config_afip.punto_venta,
          v_numero_comprobante,
          v_tipo_comprobante,
          CURRENT_DATE,
          NULL, -- Se puede asociar despuÃ©s
          COALESCE(NEW.cliente, 'Cliente'),
          NEW.dni_cuit,
          NEW.direccion_cliente,
          NEW.id,
          NEW.numero_op,
          v_venta.id,
          v_subtotal,
          v_descuento_total,
          v_iva_total,
          v_total,
          'Borrador',
          'Pendiente'
        ) RETURNING id INTO v_factura_id;

        -- Crear items de factura desde items de venta
        FOR v_items_factura IN 
          SELECT 
            vi.descripcion,
            vi.cantidad,
            vi.precio_unitario,
            COALESCE(vi.descuento, 0) as descuento,
            21.0 as iva_porcentaje
          FROM public.ventas_items vi
          WHERE vi.id_venta = v_venta.id
        LOOP
          DECLARE
            v_subtotal_item numeric := (v_items_factura.cantidad * v_items_factura.precio_unitario) - v_items_factura.descuento;
            v_iva_item numeric := v_subtotal_item * (v_items_factura.iva_porcentaje / 100);
            v_total_item numeric := v_subtotal_item + v_iva_item;
          BEGIN
            INSERT INTO public.facturas_items (
              id_factura,
              item_numero,
              descripcion,
              cantidad,
              unidad_medida,
              precio_unitario,
              descuento,
              iva_porcentaje,
              iva_monto,
              subtotal,
              total
            ) VALUES (
              v_factura_id,
              (SELECT COALESCE(MAX(item_numero), 0) + 1 FROM public.facturas_items WHERE id_factura = v_factura_id),
              v_items_factura.descripcion,
              v_items_factura.cantidad,
              'UN',
              v_items_factura.precio_unitario,
              v_items_factura.descuento,
              v_items_factura.iva_porcentaje,
              v_iva_item,
              v_subtotal_item,
              v_total_item
            );
          END;
        END LOOP;
      END;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;