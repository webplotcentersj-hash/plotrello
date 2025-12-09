-- Función completa de unificación que:
-- 1. Guarda ubicacion_final cuando se mueve a "Finalizado en Taller"
-- 2. Unifica solo cuando hay 2+ sectores
-- 3. Toma la ubicación del último movimiento (NEW) al unificar

BEGIN;

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

    -- Si la OP tiene 0 o 1 sector, NO unificar (debe quedarse la ficha)
    IF NEW.sectores IS NULL OR array_length(NEW.sectores, 1) <= 1 THEN
      RETURN NEW;
    END IF;

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
      AND id != NEW.id;

      -- Actualizar la ficha original
      -- ⚠️ IMPORTANTE: Usar la ubicación_final de NEW (la última que se movió)
      UPDATE public.ordenes_trabajo
      SET
        estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller',
        es_duplicado = false,
        sectores = NEW.sectores,
        ubicacion_final = COALESCE(NEW.ubicacion_final, ubicacion_previa)
      WHERE id = ficha_original_id;

      RAISE NOTICE '✅ Fichas unificadas para OP: % (Total: %, Completadas: %, Ubicación: %)',
        numero_op_comun, total_fichas, fichas_completadas, COALESCE(NEW.ubicacion_final, ubicacion_previa);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

