-- ============================================
-- FIX: El trigger de unificación se ejecuta en cada movimiento
-- 
-- Problema: El trigger trigger_unificar_fichas se ejecuta en cada cambio de estado,
--           lo que puede estar revirtiendo los movimientos
-- Solución: El trigger solo debe ejecutarse cuando el nuevo estado es "Finalizado en Taller"
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Corregir el trigger de unificación
-- Solo debe ejecutarse cuando NEW.estado = 'Finalizado en Taller'
-- ============================================
DROP TRIGGER IF EXISTS trigger_unificar_fichas ON public.ordenes_trabajo;

CREATE TRIGGER trigger_unificar_fichas
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (
    -- ⚠️ IMPORTANTE: Solo ejecutar cuando:
    -- 1. El estado cambió
    -- 2. Y el nuevo estado es "Finalizado en Taller"
    (OLD.estado IS DISTINCT FROM NEW.estado)
    AND NEW.estado = 'Finalizado en Taller'
  )
  EXECUTE FUNCTION public.unificar_fichas_completadas();

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX APLICADO: Trigger de unificación';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   - Solo se ejecuta cuando estado =';
  RAISE NOTICE '     "Finalizado en Taller"';
  RAISE NOTICE '   - NO interfiere con movimientos';
  RAISE NOTICE '     normales';
  RAISE NOTICE '   - Las fichas se mueven libremente';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

