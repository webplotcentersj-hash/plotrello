-- ============================================
-- VERIFICACIÓN RÁPIDA: create_orden_with_contact
-- Ejecuta este script para verificar que la función existe y está correcta
-- ============================================

DO $$
DECLARE
  func_count integer;
  func_return_type text;
  func_params text;
  has_anon_permission boolean;
  has_auth_permission boolean;
  func_oid oid;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE create_orden_with_contact';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- 1. Contar funciones
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact';
  
  RAISE NOTICE '1. FUNCIONES ENCONTRADAS: %', func_count;
  
  IF func_count = 0 THEN
    RAISE WARNING '❌ NO SE ENCONTRÓ LA FUNCIÓN';
    RAISE NOTICE '   → Necesitas ejecutar: 2024-11-24_fix_ultimo_recurso_create_orden.sql';
    RETURN;
  ELSIF func_count > 1 THEN
    RAISE WARNING '⚠️ SE ENCONTRARON % FUNCIONES (debería haber 1)', func_count;
  ELSE
    RAISE NOTICE '✅ Se encontró 1 función (correcto)';
  END IF;
  
  RAISE NOTICE '';
  
  -- 2. Verificar tipo de retorno
  SELECT 
    pg_get_function_result(p.oid),
    pg_get_function_identity_arguments(p.oid)
  INTO func_return_type, func_params
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact'
  LIMIT 1;
  
  RAISE NOTICE '2. TIPO DE RETORNO: %', func_return_type;
  IF func_return_type = 'integer' THEN
    RAISE NOTICE '   ✅ CORRECTO (debe ser integer)';
  ELSE
    RAISE WARNING '   ❌ INCORRECTO (debería ser integer, pero es %)', func_return_type;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '3. PARÁMETROS: %', func_params;
  RAISE NOTICE '';
  
  -- 3. Verificar permisos (usando OID en lugar del nombre)
  -- Obtener el OID de la función
  SELECT p.oid INTO func_oid
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact'
  LIMIT 1;
  
  IF func_oid IS NULL THEN
    RAISE WARNING 'No se pudo obtener el OID de la función';
    has_anon_permission := false;
    has_auth_permission := false;
  ELSE
    -- Verificar permisos usando el OID
    SELECT has_function_privilege('anon', func_oid, 'EXECUTE')
    INTO has_anon_permission;
    
    SELECT has_function_privilege('authenticated', func_oid, 'EXECUTE')
    INTO has_auth_permission;
  END IF;
  
  RAISE NOTICE '4. PERMISOS:';
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
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  
  IF func_count = 1 AND func_return_type = 'integer' AND has_anon_permission AND has_auth_permission THEN
    RAISE NOTICE '✅✅✅ TODO ESTÁ CORRECTO ✅✅✅';
    RAISE NOTICE 'La función debería funcionar correctamente.';
  ELSE
    RAISE WARNING '⚠️ HAY PROBLEMAS QUE DEBEN CORREGIRSE';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

