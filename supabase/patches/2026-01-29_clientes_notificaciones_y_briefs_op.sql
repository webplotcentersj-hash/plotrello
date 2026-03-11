-- ============================================
-- Notificaciones para clientes cuando su pedido/brief se convierte en OP
-- y soporte para que el portal pueda listar esas notificaciones.
-- ============================================

BEGIN;

-- ============================================
-- 1) Tabla de notificaciones para clientes del portal
-- ============================================

CREATE TABLE IF NOT EXISTS public.clientes_notificaciones (
  id SERIAL PRIMARY KEY,
  id_cliente integer NOT NULL,
  tipo varchar(50) NOT NULL,
  titulo varchar(255),
  mensaje text NOT NULL,
  id_pedido integer,
  id_reclamo integer,
  leida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_notif_cliente_leida
  ON public.clientes_notificaciones(id_cliente, leida);

CREATE INDEX IF NOT EXISTS idx_clientes_notif_created_at
  ON public.clientes_notificaciones(created_at);

COMMENT ON TABLE public.clientes_notificaciones IS 'Notificaciones visibles en el portal de clientes';

-- ============================================
-- 2) Helper: crear_notificacion_cliente
-- ============================================

CREATE OR REPLACE FUNCTION public.crear_notificacion_cliente(
  p_id_cliente integer,
  p_tipo varchar,
  p_titulo varchar,
  p_mensaje text,
  p_id_pedido integer DEFAULT NULL,
  p_id_reclamo integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.clientes_notificaciones (
    id_cliente,
    tipo,
    titulo,
    mensaje,
    id_pedido,
    id_reclamo
  )
  VALUES (
    p_id_cliente,
    p_tipo,
    p_titulo,
    p_mensaje,
    p_id_pedido,
    p_id_reclamo
  );
END;
$$;

COMMENT ON FUNCTION public.crear_notificacion_cliente IS
  'Crea una notificación para el portal de clientes (tabla clientes_notificaciones).';

-- ============================================
-- 3) RPC: listar_notificaciones_cliente
--    (forma esperada por ClienteNotificacionesPage)
-- ============================================

CREATE OR REPLACE FUNCTION public.listar_notificaciones_cliente(
  p_id_cliente integer
)
RETURNS TABLE (
  id integer,
  tipo varchar,
  titulo varchar,
  mensaje text,
  id_pedido integer,
  id_reclamo integer,
  leida boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.tipo,
    n.titulo,
    n.mensaje,
    n.id_pedido,
    n.id_reclamo,
    n.leida,
    n.created_at
  FROM public.clientes_notificaciones n
  WHERE n.id_cliente = p_id_cliente
  ORDER BY n.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.listar_notificaciones_cliente IS
  'Lista notificaciones del portal de clientes (usada por ClienteNotificacionesPage).';

-- ============================================
-- 4) Extender convertir_pedido_a_op para notificar al cliente
--    Basado en la versión fix v2 existente
-- ============================================

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

  -- Obtener datos del cliente (tabla unificada de clientes)
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

  -- Crear la OP
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

  -- Notificación para el cliente del portal
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
    -- No romper la conversión si falla la notificación
    RAISE NOTICE 'Error creando notificación de cliente en convertir_pedido_a_op: %', SQLERRM;
  END;

  RETURN QUERY
  SELECT nueva_op_id, numero_op_generado, 'Pedido convertido exitosamente a OP ' || numero_op_generado;
END;
$$;

COMMENT ON FUNCTION public.convertir_pedido_a_op IS
  'Convierte un pedido de cliente en una OP y genera notificación para el portal de clientes.';

-- ============================================
-- 5) Extender asociar_brief_a_orden para notificar al cliente
--    si podemos vincular el brief con un cliente (por email)
-- ============================================

DROP FUNCTION IF EXISTS public.asociar_brief_a_orden(varchar, integer);

CREATE OR REPLACE FUNCTION public.asociar_brief_a_orden(
  p_token_brief varchar(255),
  p_id_orden integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_brief_id integer;
  v_email text;
  v_cliente_id integer;
  v_numero_op varchar(255);
BEGIN
  -- Obtener el ID y email del brief
  SELECT id, email_cliente
  INTO v_brief_id, v_email
  FROM public.briefs_publicos
  WHERE token = p_token_brief;
  
  IF v_brief_id IS NULL THEN
    RAISE EXCEPTION 'Brief no encontrado';
  END IF;
  
  -- Asociar el brief a la orden
  UPDATE public.briefs_publicos
  SET id_orden_asociada = p_id_orden
  WHERE id = v_brief_id;
  
  -- Copiar datos del brief a la orden
  UPDATE public.ordenes_trabajo ot
  SET
    cliente_nombre_completo = b.cliente_nombre_completo,
    cliente_empresa = b.cliente_empresa,
    telefono_cliente = COALESCE(b.telefono_cliente, ot.telefono_cliente),
    email_cliente = COALESCE(b.email_cliente, ot.email_cliente),
    tipo_producto_servicio = b.tipo_producto_servicio,
    tipo_producto_otro = b.tipo_producto_otro,
    necesita_asesoramiento = b.necesita_asesoramiento,
    donde_colocados = b.donde_colocados,
    digital_o_impresion = b.digital_o_impresion,
    cantidades = b.cantidades,
    objetivo_proyecto = COALESCE(b.objetivo_proyecto, ot.objetivo_proyecto),
    material_logo = b.material_logo,
    material_textos = b.material_textos,
    material_imagenes = b.material_imagenes,
    tiene_referencias = b.tiene_referencias,
    referencias_links = b.referencias_links,
    brief_publico = COALESCE(b.brief_publico, ot.brief_publico),
    estilo_diseno = COALESCE(b.estilo_diseno, ot.estilo_diseno),
    referencias = COALESCE(b.referencias, ot.referencias),
    fecha_limite_brief = b.fecha_limite_brief,
    es_urgencia = b.es_urgencia
  FROM public.briefs_publicos b
  WHERE ot.id = p_id_orden AND b.id = v_brief_id;

  -- Intentar vincular el brief con un cliente del portal por email
  v_cliente_id := NULL;
  IF v_email IS NOT NULL AND length(trim(v_email)) > 0 THEN
    SELECT c.id
    INTO v_cliente_id
    FROM public.clientes c
    WHERE lower(c.email) = lower(trim(v_email))
    ORDER BY c.id DESC
    LIMIT 1;
  END IF;

  -- Obtener número de OP para el mensaje
  SELECT numero_op
  INTO v_numero_op
  FROM public.ordenes_trabajo
  WHERE id = p_id_orden;

  -- Crear notificación para el cliente si lo pudimos identificar
  IF v_cliente_id IS NOT NULL THEN
    BEGIN
      PERFORM public.crear_notificacion_cliente(
        v_cliente_id,
        'op_desde_brief',
        'Tu brief ahora es una OP',
        'Creamos la OP ' || COALESCE(v_numero_op, p_id_orden::text) || ' a partir de tu brief.',
        NULL,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creando notificación de cliente en asociar_brief_a_orden: %', SQLERRM;
    END;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.asociar_brief_a_orden IS
  'Asocia un brief público a una orden, copia datos a la OP y notifica al cliente del portal si se puede identificar por email.';

COMMIT;

