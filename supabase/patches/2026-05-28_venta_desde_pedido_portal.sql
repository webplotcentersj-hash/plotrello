-- Registrar compras del portal/tótem en ventas (CRM).

ALTER TABLE public.pedidos_clientes
  ADD COLUMN IF NOT EXISTS id_venta_asociada integer REFERENCES public.ventas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_clientes_venta
  ON public.pedidos_clientes(id_venta_asociada)
  WHERE id_venta_asociada IS NOT NULL;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS id_pedido_cliente integer REFERENCES public.pedidos_clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_pedido_cliente
  ON public.ventas(id_pedido_cliente)
  WHERE id_pedido_cliente IS NOT NULL;

COMMENT ON COLUMN public.pedidos_clientes.id_venta_asociada IS
  'Venta CRM generada al confirmar compra (portal/tótem).';
COMMENT ON COLUMN public.ventas.id_pedido_cliente IS
  'Pedido web origen de la venta.';

CREATE OR REPLACE FUNCTION public.crear_venta_desde_pedido_cliente(
  p_id_pedido integer,
  p_id_vendedor integer DEFAULT NULL,
  p_nombre_vendedor varchar(255) DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pedido_record RECORD;
  cliente_record RECORD;
  item_record RECORD;
  v_id_venta integer;
  v_numero_venta varchar(50);
  v_id_vendedor integer;
  v_nombre_vendedor varchar(255);
  v_cliente_nombre varchar(255);
  v_canal text;
BEGIN
  SELECT * INTO pedido_record
  FROM public.pedidos_clientes pc
  WHERE pc.id = p_id_pedido;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF COALESCE(pedido_record.tipo_intencion, 'compra') <> 'compra' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Solo los pedidos tipo compra generan venta automática'
    );
  END IF;

  IF pedido_record.id_venta_asociada IS NOT NULL THEN
    SELECT v.id, v.numero_venta
    INTO v_id_venta, v_numero_venta
    FROM public.ventas v
    WHERE v.id = pedido_record.id_venta_asociada;

    RETURN json_build_object(
      'success', true,
      'data', json_build_object('id', v_id_venta, 'numero_venta', v_numero_venta, 'ya_existia', true)
    );
  END IF;

  SELECT * INTO cliente_record
  FROM public.clientes c
  WHERE c.id = pedido_record.id_cliente;

  v_cliente_nombre := COALESCE(
    NULLIF(trim(cliente_record.empresa), ''),
    trim(COALESCE(cliente_record.nombre, '') || ' ' || COALESCE(cliente_record.apellido, ''))
  );
  IF v_cliente_nombre = '' OR v_cliente_nombre IS NULL THEN
    v_cliente_nombre := 'Cliente #' || pedido_record.id_cliente::text;
  END IF;

  v_id_vendedor := p_id_vendedor;
  v_nombre_vendedor := NULLIF(trim(p_nombre_vendedor), '');

  IF v_id_vendedor IS NULL THEN
    SELECT u.id, u.nombre::varchar(255)
    INTO v_id_vendedor, v_nombre_vendedor
    FROM public.usuarios u
    WHERE COALESCE(u.activo, true) = true
    ORDER BY
      CASE
        WHEN lower(COALESCE(u.nombre, '')) LIKE '%portal%' THEN 0
        WHEN lower(COALESCE(u.rol, '')) LIKE '%mostrador%' THEN 1
        ELSE 2
      END,
      u.id
    LIMIT 1;
  END IF;

  IF v_id_vendedor IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No hay usuario vendedor para registrar la venta');
  END IF;

  IF v_nombre_vendedor IS NULL THEN
    SELECT u.nombre::varchar(255) INTO v_nombre_vendedor
    FROM public.usuarios u
    WHERE u.id = v_id_vendedor;
  END IF;

  v_canal := CASE
    WHEN pedido_record.observaciones_cliente ILIKE '%tótem%' OR pedido_record.observaciones_cliente ILIKE '%totem%'
      THEN 'tótem'
    ELSE 'portal cliente'
  END;

  v_numero_venta := 'VENT-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(
    (COALESCE((SELECT MAX(v.id) FROM public.ventas v), 0) + 1)::text,
    4,
    '0'
  );

  INSERT INTO public.ventas (
    numero_venta,
    id_cliente,
    id_pedido_cliente,
    cliente_nombre,
    cliente_telefono,
    cliente_email,
    cliente_dni_cuit,
    cliente_empresa,
    cliente_direccion,
    id_op,
    numero_op,
    valor_total,
    metodo_pago,
    estado_pago,
    fecha_venta,
    id_vendedor,
    nombre_vendedor,
    observaciones
  ) VALUES (
    v_numero_venta,
    pedido_record.id_cliente,
    p_id_pedido,
    v_cliente_nombre,
    cliente_record.telefono,
    cliente_record.email,
    cliente_record.dni_cuit,
    cliente_record.empresa,
    cliente_record.direccion,
    NULL,
    NULL,
    COALESCE(pedido_record.precio_total, 0),
    'Otro',
    'Pendiente',
    CURRENT_DATE,
    v_id_vendedor,
    COALESCE(v_nombre_vendedor, 'Portal'),
    'Venta ' || v_canal || ' · Pedido ' || pedido_record.numero_pedido
  )
  RETURNING id INTO v_id_venta;

  FOR item_record IN
    SELECT
      i.cantidad,
      i.precio_unitario,
      i.precio_total,
      i.descripcion_personalizada,
      a.nombre AS nombre_articulo,
      a.codigo AS codigo_articulo,
      a.id_articulo_stock
    FROM public.pedidos_clientes_items i
    JOIN public.articulos_empresa a ON a.id = i.id_articulo
    WHERE i.id_pedido = p_id_pedido
  LOOP
    INSERT INTO public.ventas_items (
      id_venta,
      id_articulo_stock,
      codigo_articulo,
      descripcion,
      cantidad,
      precio_unitario,
      precio_total,
      observaciones
    ) VALUES (
      v_id_venta,
      item_record.id_articulo_stock,
      item_record.codigo_articulo,
      COALESCE(
        NULLIF(trim(item_record.descripcion_personalizada), ''),
        item_record.nombre_articulo
      ),
      item_record.cantidad,
      item_record.precio_unitario,
      item_record.precio_total,
      'Pedido ' || pedido_record.numero_pedido
    );
  END LOOP;

  UPDATE public.ventas v
  SET valor_total = COALESCE((
      SELECT SUM(vi.precio_total) FROM public.ventas_items vi WHERE vi.id_venta = v_id_venta
    ), 0),
    updated_at = now()
  WHERE v.id = v_id_venta;

  UPDATE public.pedidos_clientes pc
  SET id_venta_asociada = v_id_venta
  WHERE pc.id = p_id_pedido;

  RETURN json_build_object(
    'success', true,
    'data', json_build_object('id', v_id_venta, 'numero_venta', v_numero_venta, 'ya_existia', false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_venta_desde_pedido_cliente(integer, integer, varchar) TO authenticated, anon;
