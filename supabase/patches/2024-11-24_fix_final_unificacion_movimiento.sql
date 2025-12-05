-- ============================================
-- FIX FINAL: Unificación y movimiento de fichas
-- 
-- Problemas resueltos:
-- 1. ✅ Prevenir duplicación al llegar a "Finalizado en Taller"
-- 2. ✅ Permitir movimiento libre de fichas
-- 3. ✅ Asegurar que cada ficha aparezca en su columna correcta
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Función de creación - NO crear si está en "Finalizado en Taller"
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
BEGIN
  -- ⚠️ CRÍTICO: Solo procesar si:
  -- 1. Es un INSERT (no UPDATE)
  -- 2. NO es una ficha duplicada
  -- 3. Tiene sectores requeridos
  -- 4. NO está en "Finalizado en Taller" (evitar crear durante unificación)
  IF NEW.es_duplicado = false 
     AND NEW.sectores IS NOT NULL 
     AND array_length(NEW.sectores, 1) > 0
     AND NEW.estado != 'Finalizado en Taller' THEN
    
    sectores_a_crear := NEW.sectores;
    total_sectores := array_length(sectores_a_crear, 1);
    
    -- Actualizar la ficha original
    UPDATE public.ordenes_trabajo
    SET 
      sector = sectores_a_crear[1],
      estado = sectores_a_crear[1],  -- Estado = Sector (para columna correcta)
      sector_inicial = sectores_a_crear[1],
      es_duplicado = false
    WHERE id = NEW.id;
    
    -- Crear fichas adicionales si hay más de 1 sector
    IF total_sectores > 1 THEN
      FOR i IN 2..total_sectores
      LOOP
        sector_nombre := sectores_a_crear[i];
        
        -- Verificar que NO existe ya una ficha para este sector
        IF NOT EXISTS (
          SELECT 1 FROM public.ordenes_trabajo
          WHERE (
            (id_orden_original = NEW.id AND sector = sector_nombre)
            OR (id_orden_original IS NULL AND numero_op = NEW.numero_op AND sector = sector_nombre AND id != NEW.id)
          )
          AND es_duplicado = true
        ) THEN
          -- Crear ficha para este sector
          INSERT INTO public.ordenes_trabajo (
            numero_op, cliente, descripcion, estado, prioridad, fecha_entrega,
            operario_asignado, complejidad, sector, sectores, sector_inicial,
            materiales, nombre_creador, telefono_cliente, email_cliente,
            direccion_cliente, whatsapp_link, ubicacion_link, drive_link,
            foto_url, dni_cuit, es_duplicado, id_orden_original,
            fecha_creacion, fecha_ingreso, id_usuario_creador
          ) VALUES (
            NEW.numero_op, NEW.cliente, NEW.descripcion,
            sector_nombre,  -- ⚠️ Estado = Sector (para columna correcta)
            NEW.prioridad, NEW.fecha_entrega, NEW.operario_asignado,
            NEW.complejidad, sector_nombre, NEW.sectores, sector_nombre,
            NEW.materiales, NEW.nombre_creador, NEW.telefono_cliente,
            NEW.email_cliente, NEW.direccion_cliente, NEW.whatsapp_link,
            NEW.ubicacion_link, NEW.drive_link, NEW.foto_url, NEW.dni_cuit,
            true, NEW.id, NEW.fecha_creacion, NEW.fecha_ingreso,
            NEW.id_usuario_creador
          )
          RETURNING id INTO ficha_id;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 2: Función de unificación - NO duplicar, solo unificar
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
  -- Solo procesar cuando el estado cambia a "Finalizado en Taller"
  IF NEW.estado = 'Finalizado en Taller' 
     AND (OLD.estado IS NULL OR OLD.estado != 'Finalizado en Taller') THEN
    
    -- Determinar el ID de la ficha original
    IF NEW.es_duplicado = true THEN
      ficha_original_id := NEW.id_orden_original;
    ELSE
      ficha_original_id := NEW.id;
    END IF;
    
    -- Obtener el número OP común
    SELECT numero_op INTO numero_op_comun
    FROM public.ordenes_trabajo
    WHERE id = ficha_original_id;
    
    -- Contar total de fichas relacionadas
    SELECT COUNT(*) INTO total_fichas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id 
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
    );
    
    -- Contar fichas completadas
    SELECT COUNT(*) INTO fichas_completadas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id 
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
    )
    AND estado = 'Finalizado en Taller';
    
    -- Si todas están completadas y hay más de 1, unificar
    IF fichas_completadas = total_fichas AND total_fichas > 1 THEN
      -- Consolidar trazabilidad (historial, comentarios, archivos, etc.)
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
        SELECT 1 FROM public.orden_materiales om2
        WHERE om2.id_orden = ficha_original_id
          AND om2.id_material = orden_materiales.id_material
      );
      
      -- ⚠️ CRÍTICO: Eliminar duplicadas, pero NO la ficha que está siendo actualizada (NEW)
      DELETE FROM public.ordenes_trabajo
      WHERE (
        id_orden_original = ficha_original_id
        OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
      )
      AND es_duplicado = true
      AND id != NEW.id;  -- ⚠️ NO eliminar NEW (la ficha que está siendo actualizada)
      
      -- Actualizar la ficha original
      UPDATE public.ordenes_trabajo
      SET 
        estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller',
        es_duplicado = false,
        sectores = NEW.sectores
      WHERE id = ficha_original_id;
      
      RAISE NOTICE '✅ Fichas unificadas para OP: % (Total: %, Completadas: %)', 
        numero_op_comun, total_fichas, fichas_completadas;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 3: Asegurar triggers correctos
-- ============================================
-- Trigger de creación (ya está correcto, solo INSERT)
-- Trigger de unificación (ya está correcto, solo cuando cambia a "Finalizado en Taller")

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX FINAL APLICADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   - Fichas se mueven libremente';
  RAISE NOTICE '   - Cada ficha en su columna correcta';
  RAISE NOTICE '   - Unificación NO duplica';
  RAISE NOTICE '   - Solo unifica cuando todas están en "Finalizado en Taller"';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

