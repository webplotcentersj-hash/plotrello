-- Al editar una OP y ampliar sectores[], propagar el array a todo el grupo (misma numero_op / id_orden_original)
-- y crear fichas duplicadas faltantes (paridad con trigger crear_fichas_por_sector en INSERT).
-- La app llama a sync_op_grupo_sectores_y_fichas(p_orden_id) tras guardar el modal de edición.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_op_grupo_sectores_y_fichas(p_orden_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src record;
  v_root_id integer;
  v_template record;
  sector_nombre text;
  i integer;
  total integer;
  sector_ya_creado boolean;
  ficha_id integer;
BEGIN
  SELECT * INTO v_src FROM public.ordenes_trabajo WHERE id = p_orden_id;
  IF NOT FOUND THEN
    RAISE NOTICE 'sync_op_grupo: orden % no existe', p_orden_id;
    RETURN;
  END IF;

  IF COALESCE(v_src.es_duplicado, false) THEN
    v_root_id := v_src.id_orden_original;
  ELSE
    v_root_id := v_src.id;
  END IF;

  IF v_root_id IS NULL THEN
    RETURN;
  END IF;

  -- Unificar lista de sectores en todas las filas del grupo
  UPDATE public.ordenes_trabajo
  SET sectores = v_src.sectores
  WHERE id = v_root_id OR id_orden_original = v_root_id;

  IF v_src.sectores IS NULL OR array_length(v_src.sectores, 1) IS NULL OR array_length(v_src.sectores, 1) <= 1 THEN
    RETURN;
  END IF;

  SELECT * INTO v_template FROM public.ordenes_trabajo WHERE id = v_root_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_template.estado = 'Finalizado en Taller' THEN
    RAISE NOTICE 'sync_op_grupo: OP % en Finalizado en Taller — no se crean fichas nuevas por sectores', v_template.numero_op;
    RETURN;
  END IF;

  total := array_length(v_template.sectores, 1);

  FOR i IN 2..total LOOP
    sector_nombre := v_template.sectores[i];

    SELECT EXISTS (
      SELECT 1 FROM public.ordenes_trabajo
      WHERE (
        (id_orden_original = v_root_id AND sector = sector_nombre AND es_duplicado = true)
        OR
        (id_orden_original IS NULL
         AND numero_op = v_template.numero_op
         AND sector = sector_nombre
         AND id <> v_root_id
         AND es_duplicado = true)
      )
    ) INTO sector_ya_creado;

    IF NOT sector_ya_creado THEN
      INSERT INTO public.ordenes_trabajo (
        numero_op, cliente, descripcion, estado, prioridad, fecha_entrega,
        operario_asignado, complejidad, sector, sectores, sector_inicial,
        materiales, nombre_creador, telefono_cliente, email_cliente,
        direccion_cliente, whatsapp_link, ubicacion_link, drive_link,
        foto_url, dni_cuit, es_duplicado, id_orden_original,
        fecha_creacion, fecha_ingreso, id_usuario_creador,
        etiquetas, brief_publico, objetivo_proyecto, publico_objetivo,
        estilo_diseno, referencias, deadline_brief
      ) VALUES (
        v_template.numero_op, v_template.cliente, v_template.descripcion,
        sector_nombre,
        v_template.prioridad, v_template.fecha_entrega, v_template.operario_asignado,
        v_template.complejidad, sector_nombre, v_template.sectores, sector_nombre,
        v_template.materiales, v_template.nombre_creador, v_template.telefono_cliente,
        v_template.email_cliente, v_template.direccion_cliente, v_template.whatsapp_link,
        v_template.ubicacion_link, v_template.drive_link, v_template.foto_url, v_template.dni_cuit,
        true,
        v_root_id,
        v_template.fecha_creacion, v_template.fecha_ingreso,
        v_template.id_usuario_creador,
        v_template.etiquetas, v_template.brief_publico, v_template.objetivo_proyecto,
        v_template.publico_objetivo, v_template.estilo_diseno, v_template.referencias,
        v_template.deadline_brief
      )
      RETURNING id INTO ficha_id;

      RAISE NOTICE 'sync_op_grupo: creada ficha sector % id % (root %)', sector_nombre, ficha_id, v_root_id;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.sync_op_grupo_sectores_y_fichas(integer) IS
  'Tras editar sectores[]: propaga el array al grupo de la OP y crea duplicadas faltantes (como en INSERT).';

GRANT EXECUTE ON FUNCTION public.sync_op_grupo_sectores_y_fichas(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.sync_op_grupo_sectores_y_fichas(integer) TO authenticated;

COMMIT;
