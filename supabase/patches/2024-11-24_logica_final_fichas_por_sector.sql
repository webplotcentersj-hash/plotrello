-- ============================================
-- LÓGICA FINAL: Fichas por sector
-- 
-- Un trabajo (OP) puede requerir múltiples sectores trabajando en paralelo
-- Se crean automáticamente N fichas (una por cada sector requerido)
-- Todas comparten el mismo OP pero se mueven independientemente
-- Se unifican en "Finalizado en Taller" conservando toda la trazabilidad
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Función para crear fichas automáticamente por sector
-- Si hay N sectores en sectores[], crea EXACTAMENTE N fichas
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
      sector_inicial = sectores_a_crear[1],  -- Mantener para compatibilidad
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 2: Función de unificación con trazabilidad
-- Unifica cuando todas las fichas están en "Finalizado en Taller"
-- Conserva toda la trazabilidad (historial, comentarios, etc.)
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
  ficha_duplicada record;
BEGIN
  -- Solo procesar cuando una ficha se mueve a "Finalizado en Taller"
  IF NEW.estado = 'Finalizado en Taller' THEN
    -- Determinar el ID de la ficha original (la primera que se creó)
    IF NEW.es_duplicado = true THEN
      ficha_original_id := NEW.id_orden_original;
    ELSE
      ficha_original_id := NEW.id;
    END IF;
    
    -- Obtener el número OP común
    SELECT numero_op INTO numero_op_comun
    FROM public.ordenes_trabajo
    WHERE id = ficha_original_id;
    
    -- Contar total de fichas relacionadas (mismo OP)
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
      -- ANTES de eliminar: Consolidar trazabilidad
      -- Mover historial de movimientos de fichas duplicadas a la original
      UPDATE public.historial_movimientos
      SET id_orden = ficha_original_id
      WHERE id_orden IN (
        SELECT id FROM public.ordenes_trabajo
        WHERE (
          id_orden_original = ficha_original_id
          OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
        )
        AND es_duplicado = true
      );
      
      -- Mover comentarios de fichas duplicadas a la original
      UPDATE public.comentarios_orden
      SET id_orden = ficha_original_id
      WHERE id_orden IN (
        SELECT id FROM public.ordenes_trabajo
        WHERE (
          id_orden_original = ficha_original_id
          OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
        )
        AND es_duplicado = true
      );
      
      -- Mover archivos adjuntos de fichas duplicadas a la original
      UPDATE public.archivos_adjuntos
      SET id_orden = ficha_original_id
      WHERE id_orden IN (
        SELECT id FROM public.ordenes_trabajo
        WHERE (
          id_orden_original = ficha_original_id
          OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
        )
        AND es_duplicado = true
      );
      
      -- Mover enlaces adjuntos de fichas duplicadas a la original
      UPDATE public.enlaces_adjuntos
      SET id_orden = ficha_original_id
      WHERE id_orden IN (
        SELECT id FROM public.ordenes_trabajo
        WHERE (
          id_orden_original = ficha_original_id
          OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
        )
        AND es_duplicado = true
      );
      
      -- Mover materiales de fichas duplicadas a la original
      UPDATE public.orden_materiales
      SET id_orden = ficha_original_id
      WHERE id_orden IN (
        SELECT id FROM public.ordenes_trabajo
        WHERE (
          id_orden_original = ficha_original_id
          OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
        )
        AND es_duplicado = true
      )
      AND NOT EXISTS (
        -- Evitar duplicados de materiales
        SELECT 1 FROM public.orden_materiales om2
        WHERE om2.id_orden = ficha_original_id
          AND om2.id_material = orden_materiales.id_material
      );
      
      -- Eliminar todas las fichas duplicadas (después de consolidar trazabilidad)
      DELETE FROM public.ordenes_trabajo
      WHERE (
        id_orden_original = ficha_original_id
        OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
      )
      AND es_duplicado = true;
      
      -- Actualizar la ficha original para que quede en "Finalizado en Taller"
      UPDATE public.ordenes_trabajo
      SET 
        estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller',
        es_duplicado = false  -- Ya no es duplicado, es la ficha unificada
      WHERE id = ficha_original_id;
      
      RAISE NOTICE '✅ Fichas unificadas para OP: % (Total: %, Completadas: %) - Trazabilidad consolidada', 
        numero_op_comun, total_fichas, fichas_completadas;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 3: Asegurar que el trigger solo se ejecute en INSERT
-- ============================================
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_duplicar_ficha_sectores ON public.ordenes_trabajo;
  DROP TRIGGER IF EXISTS trigger_crear_fichas_por_sector ON public.ordenes_trabajo;
  
  -- ⚠️ IMPORTANTE: Solo AFTER INSERT, NO UPDATE
  CREATE TRIGGER trigger_crear_fichas_por_sector
    AFTER INSERT ON public.ordenes_trabajo
    FOR EACH ROW
    EXECUTE FUNCTION public.crear_fichas_por_sector();
  
  RAISE NOTICE '✅ Trigger de creación de fichas por sector actualizado';
END $$;

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ LÓGICA FINAL IMPLEMENTADA';
  RAISE NOTICE '   - Si hay N sectores, se crean';
  RAISE NOTICE '     EXACTAMENTE N fichas';
  RAISE NOTICE '   - Todas comparten el mismo OP';
  RAISE NOTICE '   - Movimiento independiente';
  RAISE NOTICE '   - Unificación en "Finalizado en';
  RAISE NOTICE '     Taller" con trazabilidad';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

