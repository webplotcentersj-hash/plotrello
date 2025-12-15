-- Este archivo debe ejecutarse en la BASE DE DATOS DE STOCK separada
-- (la que usa VITE_STOCK_SUPABASE_URL)
-- 
-- IMPORTANTE: Si la base de stock está en el mismo proyecto de Supabase,
-- ejecuta este script en el SQL Editor de Supabase apuntando a esa base.
-- Si está en un proyecto diferente, ejecuta este script en ese proyecto.

BEGIN;

-- ============================================
-- PASO 1: Verificar que existe la tabla articulos
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'articulos'
  ) THEN
    RAISE EXCEPTION 'La tabla articulos no existe. Debes crearla primero.';
  END IF;
  
  RAISE NOTICE '✅ Tabla articulos encontrada';
END $$;

-- ============================================
-- PASO 2: Otorgar permisos GRANT explícitos
-- ============================================

-- Permisos para articulos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articulos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articulos TO authenticated;

-- Si la tabla tiene secuencia de ID, otorgar permisos también
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'articulos_id_seq'
  ) THEN
    GRANT USAGE, SELECT ON SEQUENCE public.articulos_id_seq TO anon;
    GRANT USAGE, SELECT ON SEQUENCE public.articulos_id_seq TO authenticated;
    RAISE NOTICE '✅ Permisos de secuencia otorgados';
  END IF;
END $$;

-- ============================================
-- PASO 3: Verificar y crear políticas RLS si están habilitadas
-- ============================================
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  -- Verificar si RLS está habilitado en articulos
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'articulos';
  
  IF rls_enabled THEN
    RAISE NOTICE '⚠️ RLS está habilitado - creando políticas permisivas';
    
    -- Eliminar políticas existentes si las hay
    DROP POLICY IF EXISTS "Allow anon all articulos" ON public.articulos;
    DROP POLICY IF EXISTS "Allow authenticated all articulos" ON public.articulos;
    
    -- Crear políticas permisivas
    CREATE POLICY "Allow anon all articulos" ON public.articulos
      FOR ALL TO anon USING (true) WITH CHECK (true);
    
    CREATE POLICY "Allow authenticated all articulos" ON public.articulos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    RAISE NOTICE '✅ Políticas RLS creadas para articulos';
  ELSE
    RAISE NOTICE '✅ RLS NO está habilitado - los permisos GRANT son suficientes';
  END IF;
END $$;

-- ============================================
-- PASO 4: Verificar permisos otorgados
-- ============================================
DO $$
DECLARE
  has_insert_anon boolean;
  has_insert_auth boolean;
  has_select_anon boolean;
  has_select_auth boolean;
BEGIN
  -- Verificar permisos para anon
  SELECT has_table_privilege('anon', 'public.articulos', 'INSERT') INTO has_insert_anon;
  SELECT has_table_privilege('anon', 'public.articulos', 'SELECT') INTO has_select_anon;
  
  -- Verificar permisos para authenticated
  SELECT has_table_privilege('authenticated', 'public.articulos', 'INSERT') INTO has_insert_auth;
  SELECT has_table_privilege('authenticated', 'public.articulos', 'SELECT') INTO has_select_auth;
  
  IF has_insert_anon AND has_select_anon THEN
    RAISE NOTICE '✅ Permisos INSERT y SELECT otorgados a anon';
  ELSE
    RAISE WARNING '⚠️ Algunos permisos NO fueron otorgados a anon';
  END IF;
  
  IF has_insert_auth AND has_select_auth THEN
    RAISE NOTICE '✅ Permisos INSERT y SELECT otorgados a authenticated';
  ELSE
    RAISE WARNING '⚠️ Algunos permisos NO fueron otorgados a authenticated';
  END IF;
END $$;

COMMIT;

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Este script debe ejecutarse en la BASE DE DATOS DE STOCK.
-- Si tu base de stock está en un proyecto Supabase diferente,
-- ve a ese proyecto y ejecuta este script en su SQL Editor.
--
-- Para verificar que funcionó:
-- 1. Intenta crear un artículo desde la app
-- 2. Si ves errores de permisos, verifica que ejecutaste este script
--    en la base de datos correcta

