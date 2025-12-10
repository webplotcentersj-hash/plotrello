-- Limpieza para casos ya en "Finalizado en Taller" que no se unificaron.
DO $$
DECLARE
  grp RECORD;
  orig_id INTEGER;
  latest_id INTEGER;
  latest_ubicacion TEXT;
BEGIN
  FOR grp IN
    SELECT numero_op,
           MIN(id) AS min_id,
           MAX(id) AS max_id,
           ARRAY_AGG(id) AS ids,
           ARRAY_AGG(ubicacion_final ORDER BY id DESC) FILTER (WHERE ubicacion_final IS NOT NULL) AS ubicaciones,
           MAX(array_length(sectores, 1)) AS max_sectores
    FROM public.ordenes_trabajo
    WHERE estado = 'Finalizado en Taller'
    GROUP BY numero_op
    HAVING COUNT(*) > 1
  LOOP
    -- identificar ficha original
    SELECT id INTO orig_id
    FROM public.ordenes_trabajo
    WHERE id = grp.min_id OR id_orden_original = grp.min_id
    ORDER BY es_duplicado ASC, id ASC
    LIMIT 1;

    IF orig_id IS NULL THEN
      orig_id := grp.min_id;
    END IF;

    latest_id := grp.max_id;
    latest_ubicacion := grp.ubicaciones[1];

    -- reasignar trazas a la original
    UPDATE public.historial_movimientos SET id_orden = orig_id WHERE id_orden = ANY(grp.ids);
    UPDATE public.comentarios_orden   SET id_orden = orig_id WHERE id_orden = ANY(grp.ids);
    UPDATE public.archivos_adjuntos   SET id_orden = orig_id WHERE id_orden = ANY(grp.ids);
    UPDATE public.enlaces_adjuntos    SET id_orden = orig_id WHERE id_orden = ANY(grp.ids);
    UPDATE public.orden_materiales    SET id_orden = orig_id WHERE id_orden = ANY(grp.ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.orden_materiales om2
        WHERE om2.id_orden = orig_id AND om2.id_material = orden_materiales.id_material
      );

    -- actualizar la original
    UPDATE public.ordenes_trabajo
    SET estado = 'Finalizado en Taller',
        sector = 'Finalizado en Taller',
        sector_inicial = 'Finalizado en Taller',
        es_duplicado = false,
        ubicacion_final = COALESCE(latest_ubicacion, ubicacion_final)
    WHERE id = orig_id;

    -- eliminar duplicadas (todas menos la original)
    DELETE FROM public.ordenes_trabajo
    WHERE id = ANY(grp.ids)
      AND id <> orig_id;
  END LOOP;
END $$;

