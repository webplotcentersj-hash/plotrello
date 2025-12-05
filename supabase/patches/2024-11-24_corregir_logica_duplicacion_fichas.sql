-- ============================================
-- CORRECCIÓN: Lógica de duplicación de fichas
-- 
-- Cambios:
-- 1. Sector inicial es solo inicial, la ficha puede moverse normalmente
-- 2. NO duplicar al mover (solo en creación con 2+ sectores)
-- 3. Duplicar SOLO cuando hay 2 o más sectores
-- 4. Unificar cuando todas estén en "Finalizado en Taller" (no "Almacén de Entrega")
-- 5. Las tareas son checklist dentro de las fichas (no fichas separadas)
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Corregir función de duplicación
-- Solo duplica si hay 2+ sectores y solo en INSERT
-- ============================================
CREATE OR REPLACE FUNCTION public.duplicar_ficha_en_sectores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sector_nombre text;
  ficha_duplicada_id integer;
BEGIN
  -- Solo procesar en INSERT (no en UPDATE/movimiento)
  -- Solo si NO es una ficha duplicada
  -- Solo si tiene 2 o más sectores requeridos
  IF NEW.es_duplicado = false 
     AND NEW.sectores IS NOT NULL 
     AND array_length(NEW.sectores, 1) > 1 THEN  -- ⚠️ Cambio: > 1 en lugar de > 0
    
    -- Crear una ficha duplicada para cada sector en sectores[]
    FOREACH sector_nombre IN ARRAY NEW.sectores
    LOOP
      -- No crear duplicado para el sector_inicial (ese es donde está la ficha principal)
      IF sector_nombre != COALESCE(NEW.sector_inicial, NEW.sector) THEN
        -- Verificar si ya existe un duplicado para este sector
        IF NOT EXISTS (
          SELECT 1 FROM public.ordenes_trabajo
          WHERE id_orden_original = NEW.id
            AND sector = sector_nombre
            AND es_duplicado = true
        ) THEN
          -- Crear ficha duplicada
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
            es_duplicado,
            id_orden_original,
            fecha_creacion,
            fecha_ingreso
          ) VALUES (
            NEW.numero_op,
            NEW.cliente,
            NEW.descripcion,
            NEW.estado,
            NEW.prioridad,
            NEW.fecha_entrega,
            NEW.operario_asignado,
            NEW.complejidad,
            sector_nombre,  -- Sector donde aparece el duplicado
            NEW.sectores,   -- Mismo array de sectores
            sector_nombre,  -- sector_inicial = sector (para que aparezca en su columna)
            NEW.materiales,
            NEW.nombre_creador,
            NEW.telefono_cliente,
            NEW.email_cliente,
            NEW.direccion_cliente,
            NEW.whatsapp_link,
            NEW.ubicacion_link,
            NEW.drive_link,
            NEW.foto_url,
            NEW.dni_cuit,
            true,           -- Es duplicado
            NEW.id,         -- ID de la ficha original
            NEW.fecha_creacion,
            NEW.fecha_ingreso
          )
          RETURNING id INTO ficha_duplicada_id;
          
          RAISE NOTICE '✅ Ficha duplicada creada para sector: % (ID: %, Original: %)', 
            sector_nombre, ficha_duplicada_id, NEW.id;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 2: Asegurar que el trigger solo se ejecute en INSERT
-- ============================================
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_duplicar_ficha_sectores ON public.ordenes_trabajo;
  
  -- ⚠️ IMPORTANTE: Solo AFTER INSERT, NO UPDATE
  CREATE TRIGGER trigger_duplicar_ficha_sectores
    AFTER INSERT ON public.ordenes_trabajo
    FOR EACH ROW
    EXECUTE FUNCTION public.duplicar_ficha_en_sectores();
  
  RAISE NOTICE '✅ Trigger de duplicación actualizado (solo INSERT, 2+ sectores)';
END $$;

-- ============================================
-- PASO 3: Corregir función de sincronización
-- NO debe duplicar, solo sincronizar datos
-- ============================================
CREATE OR REPLACE FUNCTION public.sincronizar_fichas_duplicadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si se actualiza una ficha original, sincronizar con duplicados
  -- ⚠️ IMPORTANTE: NO duplicar, solo sincronizar datos
  IF NEW.es_duplicado = false AND OLD.es_duplicado = false THEN
    UPDATE public.ordenes_trabajo
    SET
      descripcion = NEW.descripcion,
      prioridad = NEW.prioridad,
      fecha_entrega = NEW.fecha_entrega,
      materiales = NEW.materiales,
      telefono_cliente = NEW.telefono_cliente,
      email_cliente = NEW.email_cliente,
      direccion_cliente = NEW.direccion_cliente,
      whatsapp_link = NEW.whatsapp_link,
      ubicacion_link = NEW.ubicacion_link,
      drive_link = NEW.drive_link,
      foto_url = NEW.foto_url,
      dni_cuit = NEW.dni_cuit
      -- ⚠️ NO sincronizar estado/sector (cada ficha se mueve independientemente)
    WHERE id_orden_original = NEW.id
      AND es_duplicado = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 4: Corregir función de unificación
-- Unificar SOLO cuando todas estén en "Finalizado en Taller"
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
BEGIN
  -- ⚠️ Cambio: Solo unificar cuando se marca como "Finalizado en Taller"
  IF NEW.estado = 'Finalizado en Taller' THEN
    -- Determinar si es ficha original o duplicada
    IF NEW.es_duplicado = true THEN
      ficha_original_id := NEW.id_orden_original;
    ELSE
      ficha_original_id := NEW.id;
    END IF;
    
    -- Contar total de fichas (original + duplicados)
    SELECT COUNT(*) INTO total_fichas
    FROM public.ordenes_trabajo
    WHERE id = ficha_original_id OR id_orden_original = ficha_original_id;
    
    -- Contar fichas completadas (solo "Finalizado en Taller")
    SELECT COUNT(*) INTO fichas_completadas
    FROM public.ordenes_trabajo
    WHERE (id = ficha_original_id OR id_orden_original = ficha_original_id)
      AND estado = 'Finalizado en Taller';
    
    -- Si todas están completadas, unificar
    IF fichas_completadas = total_fichas AND total_fichas > 1 THEN
      -- Eliminar duplicados
      DELETE FROM public.ordenes_trabajo
      WHERE id_orden_original = ficha_original_id
        AND es_duplicado = true;
      
      -- Mover ficha original a "Finalizado en Taller" (ya está ahí, pero asegurar)
      UPDATE public.ordenes_trabajo
      SET 
        estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller'
      WHERE id = ficha_original_id;
      
      RAISE NOTICE '✅ Fichas unificadas para orden: % (todas en Finalizado en Taller)', ficha_original_id;
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
  RAISE NOTICE '✅ LÓGICA CORREGIDA';
  RAISE NOTICE '   - Duplicación solo con 2+ sectores';
  RAISE NOTICE '   - Solo en INSERT (no al mover)';
  RAISE NOTICE '   - Unificación en "Finalizado en Taller"';
  RAISE NOTICE '   - Movimiento independiente permitido';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

