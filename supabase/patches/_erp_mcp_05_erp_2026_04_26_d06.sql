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
