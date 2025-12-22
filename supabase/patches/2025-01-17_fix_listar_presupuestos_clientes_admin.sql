-- ============================================
-- FIX: Corregir tipos de datos en función listar_presupuestos_clientes_admin
-- ============================================

BEGIN;

-- Eliminar la función existente
DROP FUNCTION IF EXISTS public.listar_presupuestos_clientes_admin(character varying, integer, date, date);

-- Recrear la función con los tipos correctos (text en lugar de varchar)
CREATE OR REPLACE FUNCTION public.listar_presupuestos_clientes_admin(
  p_estado varchar DEFAULT NULL,
  p_id_cliente integer DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  numero_presupuesto varchar,
  id_cliente integer,
  cliente_nombre text,
  cliente_empresa text,
  cliente_email text,
  estado varchar,
  fecha_creacion timestamptz,
  fecha_envio timestamptz,
  fecha_vencimiento date,
  precio_total numeric,
  id_pedido_asociado integer,
  id_op_asociada integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.numero_presupuesto,
    p.id_cliente,
    c.nombre::text as cliente_nombre,
    COALESCE(c.empresa::text, '') as cliente_empresa,
    c.email::text as cliente_email,
    p.estado,
    p.fecha_creacion,
    p.fecha_envio,
    p.fecha_vencimiento,
    p.precio_total,
    p.id_pedido_asociado,
    p.id_op_asociada
  FROM public.presupuestos_clientes p
  JOIN public.clientes c ON c.id = p.id_cliente
  WHERE 
    (p_estado IS NULL OR p.estado = p_estado)
    AND (p_id_cliente IS NULL OR p.id_cliente = p_id_cliente)
    AND (p_fecha_desde IS NULL OR p.fecha_creacion::date >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR p.fecha_creacion::date <= p_fecha_hasta)
  ORDER BY p.fecha_creacion DESC;
END;
$$;

COMMIT;

