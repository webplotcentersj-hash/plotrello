-- ============================================
-- SCRIPT PARA UNIFICAR FICHAS MANUALMENTE
-- 
-- Ejecuta este script cuando las fichas no se unifiquen automáticamente
-- ============================================

-- Unificar todas las fichas que deberían estar unificadas
DO $$
DECLARE
  rec RECORD;
  ficha_original_id integer;
  total_fichas integer;
  fichas_completadas integer;
  numero_op_comun text;
BEGIN
  -- Para cada OP que tiene fichas en "Finalizado en Taller"
  FOR rec IN 
    SELECT DISTINCT numero_op
    FROM ordenes_trabajo
    WHERE estado = 'Finalizado en Taller'
  LOOP
    -- Encontrar la ficha original
    SELECT id INTO ficha_original_id
    FROM ordenes_trabajo
    WHERE numero_op = rec.numero_op 
      AND es_duplicado = false
    ORDER BY id
    LIMIT 1;
    
    IF ficha_original_id IS NOT NULL THEN
      numero_op_comun := rec.numero_op;
      
      -- Contar fichas
      SELECT COUNT(*) INTO total_fichas
      FROM ordenes_trabajo
      WHERE (
        id = ficha_original_id 
        OR id_orden_original = ficha_original_id
        OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
      );
      
      SELECT COUNT(*) INTO fichas_completadas
      FROM ordenes_trabajo
      WHERE (
        id = ficha_original_id 
        OR id_orden_original = ficha_original_id
        OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
      )
      AND estado = 'Finalizado en Taller';
      
      -- Si todas están completadas y hay más de 1, unificar
      IF fichas_completadas = total_fichas AND total_fichas > 1 THEN
        -- Consolidar trazabilidad
        UPDATE historial_movimientos SET id_orden = ficha_original_id
        WHERE id_orden IN (
          SELECT id FROM ordenes_trabajo 
          WHERE (
            id_orden_original = ficha_original_id
            OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
          )
          AND es_duplicado = true
        );
        
        UPDATE comentarios_orden SET id_orden = ficha_original_id
        WHERE id_orden IN (
          SELECT id FROM ordenes_trabajo 
          WHERE (
            id_orden_original = ficha_original_id
            OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
          )
          AND es_duplicado = true
        );
        
        UPDATE archivos_adjuntos SET id_orden = ficha_original_id
        WHERE id_orden IN (
          SELECT id FROM ordenes_trabajo 
          WHERE (
            id_orden_original = ficha_original_id
            OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
          )
          AND es_duplicado = true
        );
        
        UPDATE enlaces_adjuntos SET id_orden = ficha_original_id
        WHERE id_orden IN (
          SELECT id FROM ordenes_trabajo 
          WHERE (
            id_orden_original = ficha_original_id
            OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
          )
          AND es_duplicado = true
        );
        
        UPDATE orden_materiales SET id_orden = ficha_original_id
        WHERE id_orden IN (
          SELECT id FROM ordenes_trabajo 
          WHERE (
            id_orden_original = ficha_original_id
            OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
          )
          AND es_duplicado = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM orden_materiales om2 
          WHERE om2.id_orden = ficha_original_id 
            AND om2.id_material = orden_materiales.id_material
        );
        
        -- Eliminar duplicadas
        DELETE FROM ordenes_trabajo
        WHERE (
          id_orden_original = ficha_original_id
          OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id != ficha_original_id)
        )
        AND es_duplicado = true;
        
        -- Actualizar original
        UPDATE ordenes_trabajo
        SET 
          estado = 'Finalizado en Taller',
          sector = 'Finalizado en Taller',
          sector_inicial = 'Finalizado en Taller',
          es_duplicado = false
        WHERE id = ficha_original_id;
        
        RAISE NOTICE '✅ Fichas unificadas para OP: % (Total: %, Completadas: %)', 
          numero_op_comun, total_fichas, fichas_completadas;
      END IF;
    END IF;
  END LOOP;
END $$;

