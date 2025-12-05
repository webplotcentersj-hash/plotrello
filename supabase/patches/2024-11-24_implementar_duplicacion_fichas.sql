-- ============================================
-- IMPLEMENTACIÓN: Duplicar fichas principales en sectores requeridos
-- Opción A: Duplicar momentáneamente hasta unificar al final
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Agregar campo para identificar fichas duplicadas
-- ============================================
DO $$
BEGIN
  -- Agregar campo es_duplicado a ordenes_trabajo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
      AND column_name = 'es_duplicado'
  ) THEN
    ALTER TABLE public.ordenes_trabajo
    ADD COLUMN es_duplicado boolean DEFAULT false;
    
    RAISE NOTICE '✅ Columna es_duplicado agregada a ordenes_trabajo';
  ELSE
    RAISE NOTICE 'ℹ️ Columna es_duplicado ya existe';
  END IF;
  
  -- Agregar campo id_orden_original para rastrear la ficha original
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
      AND column_name = 'id_orden_original'
  ) THEN
    ALTER TABLE public.ordenes_trabajo
    ADD COLUMN id_orden_original integer;
    
    -- Agregar foreign key
    ALTER TABLE public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_id_orden_original_fkey 
    FOREIGN KEY (id_orden_original) REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Columna id_orden_original agregada a ordenes_trabajo';
  ELSE
    RAISE NOTICE 'ℹ️ Columna id_orden_original ya existe';
  END IF;
END $$;

-- ============================================
-- PASO 2: Crear función para duplicar ficha en sectores requeridos
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
  -- Solo procesar si NO es una ficha duplicada y tiene sectores requeridos
  IF NEW.es_duplicado = false 
     AND NEW.sectores IS NOT NULL 
     AND array_length(NEW.sectores, 1) > 0 THEN
    
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
-- PASO 3: Crear trigger para duplicar automáticamente
-- ============================================
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_duplicar_ficha_sectores ON public.ordenes_trabajo;
  
  CREATE TRIGGER trigger_duplicar_ficha_sectores
    AFTER INSERT ON public.ordenes_trabajo
    FOR EACH ROW
    EXECUTE FUNCTION public.duplicar_ficha_en_sectores();
  
  RAISE NOTICE '✅ Trigger para duplicar fichas creado';
END $$;

-- ============================================
-- PASO 4: Crear función para sincronizar cambios entre fichas duplicadas
-- ============================================
CREATE OR REPLACE FUNCTION public.sincronizar_fichas_duplicadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si se actualiza una ficha original, sincronizar con duplicados
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
    WHERE id_orden_original = NEW.id
      AND es_duplicado = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para sincronizar
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_sincronizar_duplicados ON public.ordenes_trabajo;
  
  CREATE TRIGGER trigger_sincronizar_duplicados
    AFTER UPDATE ON public.ordenes_trabajo
    FOR EACH ROW
    WHEN (
      OLD.descripcion IS DISTINCT FROM NEW.descripcion OR
      OLD.prioridad IS DISTINCT FROM NEW.prioridad OR
      OLD.fecha_entrega IS DISTINCT FROM NEW.fecha_entrega OR
      OLD.materiales IS DISTINCT FROM NEW.materiales OR
      OLD.telefono_cliente IS DISTINCT FROM NEW.telefono_cliente OR
      OLD.email_cliente IS DISTINCT FROM NEW.email_cliente OR
      OLD.direccion_cliente IS DISTINCT FROM NEW.direccion_cliente OR
      OLD.whatsapp_link IS DISTINCT FROM NEW.whatsapp_link OR
      OLD.ubicacion_link IS DISTINCT FROM NEW.ubicacion_link OR
      OLD.drive_link IS DISTINCT FROM NEW.drive_link OR
      OLD.foto_url IS DISTINCT FROM NEW.foto_url OR
      OLD.dni_cuit IS DISTINCT FROM NEW.dni_cuit
    )
    EXECUTE FUNCTION public.sincronizar_fichas_duplicadas();
  
  RAISE NOTICE '✅ Trigger para sincronizar duplicados creado';
END $$;

-- ============================================
-- PASO 5: Crear función para unificar fichas cuando todas están completadas
-- ============================================
CREATE OR REPLACE FUNCTION public.unificar_fichas_completadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ficha_original_id integer;
  todas_completadas boolean;
  total_fichas integer;
  fichas_completadas integer;
BEGIN
  -- Si se marca una ficha como completada (estado = "Almacén de Entrega" o "Finalizado en Taller")
  IF NEW.estado IN ('Almacén de Entrega', 'Finalizado en Taller') THEN
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
    
    -- Contar fichas completadas
    SELECT COUNT(*) INTO fichas_completadas
    FROM public.ordenes_trabajo
    WHERE (id = ficha_original_id OR id_orden_original = ficha_original_id)
      AND estado IN ('Almacén de Entrega', 'Finalizado en Taller');
    
    -- Si todas están completadas, unificar
    IF fichas_completadas = total_fichas THEN
      -- Eliminar duplicados
      DELETE FROM public.ordenes_trabajo
      WHERE id_orden_original = ficha_original_id
        AND es_duplicado = true;
      
      -- Mover ficha original a "Almacén de Entrega"
      UPDATE public.ordenes_trabajo
      SET 
        estado = 'Almacén de Entrega',
        sector = 'Almacén de Entrega',
        sector_inicial = 'Almacén de Entrega'
      WHERE id = ficha_original_id;
      
      RAISE NOTICE '✅ Fichas unificadas para orden: %', ficha_original_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para unificar
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_unificar_fichas ON public.ordenes_trabajo;
  
  CREATE TRIGGER trigger_unificar_fichas
    AFTER UPDATE ON public.ordenes_trabajo
    FOR EACH ROW
    WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION public.unificar_fichas_completadas();
  
  RAISE NOTICE '✅ Trigger para unificar fichas creado';
END $$;

COMMIT;

-- ============================================
-- NOTA: Esta implementación permite:
-- 1. Ficha principal en sector_inicial (puede NO estar en sectores[])
-- 2. Duplicados automáticos en cada sector de sectores[]
-- 3. Sincronización de datos entre original y duplicados
-- 4. Unificación automática cuando todas están completadas
-- 5. Movimiento independiente (cada ficha se mueve por separado)
-- ============================================

