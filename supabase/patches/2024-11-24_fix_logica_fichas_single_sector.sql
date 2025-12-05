-- ============================================
-- FIX: Corregir lógica para fichas con un solo sector
-- 
-- Problemas:
-- 1. Las fichas con un solo sector deben poder moverse normalmente
-- 2. Solo se duplican si hay 2+ sectores
-- 3. Los sectores deben coincidir exactamente con las columnas del Kanban
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Corregir función para que funcione con 1 o más sectores
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
BEGIN
  -- Solo procesar en INSERT (no en UPDATE/movimiento)
  -- Solo si NO es una ficha duplicada
  -- Solo si tiene sectores requeridos
  IF NEW.es_duplicado = false 
     AND NEW.sectores IS NOT NULL 
     AND array_length(NEW.sectores, 1) > 0 THEN
    
    -- Usar directamente los sectores del array
    sectores_a_crear := NEW.sectores;
    
    -- Actualizar la ficha original para que aparezca en el primer sector
    UPDATE public.ordenes_trabajo
    SET 
      sector = sectores_a_crear[1],
      sector_inicial = sectores_a_crear[1],  -- Mantener para compatibilidad
      es_duplicado = false  -- La primera ficha no es duplicado
    WHERE id = NEW.id;
    
    -- Si hay más de 1 sector, crear fichas adicionales
    -- Si hay 1 sector, no crear duplicados (solo la ficha original)
    IF array_length(sectores_a_crear, 1) > 1 THEN
      -- Crear una ficha para cada sector restante (a partir del segundo)
      FOR i IN 2..array_length(sectores_a_crear, 1)
      LOOP
        sector_nombre := sectores_a_crear[i];
        
        -- Verificar si ya existe una ficha para este sector
        IF NOT EXISTS (
          SELECT 1 FROM public.ordenes_trabajo
          WHERE id_orden_original = NEW.id
            AND sector = sector_nombre
            AND es_duplicado = true
        ) THEN
          -- Crear ficha para este sector
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
            NEW.numero_op,  -- Mismo OP (mismo trabajo)
            NEW.cliente,
            NEW.descripcion,
            NEW.estado,
            NEW.prioridad,
            NEW.fecha_entrega,
            NEW.operario_asignado,
            NEW.complejidad,
            sector_nombre,  -- Sector donde aparece esta ficha
            NEW.sectores,   -- Mismo array de sectores
            sector_nombre,  -- sector_inicial = sector
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
            true,           -- Es duplicado (para tracking)
            NEW.id,         -- ID de la primera ficha
            NEW.fecha_creacion,
            NEW.fecha_ingreso
          )
          RETURNING id INTO ficha_id;
          
          RAISE NOTICE '✅ Ficha creada para sector: % (ID: %, OP: %, Original: %)', 
            sector_nombre, ficha_id, NEW.numero_op, NEW.id;
        END IF;
      END LOOP;
    ELSE
      -- Solo 1 sector: no crear duplicados, la ficha original ya está lista
      RAISE NOTICE '✅ Ficha creada para 1 sector: % (ID: %, OP: %)', 
        sectores_a_crear[1], NEW.id, NEW.numero_op;
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
  RAISE NOTICE '   - Fichas con 1 sector: se mueven';
  RAISE NOTICE '     normalmente (sin duplicar)';
  RAISE NOTICE '   - Fichas con 2+ sectores: se';
  RAISE NOTICE '     duplican automáticamente';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

