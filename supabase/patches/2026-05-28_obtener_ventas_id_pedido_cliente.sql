-- Incluir id_pedido_cliente en listado CRM (ventas desde portal/tótem).

CREATE OR REPLACE FUNCTION public.obtener_ventas(
  p_id_vendedor integer DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_estado_pago varchar(50) DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', v.id,
      'numero_venta', v.numero_venta,
      'id_oportunidad', v.id_oportunidad,
      'id_cliente', v.id_cliente,
      'id_pedido_cliente', v.id_pedido_cliente,
      'cliente_nombre', v.cliente_nombre,
      'cliente_telefono', v.cliente_telefono,
      'cliente_email', v.cliente_email,
      'cliente_dni_cuit', v.cliente_dni_cuit,
      'cliente_empresa', v.cliente_empresa,
      'cliente_direccion', v.cliente_direccion,
      'id_op', v.id_op,
      'numero_op', v.numero_op,
      'valor_total', v.valor_total,
      'metodo_pago', v.metodo_pago,
      'estado_pago', v.estado_pago,
      'fecha_venta', v.fecha_venta,
      'id_vendedor', v.id_vendedor,
      'nombre_vendedor', v.nombre_vendedor,
      'observaciones', v.observaciones,
      'comprobante_pago_url', v.comprobante_pago_url,
      'created_at', v.created_at,
      'updated_at', v.updated_at,
      'items', (
        SELECT COALESCE(json_agg(
          json_build_object(
            'id', vi.id,
            'id_venta', vi.id_venta,
            'id_articulo_stock', vi.id_articulo_stock,
            'codigo_articulo', vi.codigo_articulo,
            'descripcion', vi.descripcion,
            'cantidad', vi.cantidad,
            'precio_unitario', vi.precio_unitario,
            'precio_total', vi.precio_total,
            'descuento', vi.descuento,
            'observaciones', vi.observaciones,
            'created_at', vi.created_at
          )
          ORDER BY vi.id
        ), '[]'::json)
        FROM public.ventas_items vi
        WHERE vi.id_venta = v.id
      )
    )
    ORDER BY v.fecha_venta DESC, v.created_at DESC
  ) INTO v_result
  FROM public.ventas v
  WHERE (p_id_vendedor IS NULL OR v.id_vendedor = p_id_vendedor)
    AND (p_fecha_desde IS NULL OR v.fecha_venta >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR v.fecha_venta <= p_fecha_hasta)
    AND (p_estado_pago IS NULL OR v.estado_pago = p_estado_pago);

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
