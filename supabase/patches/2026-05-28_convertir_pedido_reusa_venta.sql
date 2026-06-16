
DROP FUNCTION IF EXISTS public.convertir_pedido_a_op(integer, integer, varchar, text, text);

CREATE OR REPLACE FUNCTION public.convertir_pedido_a_op(
  p_id_pedido integer,
  p_id_usuario_convertidor integer,
  p_nombre_usuario_convertidor varchar(255),
  p_sector_inicial text DEFAULT 'Diseño Gráfico',
  p_observaciones text DEFAULT NULL
)
RETURNS TABLE (
  id_op integer,
  numero_op varchar,
  mensaje text,
  id_venta integer,
  numero_venta varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  pedido_record RECORD;
  cliente_record RECORD;
  item_record RECORD;
  archivo_record RECORD;
  nueva_op_id integer;
  numero_op_generado varchar(255);
  materiales_text text := '';
  descripcion_text text := '';
  spec_text text := '';
  max_numero_op integer;
  v_etiquetas text[] := ARRAY['Pedido Web']::text[];
  v_prioridad text := 'Normal';
  v_id_venta integer;
  v_numero_venta varchar(50);
  v_cliente_nombre varchar(255);
  mockup_url text;
  v_venta_existente boolean := false;
BEGIN
  SELECT * INTO pedido_record
  FROM public.pedidos_clientes pc
  WHERE pc.id = p_id_pedido;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF pedido_record.estado = 'convertido_completo' THEN
    RAISE EXCEPTION 'Este pedido ya fue convertido completamente';
  END IF;

  SELECT * INTO cliente_record
  FROM public.clientes c
  WHERE c.id = pedido_record.id_cliente;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  v_cliente_nombre := COALESCE(
    NULLIF(trim(cliente_record.empresa), ''),
    trim(COALESCE(cliente_record.nombre, '') || ' ' || COALESCE(cliente_record.apellido, ''))
  );
  IF v_cliente_nombre = '' THEN
    v_cliente_nombre := 'Cliente #' || pedido_record.id_cliente::text;
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(ot.numero_op FROM '[0-9]+$') AS integer)), 0) + 1
  INTO max_numero_op
  FROM public.ordenes_trabajo ot
  WHERE ot.numero_op LIKE 'OP-%';

  numero_op_generado := 'OP-' || LPAD(max_numero_op::text, 6, '0');

  -- Especificación / brief completo
  IF pedido_record.tipo_producto_otro IS NOT NULL AND trim(pedido_record.tipo_producto_otro) <> '' THEN
    spec_text := spec_text || E'\n[Especificación]\n' || trim(pedido_record.tipo_producto_otro);
  END IF;
  IF pedido_record.objetivo_proyecto IS NOT NULL AND trim(pedido_record.objetivo_proyecto) <> '' THEN
    spec_text := spec_text || E'\n[Objetivo]\n' || trim(pedido_record.objetivo_proyecto);
  END IF;
  IF pedido_record.brief_publico IS NOT NULL AND trim(pedido_record.brief_publico) <> '' THEN
    spec_text := spec_text || E'\n[Brief]\n' || trim(pedido_record.brief_publico);
  END IF;
  IF pedido_record.donde_colocados IS NOT NULL AND trim(pedido_record.donde_colocados) <> '' THEN
    spec_text := spec_text || E'\n[Ubicación / uso]\n' || trim(pedido_record.donde_colocados);
  END IF;
  IF pedido_record.digital_o_impresion IS NOT NULL AND trim(pedido_record.digital_o_impresion) <> '' THEN
    spec_text := spec_text || E'\n[Formato]\n' || trim(pedido_record.digital_o_impresion);
  END IF;
  IF pedido_record.cantidades IS NOT NULL AND trim(pedido_record.cantidades) <> '' THEN
    spec_text := spec_text || E'\n[Cantidades]\n' || trim(pedido_record.cantidades);
  END IF;
  IF pedido_record.estilo_diseno IS NOT NULL AND trim(pedido_record.estilo_diseno) <> '' THEN
    spec_text := spec_text || E'\n[Estilo]\n' || trim(pedido_record.estilo_diseno);
  END IF;
  IF pedido_record.referencias IS NOT NULL AND trim(pedido_record.referencias) <> '' THEN
    spec_text := spec_text || E'\n[Referencias]\n' || trim(pedido_record.referencias);
  END IF;
  IF pedido_record.referencias_links IS NOT NULL AND trim(pedido_record.referencias_links) <> '' THEN
    spec_text := spec_text || E'\n[Links]\n' || trim(pedido_record.referencias_links);
  END IF;

  SELECT a.url INTO mockup_url
  FROM public.pedidos_clientes_archivos a
  WHERE a.id_pedido = p_id_pedido
    AND (
      a.tipo = 'mockup_vista_previa'
      OR lower(a.nombre_archivo) LIKE 'mockup-vista-previa%'
    )
  ORDER BY a.uploaded_at DESC NULLS LAST, a.id DESC
  LIMIT 1;

  IF mockup_url IS NOT NULL THEN
    spec_text := spec_text || E'\n[Mockup vista previa]\n' || mockup_url;
  END IF;

  descripcion_text := COALESCE(pedido_record.observaciones_cliente, '') || E'\n\n';
  descripcion_text := descripcion_text || 'Pedido Web: ' || pedido_record.numero_pedido || E'\n';
  IF COALESCE(pedido_record.tipo_intencion, 'compra') = 'cotizacion' THEN
    descripcion_text := descripcion_text || 'Tipo: Cotización (convertida a producción)' || E'\n';
  END IF;
  descripcion_text := descripcion_text || 'Items solicitados:' || E'\n';

  FOR item_record IN
    SELECT i.*, a.nombre AS nombre_articulo, a.codigo AS codigo_articulo
    FROM public.pedidos_clientes_items i
    JOIN public.articulos_empresa a ON a.id = i.id_articulo
    WHERE i.id_pedido = p_id_pedido
  LOOP
    materiales_text := materiales_text ||
      '- ' || item_record.nombre_articulo ||
      ' (Cant: ' || item_record.cantidad ||
      ', $' || item_record.precio_total || ')' || E'\n';
    IF item_record.descripcion_personalizada IS NOT NULL THEN
      materiales_text := materiales_text || '  Desc: ' || item_record.descripcion_personalizada || E'\n';
    END IF;
  END LOOP;

  descripcion_text := descripcion_text || materiales_text;

  IF trim(spec_text) <> '' THEN
    descripcion_text := descripcion_text || E'\n\n--- Especificación del pedido ---' || spec_text;
  END IF;

  IF pedido_record.observaciones_internas IS NOT NULL AND pedido_record.observaciones_internas <> '' THEN
    descripcion_text := descripcion_text || E'\n\nObservaciones internas del pedido:' || E'\n' || pedido_record.observaciones_internas;
  END IF;

  IF p_observaciones IS NOT NULL AND p_observaciones <> '' THEN
    descripcion_text := descripcion_text || E'\n\nObservaciones al convertir:' || E'\n' || p_observaciones;
  END IF;

  descripcion_text := descripcion_text || E'\n\n---' || E'\n';
  descripcion_text := descripcion_text || 'Convertido desde pedido web ' || pedido_record.numero_pedido ||
    ' por ' || p_nombre_usuario_convertidor || ' el ' || CURRENT_TIMESTAMP::text;

  v_etiquetas := array_append(v_etiquetas, pedido_record.numero_pedido);
  IF pedido_record.es_urgente IS TRUE THEN
    v_etiquetas := array_append(v_etiquetas, 'Urgente');
    v_prioridad := 'Urgente';
  END IF;
  IF pedido_record.tipo_producto_servicio IS NOT NULL THEN
    v_etiquetas := v_etiquetas || pedido_record.tipo_producto_servicio;
  END IF;
  IF COALESCE(pedido_record.tipo_intencion, 'compra') = 'cotizacion' THEN
    v_etiquetas := array_append(v_etiquetas, 'Cotización');
  END IF;

  INSERT INTO public.ordenes_trabajo (
    numero_op,
    cliente,
    dni_cuit,
    descripcion,
    estado,
    prioridad,
    fecha_entrega,
    sector,
    sector_inicial,
    materiales,
    nombre_creador,
    telefono_cliente,
    email_cliente,
    direccion_cliente,
    id_pedido_cliente,
    origen_pedido_web,
    etiquetas
  ) VALUES (
    numero_op_generado,
    v_cliente_nombre,
    cliente_record.dni_cuit,
    descripcion_text,
    'Diseño Gráfico',
    v_prioridad,
    COALESCE(pedido_record.fecha_limite_deseada, CURRENT_DATE + INTERVAL '7 days'),
    p_sector_inicial,
    p_sector_inicial,
    materiales_text,
    p_nombre_usuario_convertidor,
    cliente_record.telefono,
    cliente_record.email,
    cliente_record.direccion,
    p_id_pedido,
    true,
    v_etiquetas
  )
  RETURNING id INTO nueva_op_id;

  -- Archivos del pedido → enlaces de la OP (mockup, adjuntos, etc.)
  FOR archivo_record IN
    SELECT * FROM public.pedidos_clientes_archivos pa
    WHERE pa.id_pedido = p_id_pedido
  LOOP
    INSERT INTO public.enlaces_adjuntos (id_orden, titulo, url)
    VALUES (
      nueva_op_id,
      CASE
        WHEN archivo_record.tipo = 'mockup_vista_previa'
          OR lower(archivo_record.nombre_archivo) LIKE 'mockup-vista-previa%'
          THEN 'Mockup vista previa · ' || pedido_record.numero_pedido
        ELSE archivo_record.nombre_archivo
      END,
      archivo_record.url
    );
  END LOOP;

  -- Venta en CRM (reutilizar si ya se creó al confirmar compra en portal)
  IF pedido_record.id_venta_asociada IS NOT NULL THEN
    v_venta_existente := true;
    v_id_venta := pedido_record.id_venta_asociada;
    SELECT v.numero_venta INTO v_numero_venta FROM public.ventas v WHERE v.id = v_id_venta;

    UPDATE public.ventas v
    SET
      id_op = nueva_op_id,
      numero_op = numero_op_generado,
      observaciones = COALESCE(v.observaciones, '') ||
        E'\nVinculada a OP ' || numero_op_generado || ' el ' || CURRENT_TIMESTAMP::text,
      updated_at = now()
    WHERE v.id = v_id_venta;
  ELSE
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
      nueva_op_id,
      numero_op_generado,
      COALESCE(pedido_record.precio_total, 0),
      'Otro',
      'Pendiente',
      CURRENT_DATE,
      p_id_usuario_convertidor,
      p_nombre_usuario_convertidor,
      'Venta desde pedido web ' || pedido_record.numero_pedido
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
  END IF;

  UPDATE public.pedidos_clientes pc
  SET
    id_op_asociada = nueva_op_id,
    estado = 'convertido_completo',
    observaciones_internas = COALESCE(pc.observaciones_internas, '') ||
      E'\nConvertido a OP ' || numero_op_generado || ' · Venta ' || v_numero_venta ||
      ' el ' || CURRENT_TIMESTAMP::text
  WHERE pc.id = p_id_pedido;

  BEGIN
    PERFORM public.crear_notificacion_cliente(
      pedido_record.id_cliente,
      'op_desde_pedido',
      'Tu pedido fue convertido en OP',
      'Convertimos tu pedido ' || pedido_record.numero_pedido || ' en la OP ' || numero_op_generado,
      p_id_pedido,
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notificación cliente omitida: %', SQLERRM;
  END;

  RETURN QUERY
  SELECT
    nueva_op_id,
    numero_op_generado,
    CASE
      WHEN v_venta_existente THEN
        'Pedido convertido a OP ' || numero_op_generado || ' · Venta existente ' || v_numero_venta
      ELSE
        'Pedido convertido a OP ' || numero_op_generado || ' · Venta ' || v_numero_venta
    END,
    v_id_venta,
    v_numero_venta;
END;
$$;

COMMENT ON FUNCTION public.convertir_pedido_a_op IS
  'Convierte pedido web en OP con brief, mockup en enlaces, etiquetas, venta e ítems.';

GRANT EXECUTE ON FUNCTION public.convertir_pedido_a_op(integer, integer, varchar, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_pedido_a_op(integer, integer, varchar, text, text) TO anon;
