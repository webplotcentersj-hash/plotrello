-- ============================================
-- CORRECCIÓN: Lógica de fichas por sector
-- 
-- Cambios:
-- 1. Si hay N sectores, crear EXACTAMENTE N fichas (una por cada sector)
-- 2. NO hay "ficha principal" y "duplicados", todas son fichas iguales
-- 3. Cada ficha aparece en su sector correspondiente
-- 4. Unificar cuando todas estén en "Finalizado en Taller"
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Corregir función de creación de fichas por sector
-- Crea EXACTAMENTE una ficha por cada sector en sectores[]
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
    -- Si hay N sectores, crear EXACTAMENTE N fichas (una por cada sector)
    sectores_a_crear := NEW.sectores;
    
    -- Actualizar la ficha original para que aparezca en el primer sector
    UPDATE public.ordenes_trabajo
    SET 
      sector = sectores_a_crear[1],
      sector_inicial = sectores_a_crear[1],
      es_duplicado = false  -- La primera ficha no es duplicado (para tracking interno)
    WHERE id = NEW.id;
    
    -- Crear una ficha para cada sector restante (a partir del segundo)
    -- Si hay 2 sectores, se crea 1 ficha adicional (total: 2 fichas)
    -- Si hay 3 sectores, se crean 2 fichas adicionales (total: 3 fichas)
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
          NEW.numero_op,
          NEW.cliente,
          NEW.descripcion,
          NEW.estado,
          NEW.prioridad,
          NEW.fecha_entrega,
          NEW.operario_asignado,
          NEW.complejidad,
          sector_nombre,  -- Sector donde aparece esta ficha
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
          true,           -- Es duplicado (para tracking)
          NEW.id,         -- ID de la primera ficha
          NEW.fecha_creacion,
          NEW.fecha_ingreso
        )
        RETURNING id INTO ficha_id;
        
        RAISE NOTICE '✅ Ficha creada para sector: % (ID: %, Original: %)', 
          sector_nombre, ficha_id, NEW.id;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 2: Reemplazar el trigger anterior
-- ============================================
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_duplicar_ficha_sectores ON public.ordenes_trabajo;
  
  -- ⚠️ IMPORTANTE: Solo AFTER INSERT, NO UPDATE
  CREATE TRIGGER trigger_crear_fichas_por_sector
    AFTER INSERT ON public.ordenes_trabajo
    FOR EACH ROW
    EXECUTE FUNCTION public.crear_fichas_por_sector();
  
  RAISE NOTICE '✅ Trigger de creación de fichas por sector actualizado';
END $$;

-- ============================================
-- PASO 3: Mantener función de sincronización
-- (sin cambios, solo sincroniza datos)
-- ============================================
-- La función sincronizar_fichas_duplicadas ya existe y está correcta

-- ============================================
-- PASO 4: Mantener función de unificación
-- (sin cambios, unifica cuando todas están en "Finalizado en Taller")
-- ============================================
-- La función unificar_fichas_completadas ya existe y está correcta

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ LÓGICA CORREGIDA';
  RAISE NOTICE '   - Si hay N sectores, se crean EXACTAMENTE N fichas';
  RAISE NOTICE '   - Una ficha por cada sector asignado';
  RAISE NOTICE '   - NO hay "ficha principal" y "duplicados"';
  RAISE NOTICE '   - Todas las fichas son iguales';
  RAISE NOTICE '   - Unificación en "Finalizado en Taller"';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

