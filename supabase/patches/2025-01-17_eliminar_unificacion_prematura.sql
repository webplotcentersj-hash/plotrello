-- Eliminar triggers que unifican fichas prematuramente
-- Solo debe quedar el trigger que espera a que TODAS las fichas estén en "Finalizado en Taller"
-- NO debe eliminarse ninguna ficha hasta que todas lleguen a "Finalizado en Taller"

BEGIN;

-- ============================================
-- PASO 1: Eliminar trigger que unifica inmediatamente
-- ============================================
DROP TRIGGER IF EXISTS trigger_unificar_fichas_finalizado_taller ON public.ordenes_trabajo;

-- Eliminar función que unifica inmediatamente
DROP FUNCTION IF EXISTS public.unificar_fichas_finalizado_taller();

-- ============================================
-- PASO 2: Eliminar trigger de INSERT que elimina fichas prematuramente
-- ============================================
DROP TRIGGER IF EXISTS trigger_unificar_fichas_insert_finalizado ON public.ordenes_trabajo;

-- Eliminar función de INSERT que elimina fichas prematuramente
DROP FUNCTION IF EXISTS public.unificar_fichas_insert_finalizado_taller();

-- ============================================
-- PASO 3: Verificar que solo queda el trigger correcto
-- ============================================
DO $$
BEGIN
  -- Verificar que el trigger correcto existe
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_unificar_fichas'
    AND tgrelid = 'public.ordenes_trabajo'::regclass
  ) THEN
    RAISE NOTICE '✅ Trigger correcto (trigger_unificar_fichas) existe';
  ELSE
    RAISE WARNING '⚠️ El trigger correcto NO existe';
  END IF;
  
  -- Verificar que los triggers incorrectos fueron eliminados
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname IN ('trigger_unificar_fichas_finalizado_taller', 'trigger_unificar_fichas_insert_finalizado')
    AND tgrelid = 'public.ordenes_trabajo'::regclass
  ) THEN
    RAISE WARNING '⚠️ Aún existen triggers que unifican prematuramente';
  ELSE
    RAISE NOTICE '✅ Triggers que unifican prematuramente fueron eliminados';
  END IF;
END $$;

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TRIGGERS PREMATUROS ELIMINADOS';
  RAISE NOTICE '   - Eliminado: trigger_unificar_fichas_finalizado_taller';
  RAISE NOTICE '   - Eliminado: trigger_unificar_fichas_insert_finalizado';
  RAISE NOTICE '   - Mantenido: trigger_unificar_fichas (espera a que TODAS estén completadas)';
  RAISE NOTICE '   - Las fichas NO se eliminan hasta que TODAS lleguen a "Finalizado en Taller"';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

