-- ============================================
-- CORRECCIÓN: Lógica de unificación de fichas
-- 
-- Cuando todas las fichas con el mismo OP (relacionadas) están en "Finalizado en Taller",
-- se unifican automáticamente en una sola ficha
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Corregir función de unificación
-- Unifica cuando TODAS las fichas relacionadas están en "Finalizado en Taller"
-- ============================================
CREATE OR REPLACE FUNCTION public.unificar_fichas_completadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ficha_original_id integer;
  total_fichas integer;
  fichas_completadas integer;
  numero_op_comun text;
BEGIN
  -- Solo procesar cuando una ficha se mueve a "Finalizado en Taller"
  IF NEW.estado = 'Finalizado en Taller' THEN
    -- Determinar el ID de la ficha original (la primera que se creó)
    IF NEW.es_duplicado = true THEN
      ficha_original_id := NEW.id_orden_original;
    ELSE
      ficha_original_id := NEW.id;
    END IF;
    
    -- Obtener el número OP común para verificar todas las fichas relacionadas
    SELECT numero_op INTO numero_op_comun
    FROM public.ordenes_trabajo
    WHERE id = ficha_original_id;
    
    -- Contar total de fichas relacionadas (mismo OP o relacionadas por id_orden_original)
    SELECT COUNT(*) INTO total_fichas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id 
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
    );
    
    -- Contar fichas que están en "Finalizado en Taller"
    SELECT COUNT(*) INTO fichas_completadas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id 
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
    )
    AND estado = 'Finalizado en Taller';
    
    -- Si todas las fichas relacionadas están en "Finalizado en Taller" y hay más de 1
    IF fichas_completadas = total_fichas AND total_fichas > 1 THEN
      -- Eliminar todas las fichas duplicadas
      DELETE FROM public.ordenes_trabajo
      WHERE (
        id_orden_original = ficha_original_id
        OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
      )
      AND es_duplicado = true;
      
      -- Actualizar la ficha original (o la primera) para que quede en "Finalizado en Taller"
      UPDATE public.ordenes_trabajo
      SET 
        estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller',
        es_duplicado = false  -- Ya no es duplicado, es la ficha unificada
      WHERE id = ficha_original_id;
      
      RAISE NOTICE '✅ Fichas unificadas para OP: % (Total: %, Completadas: %)', 
        numero_op_comun, total_fichas, fichas_completadas;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FUNCIÓN DE UNIFICACIÓN ACTUALIZADA';
  RAISE NOTICE '   - Detecta cuando TODAS las fichas';
  RAISE NOTICE '     con el mismo OP están en';
  RAISE NOTICE '     "Finalizado en Taller"';
  RAISE NOTICE '   - Unifica automáticamente en una';
  RAISE NOTICE '     sola ficha';
  RAISE NOTICE '   - Elimina las fichas duplicadas';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

