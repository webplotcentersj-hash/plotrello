-- Funciones RPC para el sistema de pedidos web
-- Autenticación de clientes, gestión de pedidos, conversión a OP

BEGIN;

-- ============================================
-- 1. FUNCIÓN PARA AUTENTICAR CLIENTE
-- ============================================
CREATE OR REPLACE FUNCTION public.autenticar_cliente(
  p_usuario varchar(100),
  p_password text
)
RETURNS TABLE (
  id integer,
  usuario varchar,
  nombre varchar,
  apellido varchar,
  empresa varchar,
  email varchar,
  telefono varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cliente_id integer;
  cliente_usuario varchar;
  cliente_nombre varchar;
  cliente_apellido varchar;
  cliente_empresa varchar;
  cliente_email varchar;
  cliente_telefono varchar;
  cliente_password_hash text;
  password_match boolean;
BEGIN
  -- Buscar cliente por usuario con alias explícito
  SELECT 
    c.id,
    c.usuario,
    c.nombre,
    c.apellido,
    c.empresa,
    c.email,
    c.telefono,
    c.password_hash
  INTO 
    cliente_id,
    cliente_usuario,
    cliente_nombre,
    cliente_apellido,
    cliente_empresa,
    cliente_email,
    cliente_telefono,
    cliente_password_hash
  FROM public.clientes_web c
  WHERE c.usuario = p_usuario AND c.activo = true;

  IF cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuario o contraseña incorrectos';
  END IF;

  -- Verificar contraseña
  password_match := (cliente_password_hash = crypt(p_password, cliente_password_hash));

  IF NOT password_match THEN
    RAISE EXCEPTION 'Usuario o contraseña incorrectos';
  END IF;

  -- Retornar datos del cliente
  RETURN QUERY
  SELECT
    cliente_id,
    cliente_usuario,
    cliente_nombre,
    cliente_apellido,
    cliente_empresa,
    cliente_email,
    cliente_telefono;
END;
$$;

-- ============================================
-- 2. FUNCIÓN PARA CREAR CLIENTE (solo trabajadores)
-- ============================================
CREATE OR REPLACE FUNCTION public.crear_cliente(
  p_usuario varchar(100),
  p_password text,
  p_nombre varchar(255),
  p_apellido varchar(255) DEFAULT NULL,
  p_empresa varchar(255) DEFAULT NULL,
  p_telefono varchar(50) DEFAULT NULL,
  p_email varchar(255) DEFAULT NULL,
  p_dni_cuit varchar(50) DEFAULT NULL,
  p_direccion text DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  usuario varchar,
  nombre varchar,
  email varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  password_hash text;
  nuevo_cliente_id integer;
BEGIN
  -- Validar usuario único
  IF EXISTS (SELECT 1 FROM public.clientes_web WHERE usuario = p_usuario) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', p_usuario;
  END IF;

  -- Validar email único si se proporciona
  IF p_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.clientes_web WHERE email = p_email) THEN
    RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
  END IF;

  -- Validar contraseña
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  -- Hashear contraseña
  password_hash := crypt(p_password, gen_salt('bf'));

  -- Crear cliente
  INSERT INTO public.clientes_web (
    usuario, password_hash, nombre, apellido, empresa,
    telefono, email, dni_cuit, direccion
  ) VALUES (
    p_usuario, password_hash, p_nombre, p_apellido, p_empresa,
    p_telefono, p_email, p_dni_cuit, p_direccion
  )
  RETURNING id INTO nuevo_cliente_id;

  RETURN QUERY
  SELECT c.id, c.usuario, c.nombre, c.email
  FROM public.clientes_web c
  WHERE c.id = nuevo_cliente_id;
END;
$$;

-- ============================================
-- 2.1. FUNCIÓN PARA ACTUALIZAR CLIENTE (solo trabajadores)
-- ============================================
CREATE OR REPLACE FUNCTION public.actualizar_cliente(
  p_id integer,
  p_password text DEFAULT NULL,
  p_nombre varchar(255) DEFAULT NULL,
  p_apellido varchar(255) DEFAULT NULL,
  p_empresa varchar(255) DEFAULT NULL,
  p_telefono varchar(50) DEFAULT NULL,
  p_email varchar(255) DEFAULT NULL,
  p_dni_cuit varchar(50) DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_activo boolean DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  usuario varchar,
  nombre varchar,
  apellido varchar,
  empresa varchar,
  email varchar,
  telefono varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cliente_id integer;
  cliente_usuario varchar;
  cliente_nombre varchar;
  cliente_apellido varchar;
  cliente_empresa varchar;
  cliente_email varchar;
  cliente_telefono varchar;
  password_hash text;
BEGIN
  -- Verificar que el cliente existe
  SELECT c.id, c.usuario INTO cliente_id, cliente_usuario
  FROM public.clientes_web c
  WHERE c.id = p_id;

  IF cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- Validar email único si se proporciona y es diferente
  IF p_email IS NOT NULL AND p_email != (SELECT email FROM public.clientes_web WHERE id = p_id) THEN
    IF EXISTS (SELECT 1 FROM public.clientes_web WHERE email = p_email AND id != p_id) THEN
      RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
    END IF;
  END IF;

  -- Hashear contraseña si se proporciona
  IF p_password IS NOT NULL AND length(p_password) > 0 THEN
    IF length(p_password) < 6 THEN
      RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
    END IF;
    password_hash := crypt(p_password, gen_salt('bf'));
  END IF;

  -- Actualizar cliente
  UPDATE public.clientes_web
  SET
    password_hash = COALESCE(password_hash, clientes_web.password_hash),
    nombre = COALESCE(p_nombre, nombre),
    apellido = COALESCE(p_apellido, apellido),
    empresa = COALESCE(p_empresa, empresa),
    telefono = COALESCE(p_telefono, telefono),
    email = COALESCE(p_email, email),
    dni_cuit = COALESCE(p_dni_cuit, dni_cuit),
    direccion = COALESCE(p_direccion, direccion),
    activo = COALESCE(p_activo, activo),
    updated_at = now()
  WHERE id = p_id;

  -- Retornar datos actualizados
  SELECT 
    c.id,
    c.usuario,
    c.nombre,
    c.apellido,
    c.empresa,
    c.email,
    c.telefono
  INTO 
    cliente_id,
    cliente_usuario,
    cliente_nombre,
    cliente_apellido,
    cliente_empresa,
    cliente_email,
    cliente_telefono
  FROM public.clientes_web c
  WHERE c.id = p_id;

  RETURN QUERY
  SELECT
    cliente_id,
    cliente_usuario,
    cliente_nombre,
    cliente_apellido,
    cliente_empresa,
    cliente_email,
    cliente_telefono;
END;
$$;

-- ============================================
-- 3. FUNCIÓN PARA CREAR PEDIDO
-- ============================================
CREATE OR REPLACE FUNCTION public.crear_pedido_cliente(
  p_id_cliente integer,
  p_fecha_limite_deseada date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id integer,
  numero_pedido varchar,
  estado varchar,
  precio_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nuevo_pedido_id integer;
  numero_pedido_generado varchar(50);
  item_record jsonb;
  precio_total_calculado numeric(10,2) := 0;
BEGIN
  -- Validar que el cliente existe y está activo
  IF NOT EXISTS (SELECT 1 FROM public.clientes_web WHERE id = p_id_cliente AND activo = true) THEN
    RAISE EXCEPTION 'Cliente no encontrado o inactivo';
  END IF;

  -- Generar número de pedido
  numero_pedido_generado := public.generar_numero_pedido_cliente();

  -- Crear pedido
  INSERT INTO public.pedidos_clientes (
    id_cliente,
    numero_pedido,
    fecha_limite_deseada,
    observaciones_cliente
  ) VALUES (
    p_id_cliente,
    numero_pedido_generado,
    p_fecha_limite_deseada,
    p_observaciones_cliente
  )
  RETURNING id INTO nuevo_pedido_id;

  -- Procesar items
  FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.pedidos_clientes_items (
      id_pedido,
      id_articulo,
      cantidad,
      precio_unitario,
      precio_total,
      descripcion_personalizada
    ) VALUES (
      nuevo_pedido_id,
      (item_record->>'id_articulo')::integer,
      COALESCE((item_record->>'cantidad')::integer, 1),
      (item_record->>'precio_unitario')::numeric,
      (item_record->>'precio_total')::numeric,
      item_record->>'descripcion_personalizada'
    );

    precio_total_calculado := precio_total_calculado + ((item_record->>'precio_total')::numeric);
  END LOOP;

  -- Actualizar precio total del pedido
  UPDATE public.pedidos_clientes
  SET precio_total = precio_total_calculado
  WHERE id = nuevo_pedido_id;

  RETURN QUERY
  SELECT p.id, p.numero_pedido, p.estado, p.precio_total
  FROM public.pedidos_clientes p
  WHERE p.id = nuevo_pedido_id;
END;
$$;

-- ============================================
-- 4. FUNCIÓN PARA OBTENER PEDIDOS DE UN CLIENTE
-- ============================================
CREATE OR REPLACE FUNCTION public.obtener_pedidos_cliente(
  p_id_cliente integer
)
RETURNS TABLE (
  id integer,
  numero_pedido varchar,
  estado varchar,
  fecha_pedido timestamptz,
  fecha_limite_deseada date,
  precio_total numeric,
  id_op_asociada integer,
  numero_op varchar,
  estado_op varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.numero_pedido,
    p.estado,
    p.fecha_pedido,
    p.fecha_limite_deseada,
    p.precio_total,
    p.id_op_asociada,
    o.numero_op,
    o.estado as estado_op
  FROM public.pedidos_clientes p
  LEFT JOIN public.ordenes_trabajo o ON o.id = p.id_op_asociada
  WHERE p.id_cliente = p_id_cliente
  ORDER BY p.fecha_pedido DESC;
END;
$$;

-- ============================================
-- 5. FUNCIÓN PARA OBTENER DETALLE DE PEDIDO
-- ============================================
CREATE OR REPLACE FUNCTION public.obtener_detalle_pedido_cliente(
  p_id_pedido integer
)
RETURNS TABLE (
  pedido jsonb,
  items jsonb,
  archivos jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pedido_data jsonb;
  items_data jsonb;
  archivos_data jsonb;
BEGIN
  -- Obtener datos del pedido
  SELECT jsonb_build_object(
    'id', p.id,
    'numero_pedido', p.numero_pedido,
    'estado', p.estado,
    'fecha_pedido', p.fecha_pedido,
    'fecha_limite_deseada', p.fecha_limite_deseada,
    'precio_total', p.precio_total,
    'observaciones_cliente', p.observaciones_cliente,
    'observaciones_internas', p.observaciones_internas,
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
  INTO pedido_data
  FROM public.pedidos_clientes p
  JOIN public.clientes_web c ON c.id = p.id_cliente
  WHERE p.id = p_id_pedido;

  -- Obtener items del pedido
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'id_articulo', i.id_articulo,
      'articulo', jsonb_build_object(
        'codigo', a.codigo,
        'nombre', a.nombre,
        'descripcion', a.descripcion
      ),
      'cantidad', i.cantidad,
      'precio_unitario', i.precio_unitario,
      'precio_total', i.precio_total,
      'descripcion_personalizada', i.descripcion_personalizada
    )
  )
  INTO items_data
  FROM public.pedidos_clientes_items i
  JOIN public.articulos_empresa a ON a.id = i.id_articulo
  WHERE i.id_pedido = p_id_pedido;

  -- Obtener archivos del pedido
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'id_item', f.id_item,
      'url', f.url,
      'nombre_archivo', f.nombre_archivo,
      'tipo', f.tipo,
      'tamaño', f.tamaño,
      'uploaded_at', f.uploaded_at
    )
  )
  INTO archivos_data
  FROM public.pedidos_clientes_archivos f
  WHERE f.id_pedido = p_id_pedido;

  RETURN QUERY
  SELECT
    COALESCE(pedido_data, '{}'::jsonb),
    COALESCE(items_data, '[]'::jsonb),
    COALESCE(archivos_data, '[]'::jsonb);
END;
$$;

-- ============================================
-- 6. FUNCIÓN PARA CONVERTIR PEDIDO A OP
-- ============================================
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
  archivo_record RECORD;
  nueva_op_id integer;
  numero_op_generado varchar(255);
  materiales_text text := '';
  descripcion_text text := '';
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

  -- Obtener datos del cliente
  SELECT * INTO cliente_record
  FROM public.clientes_web
  WHERE id = pedido_record.id_cliente;

  -- Generar número de OP
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_op FROM '[0-9]+$') AS integer)), 0) + 1
  INTO nueva_op_id
  FROM public.ordenes_trabajo
  WHERE numero_op LIKE 'OP-%';

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

  IF p_observaciones IS NOT NULL THEN
    descripcion_text := descripcion_text || E'\nObservaciones internas: ' || p_observaciones;
  END IF;

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
    origen_pedido_web,
    observaciones_internas
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
    true,
    COALESCE(pedido_record.observaciones_internas, '') || E'\nConvertido desde pedido web ' || pedido_record.numero_pedido || ' por ' || p_nombre_usuario_convertidor
  )
  RETURNING id INTO nueva_op_id;

  -- Copiar archivos adjuntos a la OP (usando el sistema de archivos existente)
  -- Los archivos se copiarán mediante el frontend usando la API de Storage

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

COMMENT ON FUNCTION public.autenticar_cliente IS 'Autentica un cliente con usuario y contraseña';
COMMENT ON FUNCTION public.crear_cliente IS 'Crea un nuevo cliente (solo para trabajadores)';
COMMENT ON FUNCTION public.crear_pedido_cliente IS 'Crea un nuevo pedido con items';
COMMENT ON FUNCTION public.obtener_pedidos_cliente IS 'Obtiene todos los pedidos de un cliente';
COMMENT ON FUNCTION public.obtener_detalle_pedido_cliente IS 'Obtiene el detalle completo de un pedido';
COMMENT ON FUNCTION public.convertir_pedido_a_op IS 'Convierte un pedido de cliente en una OP';

COMMIT;

