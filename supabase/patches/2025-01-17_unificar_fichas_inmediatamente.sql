-- Unificar fichas solo cuando TODAS llegan a "Finalizado en Taller"
-- Se unifican cuando todas las fichas relacionadas están en "Finalizado en Taller"

BEGIN;

-- ============================================
-- ACTUALIZAR: Función unificar_fichas_completadas
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
  fichas_duplicadas integer[];
  ficha_id integer;
  numero_op_comun text;
  ubicacion_previa text;
BEGIN
  -- Solo procesar cuando el estado cambia a "Finalizado en Taller"
  IF NEW.estado = 'Finalizado en Taller'
     AND (OLD.estado IS NULL OR OLD.estado != 'Finalizado en Taller') THEN

    -- Guardar ubicación previa (sector/estado anterior) en la ficha que se mueve
    ubicacion_previa := COALESCE(OLD.sector, OLD.estado);
    UPDATE public.ordenes_trabajo
    SET ubicacion_final = ubicacion_previa
    WHERE id = NEW.id;

    -- Obtener el número OP común
    numero_op_comun := NEW.numero_op;
    
    -- Si no hay numero_op, no podemos unificar
    IF numero_op_comun IS NULL OR numero_op_comun = '' THEN
      RETURN NEW;
    END IF;

    -- Determinar el ID de la ficha original
    IF NEW.es_duplicado = true THEN
      ficha_original_id := NEW.id_orden_original;
    ELSE
      ficha_original_id := NEW.id;
    END IF;
    
    -- Si la OP tiene 0 o 1 sector, NO unificar (debe quedarse la ficha)
    IF NEW.sectores IS NULL OR array_length(NEW.sectores, 1) <= 1 THEN
      RETURN NEW;
    END IF;

    -- Obtener el número OP común de la ficha original
    SELECT numero_op INTO numero_op_comun
    FROM public.ordenes_trabajo
    WHERE id = ficha_original_id;

    -- Contar total de fichas relacionadas (original + duplicadas)
    SELECT COUNT(*) INTO total_fichas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
    );

    -- Contar fichas completadas (que están en "Finalizado en Taller")
    SELECT COUNT(*) INTO fichas_completadas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
    )
    AND estado = 'Finalizado en Taller';

    -- ⚠️ CAMBIO: Unificar SOLO cuando TODAS están completadas y hay más de 1 ficha
    IF fichas_completadas = total_fichas AND total_fichas > 1 THEN
      RAISE NOTICE '🔄 Iniciando unificación para OP: % (Total: %, Completadas: %)', 
        numero_op_comun, total_fichas, fichas_completadas;
      
      -- Consolidar trazabilidad (historial, comentarios, archivos, etc.)
      -- Mover datos de todas las fichas duplicadas a la original
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

      -- Obtener IDs de todas las fichas duplicadas (incluyendo la actual si es duplicada)
      SELECT array_agg(id) INTO fichas_duplicadas
      FROM public.ordenes_trabajo
      WHERE (
        id_orden_original = ficha_original_id
        OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
      )
      AND (es_duplicado = true OR id = NEW.id)
      AND id != ficha_original_id;

      -- Eliminar todas las fichas duplicadas
      IF fichas_duplicadas IS NOT NULL AND array_length(fichas_duplicadas, 1) > 0 THEN
        FOREACH ficha_id IN ARRAY fichas_duplicadas
        LOOP
          DELETE FROM public.ordenes_trabajo
          WHERE id = ficha_id;
          
          RAISE NOTICE '🗑️ Ficha duplicada eliminada (ID: %, OP: %)', ficha_id, numero_op_comun;
        END LOOP;
        
        RAISE NOTICE '✅ Total fichas duplicadas eliminadas: % (OP: %)', array_length(fichas_duplicadas, 1), numero_op_comun;
      END IF;

      -- Actualizar la ficha original para que quede en "Finalizado en Taller"
      UPDATE public.ordenes_trabajo
      SET
        estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller',
        es_duplicado = false,
        sectores = COALESCE(NEW.sectores, sectores),
        ubicacion_final = COALESCE(NEW.ubicacion_final, ubicacion_previa, ubicacion_final),
        -- Actualizar con los datos más recientes de la ficha que llegó a Finalizado
        descripcion = COALESCE(NEW.descripcion, descripcion),
        operario_asignado = COALESCE(NEW.operario_asignado, operario_asignado),
        prioridad = COALESCE(NEW.prioridad, prioridad),
        fecha_entrega = COALESCE(NEW.fecha_entrega, fecha_entrega),
        materiales = COALESCE(NEW.materiales, materiales),
        etiquetas = COALESCE(NEW.etiquetas, etiquetas),
        foto_url = COALESCE(NEW.foto_url, foto_url),
        telefono_cliente = COALESCE(NEW.telefono_cliente, telefono_cliente),
        email_cliente = COALESCE(NEW.email_cliente, email_cliente),
        direccion_cliente = COALESCE(NEW.direccion_cliente, direccion_cliente),
        whatsapp_link = COALESCE(NEW.whatsapp_link, whatsapp_link),
        ubicacion_link = COALESCE(NEW.ubicacion_link, ubicacion_link),
        drive_link = COALESCE(NEW.drive_link, drive_link),
        brief_publico = COALESCE(NEW.brief_publico, brief_publico),
        objetivo_proyecto = COALESCE(NEW.objetivo_proyecto, objetivo_proyecto),
        publico_objetivo = COALESCE(NEW.publico_objetivo, publico_objetivo),
        estilo_diseno = COALESCE(NEW.estilo_diseno, estilo_diseno),
        referencias = COALESCE(NEW.referencias, referencias),
        deadline_brief = COALESCE(NEW.deadline_brief, deadline_brief)
      WHERE id = ficha_original_id;

      RAISE NOTICE '✅ Fichas unificadas para OP: % (Total: %, Completadas: %, Ubicación: %)',
        numero_op_comun, total_fichas, fichas_completadas, COALESCE(NEW.ubicacion_final, ubicacion_previa);
    ELSE
      -- No todas están completadas: solo registrar el cambio
      RAISE NOTICE '⏳ OP %: % de % fichas en "Finalizado en Taller" - esperando que todas estén completadas',
        numero_op_comun, fichas_completadas, total_fichas;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Comentario actualizado
COMMENT ON FUNCTION public.unificar_fichas_completadas IS 'Unifica fichas duplicadas solo cuando TODAS las fichas relacionadas llegan a "Finalizado en Taller". Elimina duplicadas y mantiene solo la ficha original unificada.';

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ UNIFICACIÓN IMPLEMENTADA';
  RAISE NOTICE '   - Se unifican cuando TODAS llegan a "Finalizado en Taller"';
  RAISE NOTICE '   - Espera a que todas las fichas estén completadas';
  RAISE NOTICE '   - Elimina duplicadas cuando todas están listas';
  RAISE NOTICE '   - Consolida toda la trazabilidad';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

