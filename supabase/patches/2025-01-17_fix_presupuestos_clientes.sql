-- ============================================
-- FIX: Corregir ambigüedad en función obtener_detalle_presupuesto_cliente
-- ============================================

BEGIN;

-- Recrear la función con referencias explícitas para evitar ambigüedad
CREATE OR REPLACE FUNCTION public.obtener_detalle_presupuesto_cliente(
  p_id_presupuesto integer
)
RETURNS TABLE (
  presupuesto jsonb,
  items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  presupuesto_data jsonb;
  items_data jsonb;
BEGIN
  -- Obtener datos del presupuesto
  SELECT jsonb_build_object(
    'id', p.id,
    'numero_presupuesto', p.numero_presupuesto,
    'estado', p.estado,
    'fecha_creacion', p.fecha_creacion,
    'fecha_envio', p.fecha_envio,
    'fecha_respuesta', p.fecha_respuesta,
    'fecha_vencimiento', p.fecha_vencimiento,
    'precio_total', p.precio_total,
    'observaciones_cliente', p.observaciones_cliente,
    'observaciones_internas', p.observaciones_internas,
    'id_pedido_asociado', p.id_pedido_asociado,
    'id_op_asociada', p.id_op_asociada,
    'cliente', jsonb_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'apellido', c.apellido,
      'empresa', c.empresa,
      'email', c.email,
      'telefono', c.telefono
    )
  )
  INTO presupuesto_data
  FROM public.presupuestos_clientes p
  JOIN public.clientes c ON c.id = p.id_cliente
  WHERE p.id = p_id_presupuesto;

  -- Obtener items del presupuesto con referencias explícitas
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', presupuestos_clientes_items.id,
      'id_articulo', presupuestos_clientes_items.id_articulo,
      'articulo', jsonb_build_object(
        'codigo', articulos_empresa.codigo,
        'nombre', articulos_empresa.nombre,
        'descripcion', articulos_empresa.descripcion
      ),
      'cantidad', presupuestos_clientes_items.cantidad,
      'precio_unitario', presupuestos_clientes_items.precio_unitario,
      'precio_total', presupuestos_clientes_items.precio_total,
      'descripcion_personalizada', presupuestos_clientes_items.descripcion_personalizada
    )
  )
  INTO items_data
  FROM public.presupuestos_clientes_items
  JOIN public.articulos_empresa ON articulos_empresa.id = presupuestos_clientes_items.id_articulo
  WHERE presupuestos_clientes_items.id_presupuesto = p_id_presupuesto;

  RETURN QUERY
  SELECT
    COALESCE(presupuesto_data, '{}'::jsonb),
    COALESCE(items_data, '[]'::jsonb);
END;
$$;

COMMIT;

