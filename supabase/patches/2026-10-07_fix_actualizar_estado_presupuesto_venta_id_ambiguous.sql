-- FIX: RETURNS TABLE(id ...) hacía ambiguo WHERE id = p_id_presupuesto
CREATE OR REPLACE FUNCTION public.actualizar_estado_presupuesto_venta(
  p_id_presupuesto integer,
  p_estado varchar(50),
  p_observaciones_internas text DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  numero_presupuesto varchar,
  estado varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  presupuesto_record RECORD;
BEGIN
  IF p_estado NOT IN ('borrador', 'enviado', 'aceptado', 'rechazado', 'cancelado', 'convertido') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  UPDATE public.presupuestos_ventas AS pv
  SET
    estado = p_estado,
    observaciones_internas = COALESCE(p_observaciones_internas, pv.observaciones_internas),
    fecha_envio = CASE
      WHEN p_estado = 'enviado' AND pv.fecha_envio IS NULL THEN NOW()
      ELSE pv.fecha_envio
    END,
    fecha_respuesta = CASE
      WHEN p_estado IN ('aceptado', 'rechazado') THEN NOW()
      ELSE pv.fecha_respuesta
    END,
    updated_at = NOW()
  WHERE pv.id = p_id_presupuesto
  RETURNING * INTO presupuesto_record;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  RETURN QUERY
  SELECT
    presupuesto_record.id,
    presupuesto_record.numero_presupuesto,
    presupuesto_record.estado;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_estado_presupuesto_venta(integer, varchar, text) TO anon, authenticated;
