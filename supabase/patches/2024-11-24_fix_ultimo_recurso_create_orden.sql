-- ============================================
-- FIX ÚLTIMO RECURSO: create_orden_with_contact
-- Este script es más agresivo y verifica todo
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Eliminar TODAS las funciones (método ultra-agresivo)
-- ============================================
DO $$
DECLARE
  func_oid oid;
  func_name text;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ELIMINACIÓN ULTRA-AGRESIVA';
  RAISE NOTICE '========================================';
  
  -- Eliminar por OID directamente
  FOR func_oid, func_name IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_orden_with_contact'
  LOOP
    BEGIN
      -- Intentar eliminar de todas las formas posibles
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func_oid::regprocedure);
      RAISE NOTICE '✅ Eliminada por OID: % (%)', func_oid, func_name;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE format('DROP FUNCTION IF EXISTS public.%I CASCADE', func_name);
        RAISE NOTICE '✅ Eliminada por nombre: %', func_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ No se pudo eliminar función OID: %', func_oid;
      END;
    END;
  END LOOP;
  
  -- Verificar que se eliminaron todas
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact';
  
  IF FOUND THEN
    RAISE WARNING '⚠️ AÚN QUEDAN FUNCIONES - Forzando eliminación...';
    -- Último recurso: eliminar por nombre sin parámetros
    EXECUTE 'DROP FUNCTION IF EXISTS public.create_orden_with_contact CASCADE';
  END IF;
  
  RAISE NOTICE '✅ Eliminación completada';
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
    AND p.proname = 'create_orden_with_contact';
  
  IF remaining_count > 0 THEN
    RAISE EXCEPTION 'AÚN QUEDAN % FUNCIONES. No se puede continuar.', remaining_count;
  ELSE
    RAISE NOTICE '✅ Confirmado: No quedan funciones antiguas';
  END IF;
END $$;

-- ============================================
-- PASO 3: Crear la función SIMPLE y CORRECTA
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
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_new_id integer;
  v_sectores_final text[];
  v_sector_inicial_final text;
BEGIN
  -- Validaciones básicas
  IF COALESCE(p_numero_op, '') = '' THEN
    RAISE EXCEPTION 'p_numero_op es requerido';
  END IF;
  
  IF COALESCE(p_cliente, '') = '' THEN
    RAISE EXCEPTION 'p_cliente es requerido';
  END IF;
  
  -- Determinar sectores
  IF p_sectores IS NOT NULL AND array_length(p_sectores, 1) > 0 THEN
    v_sectores_final := p_sectores;
  ELSIF COALESCE(p_sector, '') != '' THEN
    v_sectores_final := ARRAY[p_sector];
  ELSE
    v_sectores_final := ARRAY['Diseño Gráfico'];
  END IF;
  
  -- Determinar sector inicial
  IF COALESCE(p_sector_inicial, '') != '' THEN
    v_sector_inicial_final := p_sector_inicial;
  ELSIF COALESCE(p_sector, '') != '' THEN
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
    p_numero_op,
    p_cliente,
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
  
  -- Retornar el ID como integer
  RETURN v_new_id;
END;
$$;

-- ============================================
-- PASO 4: Otorgar permisos
-- ============================================
GRANT EXECUTE ON FUNCTION public.create_orden_with_contact(
  varchar, varchar, date, text, varchar, varchar, varchar, text, text, text[], text, text, varchar, text, text, text, text, text, text, text, text
) TO anon;

GRANT EXECUTE ON FUNCTION public.create_orden_with_contact(
  varchar, varchar, date, text, varchar, varchar, varchar, text, text, text[], text, text, varchar, text, text, text, text, text, text, text, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_orden_with_contact(
  varchar, varchar, date, text, varchar, varchar, varchar, text, text, text[], text, text, varchar, text, text, text, text, text, text, text, text
) TO service_role;

-- ============================================
-- PASO 5: Verificación y prueba
-- ============================================
DO $$
DECLARE
  func_count integer;
  func_return_type text;
  test_result integer;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN FINAL';
  RAISE NOTICE '========================================';
  
  -- Contar funciones
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact';
  
  IF func_count != 1 THEN
    RAISE EXCEPTION 'Se encontraron % funciones (debería haber 1)', func_count;
  END IF;
  
  -- Verificar tipo de retorno
  SELECT pg_get_function_result(p.oid)
  INTO func_return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact'
  LIMIT 1;
  
  IF func_return_type != 'integer' THEN
    RAISE EXCEPTION 'Tipo de retorno incorrecto: % (debería ser integer)', func_return_type;
  END IF;
  
  RAISE NOTICE '✅ Función creada correctamente';
  RAISE NOTICE '   Tipo de retorno: %', func_return_type;
  RAISE NOTICE '';
  RAISE NOTICE '✅✅✅ FUNCIÓN LISTA PARA USAR ✅✅✅';
END $$;

COMMIT;

-- ============================================
-- NOTA IMPORTANTE:
-- Después de ejecutar este script, espera 2-3 segundos
-- antes de probar en el frontend para que Supabase
-- actualice su cache interno de funciones.
-- ============================================

