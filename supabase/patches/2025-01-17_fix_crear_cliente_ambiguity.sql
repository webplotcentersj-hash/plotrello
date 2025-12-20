-- ============================================
-- FIX: Eliminar ambigüedad en función crear_cliente
-- El problema es que hay dos funciones con diferentes tipos para p_password
-- Solución: Eliminar todas las variantes y crear una sola versión correcta
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Eliminar TODAS las variantes de crear_cliente
-- ============================================
DO $$
DECLARE
  func_record record;
  drop_count integer := 0;
BEGIN
  RAISE NOTICE '🔍 Buscando todas las variantes de crear_cliente...';
  
  -- Buscar todas las variantes de la función
  FOR func_record IN
    SELECT 
      p.oid,
      p.proname,
      n.nspname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'crear_cliente'
  LOOP
    -- Eliminar cada variante encontrada
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
        func_record.nspname,
        func_record.proname, 
        func_record.args
      );
      drop_count := drop_count + 1;
      RAISE NOTICE '✅ Función eliminada: %(%)', 
        func_record.proname, 
        func_record.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Error al eliminar función %(%): %', 
        func_record.proname, 
        func_record.args,
        SQLERRM;
    END;
  END LOOP;
  
  IF drop_count = 0 THEN
    RAISE NOTICE 'ℹ️  No se encontraron funciones para eliminar';
  ELSE
    RAISE NOTICE '✅ Total de funciones eliminadas: %', drop_count;
  END IF;
END $$;

-- Esperar un momento para que PostgreSQL procese
SELECT pg_sleep(0.1);

-- ============================================
-- PASO 2: Verificar que no queden funciones
-- ============================================
DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'crear_cliente';
  
  IF remaining_count > 0 THEN
    RAISE WARNING '⚠️ Aún quedan % funciones crear_cliente. Forzando eliminación...', remaining_count;
    -- Último recurso: eliminar por nombre sin parámetros
    EXECUTE 'DROP FUNCTION IF EXISTS public.crear_cliente CASCADE';
  ELSE
    RAISE NOTICE '✅ Todas las funciones crear_cliente fueron eliminadas correctamente';
  END IF;
END $$;

-- Esperar un momento más
SELECT pg_sleep(0.1);

-- ============================================
-- PASO 3: Crear la función CORRECTA con p_password text
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
  -- Validar usuario único (usando alias explícito)
  IF EXISTS (SELECT 1 FROM public.clientes_web c WHERE c.usuario = p_usuario) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', p_usuario;
  END IF;

  -- Validar email único si se proporciona (usando alias explícito)
  IF p_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.clientes_web c WHERE c.email = p_email) THEN
    RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
  END IF;

  -- Validar contraseña
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  -- Hashear contraseña
  password_hash := crypt(p_password, gen_salt('bf'));

  -- Crear cliente usando CTE para evitar ambigüedad
  WITH nuevo_cliente AS (
    INSERT INTO public.clientes_web (
      usuario, password_hash, nombre, apellido, empresa,
      telefono, email, dni_cuit, direccion
    ) VALUES (
      p_usuario, password_hash, p_nombre, p_apellido, p_empresa,
      p_telefono, p_email, p_dni_cuit, p_direccion
    )
    RETURNING public.clientes_web.id AS cliente_id
  )
  SELECT cliente_id INTO nuevo_cliente_id FROM nuevo_cliente;

  RETURN QUERY
  SELECT c.id, c.usuario, c.nombre, c.email
  FROM public.clientes_web c
  WHERE c.id = nuevo_cliente_id;
END;
$$;

-- ============================================
-- PASO 4: Comentario de la función
-- ============================================
COMMENT ON FUNCTION public.crear_cliente IS 'Crea un nuevo cliente web (solo para trabajadores). El parámetro p_password debe ser de tipo text.';

COMMIT;

-- Mensaje final de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Fix completado: función crear_cliente unificada con p_password text';
END $$;

