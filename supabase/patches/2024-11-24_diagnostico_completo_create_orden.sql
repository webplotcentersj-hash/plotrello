-- ============================================
-- DIAGNÓSTICO COMPLETO DE create_orden_with_contact
-- Ejecuta este script para verificar el estado de la función
-- ============================================

DO $$
DECLARE
  func_count integer;
  func_info record;
  func_return_type text;
  func_params text;
  func_def text;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNÓSTICO: create_orden_with_contact';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- 1. Contar funciones con ese nombre
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact';
  
  RAISE NOTICE '1. FUNCIONES ENCONTRADAS: %', func_count;
  RAISE NOTICE '';
  
  IF func_count = 0 THEN
    RAISE WARNING '❌ NO SE ENCONTRÓ NINGUNA FUNCIÓN create_orden_with_contact';
    RAISE NOTICE '   → Necesitas ejecutar el script: 2024-11-24_fix_completo_crear_orden.sql';
  ELSIF func_count > 1 THEN
    RAISE WARNING '⚠️ SE ENCONTRARON % FUNCIONES (debería haber solo 1)', func_count;
    RAISE NOTICE '   → Hay múltiples variantes, esto puede causar problemas';
  ELSE
    RAISE NOTICE '✅ Se encontró 1 función (correcto)';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '2. DETALLES DE LA(S) FUNCIÓN(ES):';
  RAISE NOTICE '----------------------------------------';
  
  -- 2. Mostrar detalles de cada función
  FOR func_info IN
    SELECT 
      p.oid,
      p.proname,
      n.nspname,
      pg_get_function_identity_arguments(p.oid) AS args,
      pg_get_function_result(p.oid) AS return_type,
      pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_orden_with_contact'
    ORDER BY p.oid
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '   OID: %', func_info.oid;
    RAISE NOTICE '   Nombre: %', func_info.proname;
    RAISE NOTICE '   Schema: %', func_info.nspname;
    RAISE NOTICE '   Parámetros: %', func_info.args;
    RAISE NOTICE '   Tipo de retorno: %', func_info.return_type;
    
    IF func_info.return_type = 'integer' THEN
      RAISE NOTICE '   ✅ Tipo de retorno CORRECTO (integer)';
    ELSE
      RAISE WARNING '   ❌ Tipo de retorno INCORRECTO: % (debería ser integer)', func_info.return_type;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '3. PERMISOS:';
  RAISE NOTICE '----------------------------------------';
  
  -- 3. Verificar permisos
  DO $$
  DECLARE
    has_anon_permission boolean;
    has_auth_permission boolean;
  BEGIN
    -- Verificar permiso para anon
    SELECT has_function_privilege('anon', 'create_orden_with_contact', 'EXECUTE')
    INTO has_anon_permission;
    
    -- Verificar permiso para authenticated
    SELECT has_function_privilege('authenticated', 'create_orden_with_contact', 'EXECUTE')
    INTO has_auth_permission;
    
    IF has_anon_permission THEN
      RAISE NOTICE '   ✅ anon tiene permiso EXECUTE';
    ELSE
      RAISE WARNING '   ❌ anon NO tiene permiso EXECUTE';
    END IF;
    
    IF has_auth_permission THEN
      RAISE NOTICE '   ✅ authenticated tiene permiso EXECUTE';
    ELSE
      RAISE WARNING '   ❌ authenticated NO tiene permiso EXECUTE';
    END IF;
  END $$;
  
  RAISE NOTICE '';
  RAISE NOTICE '4. CONSTRAINT DEL CAMPO SECTOR:';
  RAISE NOTICE '----------------------------------------';
  
  -- 4. Verificar constraint del campo sector
  DO $$
  DECLARE
    constraint_exists boolean;
    constraint_def text;
  BEGIN
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
        AND table_name = 'ordenes_trabajo'
        AND constraint_name = 'ordenes_trabajo_sector_check'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
      RAISE NOTICE '   ✅ Constraint ordenes_trabajo_sector_check existe';
      
      -- Obtener definición del constraint
      SELECT pg_get_constraintdef(c.oid)
      INTO constraint_def
      FROM pg_constraint c
      JOIN pg_namespace n ON c.connamespace = n.oid
      WHERE n.nspname = 'public'
        AND c.conrelid = 'public.ordenes_trabajo'::regclass
        AND c.conname = 'ordenes_trabajo_sector_check';
      
      RAISE NOTICE '   Definición: %', constraint_def;
    ELSE
      RAISE WARNING '   ❌ Constraint ordenes_trabajo_sector_check NO existe';
      RAISE NOTICE '   → Ejecuta: 2024-11-24_fix_sector_check_constraint.sql';
    END IF;
  END $$;
  
  RAISE NOTICE '';
  RAISE NOTICE '5. COLUMNAS DE ordenes_trabajo:';
  RAISE NOTICE '----------------------------------------';
  
  -- 5. Verificar columnas importantes
  DO $$
  DECLARE
    col_record record;
  BEGIN
    FOR col_record IN
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ordenes_trabajo'
        AND column_name IN ('sector', 'sectores', 'sector_inicial')
      ORDER BY column_name
    LOOP
      RAISE NOTICE '   %: % (nullable: %)', 
        col_record.column_name, 
        col_record.data_type,
        col_record.is_nullable;
    END LOOP;
  END $$;
  
  RAISE NOTICE '';
  RAISE NOTICE '6. PRUEBA DE LLAMADA:';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE '   Para probar la función, ejecuta:';
  RAISE NOTICE '';
  RAISE NOTICE '   SELECT create_orden_with_contact(';
  RAISE NOTICE '     ''OP-TEST-001''::varchar,';
  RAISE NOTICE '     ''Cliente Test''::varchar,';
  RAISE NOTICE '     CURRENT_DATE,';
  RAISE NOTICE '     ''Descripción test''::text,';
  RAISE NOTICE '     ''Pendiente''::varchar,';
  RAISE NOTICE '     ''Normal''::varchar,';
  RAISE NOTICE '     NULL::varchar,';
  RAISE NOTICE '     ''Media''::text,';
  RAISE NOTICE '     ''Diseño Gráfico''::text,';
  RAISE NOTICE '     ARRAY[''Diseño Gráfico'', ''Taller de Imprenta'']::text[],';
  RAISE NOTICE '     ''Diseño Gráfico''::text,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::varchar,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::text,';
  RAISE NOTICE '     NULL::text';
  RAISE NOTICE '   );';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIN DEL DIAGNÓSTICO';
  RAISE NOTICE '========================================';
END $$;

