-- ============================================
-- UNIFICACIÓN DE TABLAS DE CLIENTES
-- Este script unifica las tablas clientes y clientes_web en una sola tabla clientes
-- Todos los clientes (del tablero, web, DT) estarán en la misma tabla
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Asegurar que la tabla clientes tenga todos los campos necesarios
-- ============================================

-- Agregar campos que puedan faltar en clientes
DO $$
BEGIN
  -- Agregar usuario si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'clientes' 
      AND column_name = 'usuario'
  ) THEN
    ALTER TABLE public.clientes ADD COLUMN usuario varchar(100);
    CREATE INDEX IF NOT EXISTS idx_clientes_usuario ON public.clientes(usuario);
  END IF;

  -- Agregar password_hash si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'clientes' 
      AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.clientes ADD COLUMN password_hash varchar(255);
  END IF;

  -- Agregar activo si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'clientes' 
      AND column_name = 'activo'
  ) THEN
    ALTER TABLE public.clientes ADD COLUMN activo boolean DEFAULT true;
    CREATE INDEX IF NOT EXISTS idx_clientes_activo ON public.clientes(activo);
  END IF;

  -- Agregar es_cliente_web si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'clientes' 
      AND column_name = 'es_cliente_web'
  ) THEN
    ALTER TABLE public.clientes ADD COLUMN es_cliente_web boolean DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_clientes_es_web ON public.clientes(es_cliente_web);
  END IF;

  -- Asegurar que nombre sea NOT NULL
  ALTER TABLE public.clientes ALTER COLUMN nombre SET NOT NULL;

  RAISE NOTICE '✅ Campos de la tabla clientes verificados';
END $$;

-- ============================================
-- PASO 2: Migrar datos de clientes_web a clientes
-- ============================================

DO $$
DECLARE
  cliente_web_record record;
  cliente_existente_id integer;
  clientes_migrados integer := 0;
  clientes_actualizados integer := 0;
BEGIN
  RAISE NOTICE '🔄 Iniciando migración de clientes_web a clientes...';

  FOR cliente_web_record IN 
    SELECT * FROM public.clientes_web
  LOOP
    -- Buscar si ya existe un cliente con el mismo email o usuario
    SELECT id INTO cliente_existente_id
    FROM public.clientes
    WHERE (email = cliente_web_record.email AND cliente_web_record.email IS NOT NULL)
       OR (usuario = cliente_web_record.usuario AND cliente_web_record.usuario IS NOT NULL)
    LIMIT 1;

    IF cliente_existente_id IS NOT NULL THEN
      -- Actualizar cliente existente con datos de clientes_web
      UPDATE public.clientes
      SET
        usuario = COALESCE(cliente_web_record.usuario, clientes.usuario),
        password_hash = COALESCE(cliente_web_record.password_hash, clientes.password_hash),
        nombre = COALESCE(cliente_web_record.nombre, clientes.nombre),
        apellido = COALESCE(cliente_web_record.apellido, clientes.apellido),
        empresa = COALESCE(cliente_web_record.empresa, clientes.empresa),
        telefono = COALESCE(cliente_web_record.telefono, clientes.telefono),
        email = COALESCE(cliente_web_record.email, clientes.email),
        dni_cuit = COALESCE(cliente_web_record.dni_cuit, clientes.dni_cuit),
        direccion = COALESCE(cliente_web_record.direccion, clientes.direccion),
        activo = COALESCE(cliente_web_record.activo, clientes.activo, true),
        es_cliente_web = true,
        updated_at = now()
      WHERE id = cliente_existente_id;
      
      clientes_actualizados := clientes_actualizados + 1;
      RAISE NOTICE '✅ Cliente actualizado: % (ID: %)', cliente_web_record.nombre, cliente_existente_id;
    ELSE
      -- Insertar nuevo cliente
      INSERT INTO public.clientes (
        usuario, password_hash, nombre, apellido, empresa,
        telefono, email, dni_cuit, direccion, activo, es_cliente_web,
        created_at, updated_at
      ) VALUES (
        cliente_web_record.usuario,
        cliente_web_record.password_hash,
        cliente_web_record.nombre,
        cliente_web_record.apellido,
        cliente_web_record.empresa,
        cliente_web_record.telefono,
        cliente_web_record.email,
        cliente_web_record.dni_cuit,
        cliente_web_record.direccion,
        COALESCE(cliente_web_record.activo, true),
        true,
        COALESCE(cliente_web_record.created_at, now()),
        COALESCE(cliente_web_record.updated_at, now())
      );
      
      clientes_migrados := clientes_migrados + 1;
      RAISE NOTICE '✅ Cliente migrado: %', cliente_web_record.nombre;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Migración completada: % migrados, % actualizados', clientes_migrados, clientes_actualizados;
END $$;

-- ============================================
-- PASO 3: Actualizar función crear_cliente para usar tabla clientes
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
  -- Validar usuario único (si se proporciona)
  IF p_usuario IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.usuario = p_usuario
  ) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', p_usuario;
  END IF;

  -- Validar email único si se proporciona
  IF p_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.email = p_email
  ) THEN
    RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
  END IF;

  -- Validar contraseña
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  -- Hashear contraseña
  password_hash := crypt(p_password, gen_salt('bf'));

  -- Crear cliente en tabla unificada
  WITH nuevo_cliente AS (
    INSERT INTO public.clientes (
      usuario, password_hash, nombre, apellido, empresa,
      telefono, email, dni_cuit, direccion, es_cliente_web, activo
    ) VALUES (
      p_usuario, password_hash, p_nombre, p_apellido, p_empresa,
      p_telefono, p_email, p_dni_cuit, p_direccion, true, true
    )
    RETURNING public.clientes.id AS cliente_id
  )
  SELECT cliente_id INTO nuevo_cliente_id FROM nuevo_cliente;

  RETURN QUERY
  SELECT c.id, c.usuario, c.nombre, c.email
  FROM public.clientes c
  WHERE c.id = nuevo_cliente_id;
END;
$$;

-- ============================================
-- PASO 4: Actualizar función autenticar_cliente para usar tabla clientes
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
  -- Buscar cliente por usuario con es_cliente_web = true y activo = true
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
  FROM public.clientes c
  WHERE c.usuario = p_usuario 
    AND c.es_cliente_web = true 
    AND c.activo = true;

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
-- PASO 5: Actualizar función actualizar_cliente para usar tabla clientes
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
  -- Verificar que el cliente existe y es cliente web
  SELECT c.id, c.usuario INTO cliente_id, cliente_usuario
  FROM public.clientes c
  WHERE c.id = p_id AND c.es_cliente_web = true;

  IF cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente web no encontrado';
  END IF;

  -- Validar email único si se proporciona y es diferente
  IF p_email IS NOT NULL AND p_email != (SELECT c2.email FROM public.clientes c2 WHERE c2.id = p_id) THEN
    IF EXISTS (SELECT 1 FROM public.clientes c3 WHERE c3.email = p_email AND c3.id != p_id) THEN
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
  UPDATE public.clientes
  SET
    password_hash = CASE 
      WHEN password_hash IS NOT NULL THEN password_hash 
      ELSE clientes.password_hash 
    END,
    nombre = COALESCE(p_nombre, clientes.nombre),
    apellido = COALESCE(p_apellido, clientes.apellido),
    empresa = COALESCE(p_empresa, clientes.empresa),
    telefono = COALESCE(p_telefono, clientes.telefono),
    email = COALESCE(p_email, clientes.email),
    dni_cuit = COALESCE(p_dni_cuit, clientes.dni_cuit),
    direccion = COALESCE(p_direccion, clientes.direccion),
    activo = COALESCE(p_activo, clientes.activo),
    updated_at = now()
  WHERE clientes.id = p_id;

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
  FROM public.clientes c
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
-- PASO 6: Actualizar función buscar_o_crear_cliente para marcar es_cliente_web cuando corresponda
-- ============================================

-- Primero verificar si existe la función buscar_o_crear_cliente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'buscar_o_crear_cliente'
  ) THEN
    RAISE NOTICE 'ℹ️  Función buscar_o_crear_cliente existe, se mantendrá sin cambios';
  ELSE
    RAISE NOTICE 'ℹ️  Función buscar_o_crear_cliente no existe';
  END IF;
END $$;

-- ============================================
-- PASO 7: Actualizar funciones de pedidos que referencian clientes_web
-- ============================================

-- Actualizar función crear_pedido_cliente
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
  -- Validar que el cliente existe, es cliente web y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE id = p_id_cliente 
      AND es_cliente_web = true 
      AND activo = true
  ) THEN
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

  -- Procesar items (mantener lógica existente)
  FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.pedidos_clientes_items (
      id_pedido,
      id_articulo,
      cantidad,
      precio_unitario,
      observaciones
    ) VALUES (
      nuevo_pedido_id,
      (item_record->>'id_articulo')::integer,
      (item_record->>'cantidad')::integer,
      (item_record->>'precio_unitario')::numeric,
      item_record->>'observaciones'
    );
    
    precio_total_calculado := precio_total_calculado + 
      ((item_record->>'cantidad')::integer * (item_record->>'precio_unitario')::numeric);
  END LOOP;

  -- Actualizar precio total
  UPDATE public.pedidos_clientes
  SET precio_total = precio_total_calculado
  WHERE id = nuevo_pedido_id;

  -- Retornar pedido creado
  RETURN QUERY
  SELECT p.id, p.numero_pedido, p.estado, p.precio_total
  FROM public.pedidos_clientes p
  WHERE p.id = nuevo_pedido_id;
END;
$$;

-- Actualizar otras funciones que referencien clientes_web
-- (Se actualizarán según sea necesario cuando se ejecuten)

COMMIT;

-- Mensaje final de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Unificación de tablas clientes completada';
  RAISE NOTICE '⚠️  IMPORTANTE: Revisar y actualizar manualmente las referencias de pedidos_clientes si existen';
END $$;

