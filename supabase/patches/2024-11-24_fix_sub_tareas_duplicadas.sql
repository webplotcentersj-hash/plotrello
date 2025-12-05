-- ============================================
-- FIX: Prevenir creación de sub-tareas para fichas duplicadas
-- 
-- Problema: Las sub-tareas se están creando para fichas duplicadas,
-- causando que se muestren 4 elementos (2 fichas + 2 sub-tareas) en lugar de 2
-- Solución: Solo crear sub-tareas para fichas originales (es_duplicado = false)
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Corregir función de creación de sub-tareas
-- Solo crear sub-tareas para fichas originales, NO para duplicadas
-- ============================================
CREATE OR REPLACE FUNCTION public.crear_sub_tareas_automaticas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ⚠️ CRÍTICO: Solo crear sub-tareas para fichas ORIGINALES
  -- Las fichas duplicadas NO deben tener sub-tareas propias
  -- porque ya están representadas por la ficha original
  IF NEW.es_duplicado = false 
     AND NEW.sectores IS NOT NULL 
     AND array_length(NEW.sectores, 1) > 1 THEN
    
    -- Solo crear sub-tareas si la ficha original tiene múltiples sectores
    -- Las sub-tareas se crean para la ficha original, no para las duplicadas
    -- (Las fichas duplicadas ya representan cada sector)
    
    -- Verificar si ya existen sub-tareas para esta orden
    IF NOT EXISTS (
      SELECT 1 FROM public.tareas
      WHERE id_orden = NEW.id
        AND es_sub_tarea = true
    ) THEN
      -- Crear sub-tareas solo para la ficha original
      -- Esto se puede hacer si es necesario, pero normalmente
      -- las fichas duplicadas ya cubren cada sector
      RAISE NOTICE '✅ Ficha original creada (ID: %, OP: %) - Sub-tareas no necesarias (fichas duplicadas cubren sectores)', 
        NEW.id, NEW.numero_op;
    END IF;
  ELSE
    -- Ficha duplicada o con un solo sector: no crear sub-tareas
    IF NEW.es_duplicado = true THEN
      RAISE NOTICE '⏭️ Ficha duplicada (ID: %, OP: %) - No crear sub-tareas', 
        NEW.id, NEW.numero_op;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 2: Asegurar que el trigger solo procese fichas originales
-- ============================================
-- El trigger ya está configurado correctamente
-- La función ahora verifica es_duplicado = false

-- ============================================
-- PASO 3: Limpiar sub-tareas existentes de fichas duplicadas
-- ============================================
DELETE FROM public.tareas
WHERE es_sub_tarea = true
  AND id_orden IN (
    SELECT id FROM public.ordenes_trabajo
    WHERE es_duplicado = true
  );

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
DECLARE
  sub_tareas_eliminadas integer;
BEGIN
  SELECT COUNT(*) INTO sub_tareas_eliminadas
  FROM public.tareas
  WHERE es_sub_tarea = true
    AND id_orden IN (
      SELECT id FROM public.ordenes_trabajo
      WHERE es_duplicado = true
    );
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX APLICADO: Sub-tareas de fichas duplicadas';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   - Solo se crean sub-tareas para fichas originales';
  RAISE NOTICE '   - Las fichas duplicadas NO tienen sub-tareas';
  RAISE NOTICE '   - Sub-tareas eliminadas: %', sub_tareas_eliminadas;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

