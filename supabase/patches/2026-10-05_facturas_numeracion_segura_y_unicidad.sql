-- La numeración leía configuracion_afip como el usuario (anon no tiene SELECT).
-- Una venta no puede tener dos facturas vivas, y una nota de crédito no puede pasar el total.
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

CREATE OR REPLACE FUNCTION public.facturas_venta_antes_de_guardar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otra integer;
  v_origen_total numeric;
  v_origen_estado text;
  v_origen_afip text;
  v_ya numeric;
BEGIN
  IF NEW.id_venta IS NOT NULL
     AND NEW.tipo_comprobante LIKE 'Factura%'
     AND COALESCE(NEW.estado, '') IS DISTINCT FROM 'Anulada' THEN
    SELECT id INTO v_otra
    FROM public.facturas_venta
    WHERE id_venta = NEW.id_venta
      AND tipo_comprobante LIKE 'Factura%'
      AND estado IS DISTINCT FROM 'Anulada'
      AND id IS DISTINCT FROM COALESCE(NEW.id, 0)
    LIMIT 1;
    IF v_otra IS NOT NULL THEN
      RAISE EXCEPTION 'Esta venta ya tiene una factura (id %). No se duplica: para anular un comprobante autorizado emití una nota de crédito.', v_otra;
    END IF;
  END IF;

  IF NEW.tipo_comprobante LIKE 'Nota de Crédito%' AND NEW.id_factura_referencia IS NOT NULL THEN
    SELECT ABS(COALESCE(total, 0)), estado, COALESCE(estado_afip, '')
      INTO v_origen_total, v_origen_estado, v_origen_afip
    FROM public.facturas_venta
    WHERE id = NEW.id_factura_referencia;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La nota de crédito no tiene un comprobante origen válido.';
    END IF;
    IF v_origen_estado IS DISTINCT FROM 'Emitida' OR v_origen_afip IS DISTINCT FROM 'Autorizada' THEN
      RAISE EXCEPTION 'Solo se puede acreditar un comprobante ya autorizado en AFIP.';
    END IF;
    SELECT COALESCE(SUM(ABS(total)), 0) INTO v_ya
    FROM public.facturas_venta
    WHERE id_factura_referencia = NEW.id_factura_referencia
      AND tipo_comprobante LIKE 'Nota de Crédito%'
      AND estado IS DISTINCT FROM 'Anulada'
      AND COALESCE(estado_afip, '') IS DISTINCT FROM 'Rechazada'
      AND id IS DISTINCT FROM COALESCE(NEW.id, 0);
    IF v_ya + ABS(COALESCE(NEW.total, 0)) > v_origen_total + 0.05 THEN
      RAISE EXCEPTION 'La nota de crédito supera el saldo del comprobante (ya acreditado % sobre %).', v_ya, v_origen_total;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facturas_venta_antes_de_guardar ON public.facturas_venta;
CREATE TRIGGER trg_facturas_venta_antes_de_guardar
BEFORE INSERT OR UPDATE OF id_venta, tipo_comprobante, estado, total, id_factura_referencia
ON public.facturas_venta
FOR EACH ROW
EXECUTE FUNCTION public.facturas_venta_antes_de_guardar();

CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_una_por_venta
ON public.facturas_venta (id_venta)
WHERE id_venta IS NOT NULL
  AND estado IS DISTINCT FROM 'Anulada'
  AND tipo_comprobante LIKE 'Factura%';

CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_numero_autorizado
ON public.facturas_venta (tipo_comprobante, punto_venta, numero_comprobante)
WHERE estado_afip = 'Autorizada' AND numero_comprobante > 0;
