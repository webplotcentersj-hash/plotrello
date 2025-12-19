-- ============================================
-- FIX: Prevenir duplicación incorrecta de fichas con múltiples sectores
-- 
-- Problema: Cuando se crea una ficha para 2 sectores, se están duplicando incorrectamente
-- Solución: Mejorar la verificación para evitar duplicaciones y asegurar que solo se crean N fichas para N sectores
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Mejorar función de creación de fichas por sector
-- Asegurar verificación más robusta para evitar duplicaciones
-- ============================================
CREATE OR REPLACE FUNCTION public.crear_fichas_por_sector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sector_nombre text;
  ficha_id integer;
  sectores_a_crear text[];
  i integer;
  total_sectores integer;
  fichas_existentes integer;
  sector_ya_creado boolean;
BEGIN
  -- ⚠️ CRÍTICO: Solo procesar si:
  -- 1. Es un INSERT (no UPDATE) - el trigger ya está configurado así
  -- 2. NO es una ficha duplicada (para evitar que las duplicadas creen más duplicadas)
  -- 3. Tiene sectores requeridos
  -- 4. NO está en "Finalizado en Taller"
  IF NEW.es_duplicado = false 
     AND NEW.sectores IS NOT NULL 
     AND array_length(NEW.sectores, 1) > 1
     AND NEW.estado != 'Finalizado en Taller' THEN
    
    -- ⚠️ VERIFICACIÓN ADICIONAL: Verificar que NO hay fichas unificadas para este OP
    -- Si ya hay una ficha unificada (es_duplicado = false y estado = 'Finalizado en Taller'),
    -- NO crear nuevas fichas
    SELECT COUNT(*) INTO fichas_existentes
    FROM public.ordenes_trabajo
    WHERE numero_op = NEW.numero_op
      AND es_duplicado = false
      AND estado = 'Finalizado en Taller';
    
    IF fichas_existentes > 0 THEN
      RAISE NOTICE '⏭️ OP % ya tiene fichas unificadas - NO crear nuevas fichas', NEW.numero_op;
      RETURN NEW;
    END IF;
    
    sectores_a_crear := NEW.sectores;
    total_sectores := array_length(sectores_a_crear, 1);
    
    -- Actualizar la ficha original para que aparezca en el primer sector
    UPDATE public.ordenes_trabajo
    SET 
      sector = sectores_a_crear[1],
      estado = sectores_a_crear[1],
      sector_inicial = sectores_a_crear[1],
      es_duplicado = false
    WHERE id = NEW.id;
    
    -- Crear fichas adicionales si hay más de 1 sector
    IF total_sectores > 1 THEN
      FOR i IN 2..total_sectores
      LOOP
        sector_nombre := sectores_a_crear[i];
        
        -- ⚠️ VERIFICACIÓN MEJORADA: Verificar que NO existe ya una ficha para este sector
        -- Verificar tanto por id_orden_original como por numero_op + sector
        SELECT EXISTS (
          SELECT 1 FROM public.ordenes_trabajo
          WHERE (
            -- Ficha duplicada que apunta a la original
            (id_orden_original = NEW.id AND sector = sector_nombre AND es_duplicado = true)
            OR
            -- Ficha con mismo OP y sector (por si acaso)
            (id_orden_original IS NULL 
             AND numero_op = NEW.numero_op 
             AND sector = sector_nombre 
             AND id != NEW.id
             AND es_duplicado = true)
          )
        ) INTO sector_ya_creado;
        
        -- Solo crear si NO existe ya una ficha para este sector
        IF NOT sector_ya_creado THEN
          -- Crear ficha para este sector
          INSERT INTO public.ordenes_trabajo (
            numero_op, cliente, descripcion, estado, prioridad, fecha_entrega,
            operario_asignado, complejidad, sector, sectores, sector_inicial,
            materiales, nombre_creador, telefono_cliente, email_cliente,
            direccion_cliente, whatsapp_link, ubicacion_link, drive_link,
            foto_url, dni_cuit, es_duplicado, id_orden_original,
            fecha_creacion, fecha_ingreso, id_usuario_creador,
            etiquetas, brief_publico, objetivo_proyecto, publico_objetivo,
            estilo_diseno, referencias, deadline_brief
          ) VALUES (
            NEW.numero_op, NEW.cliente, NEW.descripcion,
            sector_nombre,  -- Estado = nombre del sector
            NEW.prioridad, NEW.fecha_entrega, NEW.operario_asignado,
            NEW.complejidad, sector_nombre, NEW.sectores, sector_nombre,
            NEW.materiales, NEW.nombre_creador, NEW.telefono_cliente,
            NEW.email_cliente, NEW.direccion_cliente, NEW.whatsapp_link,
            NEW.ubicacion_link, NEW.drive_link, NEW.foto_url, NEW.dni_cuit,
            true,  -- Es duplicado
            NEW.id,  -- ID de la ficha original
            NEW.fecha_creacion, NEW.fecha_ingreso,
            NEW.id_usuario_creador,
            NEW.etiquetas, NEW.brief_publico, NEW.objetivo_proyecto,
            NEW.publico_objetivo, NEW.estilo_diseno, NEW.referencias,
            NEW.deadline_brief
          )
          RETURNING id INTO ficha_id;
          
          RAISE NOTICE '✅ Ficha creada para sector: % (ID: %, OP: %, Original: %)', 
            sector_nombre, ficha_id, NEW.numero_op, NEW.id;
        ELSE
          RAISE NOTICE '⚠️ Ficha ya existe para sector: % (OP: %, Original: %) - Saltando creación', 
            sector_nombre, NEW.numero_op, NEW.id;
        END IF;
      END LOOP;
      
      RAISE NOTICE '✅ Total fichas para OP %: % (1 original + % duplicadas)', 
        NEW.numero_op, total_sectores, total_sectores - 1;
    ELSE
      -- Solo 1 sector: no crear duplicados
      RAISE NOTICE '✅ Ficha creada para 1 sector: % (ID: %, OP: %)', 
        sectores_a_crear[1], NEW.id, NEW.numero_op;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 2: Asegurar que el trigger solo se ejecute una vez
-- ============================================
-- El trigger ya está configurado como AFTER INSERT, que es correcto
-- Solo verificar que no hay triggers duplicados

DO $$
BEGIN
  -- Verificar si hay múltiples triggers
  IF (SELECT COUNT(*) FROM pg_trigger 
      WHERE tgname = 'trigger_crear_fichas_por_sector' 
      AND tgrelid = 'public.ordenes_trabajo'::regclass) > 1 THEN
    RAISE WARNING '⚠️ Hay múltiples triggers con el mismo nombre - eliminando duplicados';
    -- Eliminar todos y recrear uno solo
    DROP TRIGGER IF EXISTS trigger_crear_fichas_por_sector ON public.ordenes_trabajo;
  END IF;
  
  -- Recrear el trigger si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_crear_fichas_por_sector' 
    AND tgrelid = 'public.ordenes_trabajo'::regclass
  ) THEN
    CREATE TRIGGER trigger_crear_fichas_por_sector
      AFTER INSERT ON public.ordenes_trabajo
      FOR EACH ROW
      EXECUTE FUNCTION public.crear_fichas_por_sector();
    
    RAISE NOTICE '✅ Trigger recreado correctamente';
  ELSE
    RAISE NOTICE '✅ Trigger ya existe - no se recrea';
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
  RAISE NOTICE '✅ CORRECCIÓN APLICADA';
  RAISE NOTICE '   - Verificación mejorada para evitar duplicaciones';
  RAISE NOTICE '   - Solo se crean N fichas para N sectores';
  RAISE NOTICE '   - Verificación por id_orden_original y numero_op + sector';
  RAISE NOTICE '   - Trigger configurado para ejecutarse solo una vez';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

