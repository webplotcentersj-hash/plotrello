-- ============================================
-- FIX ULTIMO: Corregir error de tipo de retorno
-- Error: "Returned type character varying(100) does not match expected type text in column 2"
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Eliminar TODAS las funciones (método ultra-agresivo)
-- ============================================
DO $$
DECLARE
  func_oid oid;
  func_signature text;
BEGIN
  RAISE NOTICE 'Eliminando TODAS las variantes de create_orden_with_contact...';
  
  -- Eliminar todas las funciones con este nombre (método 1: por OID)
  FOR func_oid, func_signature IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_orden_with_contact'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS public.create_orden_with_contact(%s) CASCADE', func_signature);
      RAISE NOTICE '✅ Eliminada: create_orden_with_contact(%)', func_signature;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func_oid::regprocedure);
        RAISE NOTICE '✅ Eliminada por OID: %', func_oid;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ No se pudo eliminar: % - %', func_oid, SQLERRM;
      END;
    END;
  END LOOP;
  
  -- Último recurso: eliminar por nombre sin parámetros
  EXECUTE 'DROP FUNCTION IF EXISTS public.create_orden_with_contact CASCADE';
  
  RAISE NOTICE '✅ Eliminación completada';
END $$;

-- ============================================
-- PASO 2: Esperar un momento (sin retornar resultado)
-- ============================================
DO $$
BEGIN
  PERFORM pg_sleep(0.1);
END $$;

-- ============================================
-- PASO 3: Crear la función CORRECTA con tipos explícitos
-- ============================================
CREATE FUNCTION public.create_orden_with_contact(
  p_numero_op varchar,
  p_cliente varchar,
  p_fecha_entrega date,
  p_descripcion text DEFAULT NULL,
  p_estado varchar DEFAULT 'Pendiente',
  p_prioridad varchar DEFAULT 'Normal',
  p_operario_asignado varchar DEFAULT NULL,
  p_complejidad text DEFAULT 'Media',
  p_sector text DEFAULT 'Diseño Gráfico',
  p_sectores text[] DEFAULT NULL,
  p_sector_inicial text DEFAULT NULL,
  p_materiales text DEFAULT NULL,
  p_nombre_creador varchar DEFAULT NULL,
  p_telefono_cliente text DEFAULT NULL,
  p_email_cliente text DEFAULT NULL,
  p_direccion_cliente text DEFAULT NULL,
  p_whatsapp_link text DEFAULT NULL,
  p_ubicacion_link text DEFAULT NULL,
  p_drive_link text DEFAULT NULL,
  p_foto_url text DEFAULT NULL,
  p_dni_cuit text DEFAULT NULL
)
RETURNS integer  -- ⚠️ CRÍTICO: Retorna SOLO integer, NO TABLE
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE  -- ⚠️ CRÍTICO: Debe ser VOLATILE porque hace INSERT
AS $$
DECLARE
  v_new_id integer;
  v_sectores_final text[];
  v_sector_inicial_final text;
  sectores_validos text[] := ARRAY[
    'Diseño Gráfico',
    'Diseño en Proceso',
    'En Espera',
    'Imprenta (Área de Impresión)',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Instalaciones',
    'Metalúrgica',
    'Finalizado en Taller',
    'Almacén de Entrega'
  ];
  sector_item text;
BEGIN
  -- Validaciones básicas
  IF COALESCE(TRIM(p_numero_op), '') = '' THEN
    RAISE EXCEPTION 'p_numero_op es requerido';
  END IF;
  
  IF COALESCE(TRIM(p_cliente), '') = '' THEN
    RAISE EXCEPTION 'p_cliente es requerido';
  END IF;
  
  -- Determinar sectores (deben coincidir EXACTAMENTE con las columnas del Kanban)
  IF p_sectores IS NOT NULL AND array_length(p_sectores, 1) > 0 THEN
    v_sectores_final := p_sectores;
    
    -- Validar que todos los sectores sean válidos
    FOREACH sector_item IN ARRAY v_sectores_final
    LOOP
      IF NOT (sector_item = ANY(sectores_validos)) THEN
        RAISE EXCEPTION 'Sector "%" no es válido. Debe ser uno de: %', 
          sector_item, 
          array_to_string(sectores_validos, ', ');
      END IF;
    END LOOP;
  ELSIF COALESCE(TRIM(p_sector), '') != '' THEN
    -- Validar que el sector único sea válido
    IF NOT (p_sector = ANY(sectores_validos)) THEN
      RAISE EXCEPTION 'Sector "%" no es válido. Debe ser uno de: %', 
        p_sector, 
        array_to_string(sectores_validos, ', ');
    END IF;
    v_sectores_final := ARRAY[p_sector];
  ELSE
    v_sectores_final := ARRAY['Diseño Gráfico'];
  END IF;
  
  -- Determinar sector inicial
  IF COALESCE(TRIM(p_sector_inicial), '') != '' THEN
    -- Validar que sector_inicial sea válido
    IF NOT (p_sector_inicial = ANY(sectores_validos)) THEN
      RAISE EXCEPTION 'Sector inicial "%" no es válido. Debe ser uno de: %', 
        p_sector_inicial, 
        array_to_string(sectores_validos, ', ');
    END IF;
    v_sector_inicial_final := p_sector_inicial;
  ELSIF COALESCE(TRIM(p_sector), '') != '' THEN
    v_sector_inicial_final := p_sector;
  ELSE
    v_sector_inicial_final := 'Diseño Gráfico';
  END IF;
  
  -- Insertar la orden
  INSERT INTO public.ordenes_trabajo (
    numero_op,
    cliente,
    descripcion,
    estado,
    prioridad,
    fecha_entrega,
    operario_asignado,
    complejidad,
    sector,
    sectores,
    sector_inicial,
    materiales,
    nombre_creador,
    telefono_cliente,
    email_cliente,
    direccion_cliente,
    whatsapp_link,
    ubicacion_link,
    drive_link,
    foto_url,
    dni_cuit,
    fecha_creacion,
    fecha_ingreso
  ) VALUES (
    TRIM(p_numero_op),
    TRIM(p_cliente),
    p_descripcion,
    p_estado,
    p_prioridad,
    p_fecha_entrega,
    p_operario_asignado,
    p_complejidad,
    v_sector_inicial_final,
    v_sectores_final,
    v_sector_inicial_final,
    p_materiales,
    p_nombre_creador,
    p_telefono_cliente,
    p_email_cliente,
    p_direccion_cliente,
    p_whatsapp_link,
    p_ubicacion_link,
    p_drive_link,
    p_foto_url,
    p_dni_cuit,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_id;
  
  -- ⚠️ CRÍTICO: Retornar SOLO el ID como integer (sin conversiones, sin SELECT)
  RETURN v_new_id;
END;
$$;

-- ============================================
-- PASO 4: Otorgar permisos explícitos
-- ============================================
GRANT EXECUTE ON FUNCTION public.create_orden_with_contact(
  varchar, varchar, date, text, varchar, varchar, varchar, text, text, text[], text, text, varchar, text, text, text, text, text, text, text, text
) TO anon, authenticated, service_role;

-- ============================================
-- PASO 5: Verificación final
-- ============================================
DO $$
DECLARE
  func_count integer;
  func_return_type text;
  func_volatility text;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact';
  
  IF func_count != 1 THEN
    RAISE EXCEPTION 'Se encontraron % funciones (debería haber 1)', func_count;
  END IF;
  
  SELECT 
    pg_get_function_result(p.oid),
    CASE p.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      WHEN 'v' THEN 'VOLATILE'
    END
  INTO func_return_type, func_volatility
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact'
  LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FUNCIÓN VERIFICADA';
  RAISE NOTICE '   Tipo de retorno: %', func_return_type;
  RAISE NOTICE '   Volatilidad: %', func_volatility;
  RAISE NOTICE '========================================';
  
  IF func_return_type != 'integer' THEN
    RAISE EXCEPTION '❌ Tipo de retorno incorrecto: % (debería ser integer)', func_return_type;
  END IF;
  
  IF func_volatility != 'VOLATILE' THEN
    RAISE EXCEPTION '❌ Volatilidad incorrecta: % (debería ser VOLATILE)', func_volatility;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅✅✅ FUNCIÓN LISTA PARA USAR ✅✅✅';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- NOTA IMPORTANTE:
-- 1. Después de ejecutar este script, espera 5-10 segundos
--    antes de probar en el frontend para que Supabase
--    actualice su cache interno de funciones RPC.
-- 2. Si el error persiste, verifica que no haya otras
--    funciones con el mismo nombre en otros schemas.
-- 3. El frontend debe esperar recibir un integer, NO una tabla.
-- ============================================

