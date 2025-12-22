-- ============================================
-- FIX: Corregir ambigüedad en función enviar_presupuesto_cliente
-- ============================================

BEGIN;

-- Recrear la función con referencias explícitas
CREATE OR REPLACE FUNCTION public.enviar_presupuesto_cliente(
  p_id_presupuesto integer
)
RETURNS TABLE (
  id integer,
  numero_presupuesto varchar,
  estado varchar,
  fecha_envio timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.presupuestos_clientes
  SET
    estado = 'enviado',
    fecha_envio = NOW(),
    updated_at = NOW()
  WHERE presupuestos_clientes.id = p_id_presupuesto
    AND presupuestos_clientes.estado = 'borrador';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado o no está en estado borrador';
  END IF;

  RETURN QUERY
  SELECT p.id, p.numero_presupuesto, p.estado, p.fecha_envio
  FROM public.presupuestos_clientes p
  WHERE p.id = p_id_presupuesto;
END;
$$;

COMMIT;

