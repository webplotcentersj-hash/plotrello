-- Estabiliza la unificacion en "Finalizado en Taller" preservando trazabilidad completa.
-- Nota: la fusion "en movimiento" sigue ocurriendo en backend (api.ts), este patch
-- asegura consistencia en la unificacion por trigger al cierre del flujo.

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
  fichas_a_fusionar integer[];
  numero_op_comun text;
  ubicacion_previa text;
BEGIN
  -- Solo procesar cuando cambia a "Finalizado en Taller".
  IF NEW.estado = 'Finalizado en Taller'
     AND (OLD.estado IS NULL OR OLD.estado <> 'Finalizado en Taller') THEN

    ubicacion_previa := COALESCE(OLD.sector, OLD.estado);
    UPDATE public.ordenes_trabajo
    SET ubicacion_final = ubicacion_previa
    WHERE id = NEW.id;

    IF NEW.numero_op IS NULL OR NEW.numero_op = '' THEN
      RETURN NEW;
    END IF;

    -- Si la OP tiene 0 o 1 sector no se unifica.
    IF NEW.sectores IS NULL OR array_length(NEW.sectores, 1) <= 1 THEN
      RETURN NEW;
    END IF;

    IF NEW.es_duplicado = true THEN
      ficha_original_id := NEW.id_orden_original;
    ELSE
      ficha_original_id := NEW.id;
    END IF;

    SELECT numero_op INTO numero_op_comun
    FROM public.ordenes_trabajo
    WHERE id = ficha_original_id;

    SELECT COUNT(*) INTO total_fichas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id <> ficha_original_id)
    );

    SELECT COUNT(*) INTO fichas_completadas
    FROM public.ordenes_trabajo
    WHERE (
      id = ficha_original_id
      OR id_orden_original = ficha_original_id
      OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id <> ficha_original_id)
    )
    AND estado = 'Finalizado en Taller';

    IF fichas_completadas = total_fichas AND total_fichas > 1 THEN
      SELECT array_agg(id) INTO fichas_a_fusionar
      FROM public.ordenes_trabajo
      WHERE (
        id_orden_original = ficha_original_id
        OR (id_orden_original IS NULL AND numero_op = numero_op_comun AND id <> ficha_original_id)
      )
      AND id <> ficha_original_id;

      IF fichas_a_fusionar IS NOT NULL AND array_length(fichas_a_fusionar, 1) > 0 THEN
        UPDATE public.historial_movimientos
        SET id_orden = ficha_original_id
        WHERE id_orden = ANY(fichas_a_fusionar);

        UPDATE public.comentarios_orden
        SET id_orden = ficha_original_id
        WHERE id_orden = ANY(fichas_a_fusionar);

        UPDATE public.tarea_subitems
        SET id_orden = ficha_original_id
        WHERE id_orden = ANY(fichas_a_fusionar);

        UPDATE public.archivos_adjuntos
        SET id_orden = ficha_original_id
        WHERE id_orden = ANY(fichas_a_fusionar);

        UPDATE public.enlaces_adjuntos
        SET id_orden = ficha_original_id
        WHERE id_orden = ANY(fichas_a_fusionar);

        UPDATE public.orden_materiales
        SET id_orden = ficha_original_id
        WHERE id_orden = ANY(fichas_a_fusionar)
          AND NOT EXISTS (
            SELECT 1
            FROM public.orden_materiales om2
            WHERE om2.id_orden = ficha_original_id
              AND om2.id_material = orden_materiales.id_material
          );

        DELETE FROM public.ordenes_trabajo
        WHERE id = ANY(fichas_a_fusionar);
      END IF;

      UPDATE public.ordenes_trabajo
      SET
        estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller',
        es_duplicado = false,
        sectores = COALESCE(NEW.sectores, sectores),
        ubicacion_final = COALESCE(NEW.ubicacion_final, ubicacion_previa, ubicacion_final),
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
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
