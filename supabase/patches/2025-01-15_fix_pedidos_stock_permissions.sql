-- Otorgar permisos y políticas RLS para tablas de pedidos de compra y stock
-- Este script asegura que los usuarios puedan crear y gestionar pedidos

BEGIN;

-- ============================================
-- PASO 1: Otorgar permisos GRANT explícitos
-- ============================================

-- Permisos para pedidos_compras
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compras TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compras TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_compras_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_compras_id_seq TO authenticated;

-- Permisos para pedidos_compras_items
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compras_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compras_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_compras_items_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_compras_items_id_seq TO authenticated;

-- Permisos para pedidos_compras_comentarios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compras_comentarios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compras_comentarios TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_compras_comentarios_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_compras_comentarios_id_seq TO authenticated;

-- Permisos para stock_movimientos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movimientos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movimientos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.stock_movimientos_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.stock_movimientos_id_seq TO authenticated;

-- ============================================
-- PASO 2: Verificar y crear políticas RLS si están habilitadas
-- ============================================
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  -- Verificar si RLS está habilitado en pedidos_compras
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'pedidos_compras';
  
  IF rls_enabled THEN
    RAISE NOTICE '⚠️ RLS está habilitado - creando políticas permisivas';
    
    -- Políticas para pedidos_compras
    DROP POLICY IF EXISTS "Allow anon all pedidos_compras" ON public.pedidos_compras;
    DROP POLICY IF EXISTS "Allow authenticated all pedidos_compras" ON public.pedidos_compras;
    
    CREATE POLICY "Allow anon all pedidos_compras" ON public.pedidos_compras
      FOR ALL TO anon USING (true) WITH CHECK (true);
    
    CREATE POLICY "Allow authenticated all pedidos_compras" ON public.pedidos_compras
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    -- Políticas para pedidos_compras_items
    DROP POLICY IF EXISTS "Allow anon all pedidos_compras_items" ON public.pedidos_compras_items;
    DROP POLICY IF EXISTS "Allow authenticated all pedidos_compras_items" ON public.pedidos_compras_items;
    
    CREATE POLICY "Allow anon all pedidos_compras_items" ON public.pedidos_compras_items
      FOR ALL TO anon USING (true) WITH CHECK (true);
    
    CREATE POLICY "Allow authenticated all pedidos_compras_items" ON public.pedidos_compras_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    -- Políticas para pedidos_compras_comentarios
    DROP POLICY IF EXISTS "Allow anon all pedidos_compras_comentarios" ON public.pedidos_compras_comentarios;
    DROP POLICY IF EXISTS "Allow authenticated all pedidos_compras_comentarios" ON public.pedidos_compras_comentarios;
    
    CREATE POLICY "Allow anon all pedidos_compras_comentarios" ON public.pedidos_compras_comentarios
      FOR ALL TO anon USING (true) WITH CHECK (true);
    
    CREATE POLICY "Allow authenticated all pedidos_compras_comentarios" ON public.pedidos_compras_comentarios
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    -- Políticas para stock_movimientos
    DROP POLICY IF EXISTS "Allow anon all stock_movimientos" ON public.stock_movimientos;
    DROP POLICY IF EXISTS "Allow authenticated all stock_movimientos" ON public.stock_movimientos;
    
    CREATE POLICY "Allow anon all stock_movimientos" ON public.stock_movimientos
      FOR ALL TO anon USING (true) WITH CHECK (true);
    
    CREATE POLICY "Allow authenticated all stock_movimientos" ON public.stock_movimientos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    RAISE NOTICE '✅ Políticas RLS creadas';
  ELSE
    RAISE NOTICE '✅ RLS NO está habilitado - los permisos GRANT son suficientes';
  END IF;
END $$;

-- ============================================
-- PASO 3: Verificar permisos otorgados
-- ============================================
DO $$
DECLARE
  has_insert_anon boolean;
  has_insert_auth boolean;
BEGIN
  -- Verificar permisos para anon
  SELECT has_table_privilege('anon', 'public.pedidos_compras', 'INSERT') INTO has_insert_anon;
  SELECT has_table_privilege('authenticated', 'public.pedidos_compras', 'INSERT') INTO has_insert_auth;
  
  IF has_insert_anon THEN
    RAISE NOTICE '✅ Permisos INSERT otorgados a anon';
  ELSE
    RAISE WARNING '⚠️ Permisos INSERT NO otorgados a anon';
  END IF;
  
  IF has_insert_auth THEN
    RAISE NOTICE '✅ Permisos INSERT otorgados a authenticated';
  ELSE
    RAISE WARNING '⚠️ Permisos INSERT NO otorgados a authenticated';
  END IF;
END $$;

COMMIT;

-- Nota: Si usas una base de datos de stock separada (stockSupabase),
-- necesitarás ejecutar permisos similares en esa base de datos también.
-- Las tablas de stock (articulos) están en la base de stock separada,
-- no en la base principal de Supabase.

