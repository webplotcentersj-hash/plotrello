-- ============================================
-- Fix v2: Corregir función convertir_pedido_a_op
-- Problema: La columna observaciones_internas no existe en ordenes_trabajo
-- Solución: Incluir observaciones en el campo descripcion
-- ============================================

BEGIN;

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
  mensaje text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pedido_record RECORD;
  cliente_record RECORD;
  item_record RECORD;
  nueva_op_id integer;
  numero_op_generado varchar(255);
  materiales_text text := '';
  descripcion_text text := '';
  max_numero_op integer;
BEGIN
  -- Obtener datos del pedido
  SELECT * INTO pedido_record
  FROM public.pedidos_clientes
  WHERE id = p_id_pedido;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF pedido_record.estado = 'convertido_completo' THEN
    RAISE EXCEPTION 'Este pedido ya fue convertido completamente';
  END IF;

  -- Obtener datos del cliente (usando tabla unificada)
  SELECT * INTO cliente_record
  FROM public.clientes
  WHERE id = pedido_record.id_cliente;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- Generar número de OP (corregido: usar nombre completo de tabla)
  SELECT COALESCE(MAX(CAST(SUBSTRING(ot.numero_op FROM '[0-9]+$') AS integer)), 0) + 1
  INTO max_numero_op
  FROM public.ordenes_trabajo ot
  WHERE ot.numero_op LIKE 'OP-%';

  nueva_op_id := max_numero_op;
  numero_op_generado := 'OP-' || LPAD(nueva_op_id::text, 6, '0');

  -- Construir descripción con items del pedido
  descripcion_text := COALESCE(pedido_record.observaciones_cliente, '') || E'\n\n';
  descripcion_text := descripcion_text || 'Pedido Web: ' || pedido_record.numero_pedido || E'\n';
  descripcion_text := descripcion_text || 'Items solicitados:' || E'\n';

  FOR item_record IN
    SELECT i.*, a.nombre as nombre_articulo, a.codigo as codigo_articulo
    FROM public.pedidos_clientes_items i
    JOIN public.articulos_empresa a ON a.id = i.id_articulo
    WHERE i.id_pedido = p_id_pedido
  LOOP
    materiales_text := materiales_text || 
      '- ' || item_record.nombre_articulo || 
      ' (Cantidad: ' || item_record.cantidad || 
      ', Precio: $' || item_record.precio_total || ')' || E'\n';
    
    IF item_record.descripcion_personalizada IS NOT NULL THEN
      materiales_text := materiales_text || '  Descripción: ' || item_record.descripcion_personalizada || E'\n';
    END IF;
  END LOOP;

  descripcion_text := descripcion_text || materiales_text;

  -- Agregar observaciones internas del pedido si existen
  IF pedido_record.observaciones_internas IS NOT NULL AND pedido_record.observaciones_internas != '' THEN
    descripcion_text := descripcion_text || E'\n\nObservaciones internas del pedido:' || E'\n' || pedido_record.observaciones_internas;
  END IF;

  -- Agregar observaciones adicionales del usuario convertidor
  IF p_observaciones IS NOT NULL AND p_observaciones != '' THEN
    descripcion_text := descripcion_text || E'\n\nObservaciones adicionales (al convertir):' || E'\n' || p_observaciones;
  END IF;

  -- Agregar información de conversión
  descripcion_text := descripcion_text || E'\n\n---' || E'\n';
  descripcion_text := descripcion_text || 'Convertido desde pedido web ' || pedido_record.numero_pedido || ' por ' || p_nombre_usuario_convertidor || ' el ' || CURRENT_TIMESTAMP::text;

  -- Crear la OP (sin observaciones_internas que no existe)
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
    origen_pedido_web
  ) VALUES (
    numero_op_generado,
    COALESCE(cliente_record.empresa, cliente_record.nombre || ' ' || COALESCE(cliente_record.apellido, '')),
    cliente_record.dni_cuit,
    descripcion_text,
    'Diseño Gráfico',
    'Normal',
    COALESCE(pedido_record.fecha_limite_deseada, CURRENT_DATE + INTERVAL '7 days'),
    p_sector_inicial,
    p_sector_inicial,
    materiales_text,
    p_nombre_usuario_convertidor,
    cliente_record.telefono,
    cliente_record.email,
    cliente_record.direccion,
    p_id_pedido,
    true
  )
  RETURNING id INTO nueva_op_id;

  -- Actualizar pedido
  UPDATE public.pedidos_clientes
  SET 
    id_op_asociada = nueva_op_id,
    estado = 'convertido_completo',
    observaciones_internas = COALESCE(observaciones_internas, '') || E'\nConvertido a OP ' || numero_op_generado || ' el ' || CURRENT_TIMESTAMP::text
  WHERE id = p_id_pedido;

  RETURN QUERY
  SELECT nueva_op_id, numero_op_generado, 'Pedido convertido exitosamente a OP ' || numero_op_generado;
END;
$$;

COMMENT ON FUNCTION public.convertir_pedido_a_op IS 'Convierte un pedido de cliente en una OP (corregido: observaciones en descripcion, sin observaciones_internas)';

COMMIT;

