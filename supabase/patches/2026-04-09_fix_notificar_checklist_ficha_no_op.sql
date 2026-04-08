-- Corrige notificar_checklist_ficha_no_op: columnas user_notifications (is_read, orden_id) y type válido para el CHECK.
BEGIN;

CREATE OR REPLACE FUNCTION public.notificar_checklist_ficha_no_op(
  p_id_orden integer,
  p_tipo_checklist text,
  p_numero_op text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_desc text;
  v_tipo_notif text := 'dt_checklist';
  v_dest_rol text;
  u record;
BEGIN
  IF p_tipo_checklist = 'ficha_tecnica_cargada' THEN
    v_title := 'DT · Ficha técnica cargada';
    v_desc := format('La ficha técnica de %s fue cargada.', coalesce(p_numero_op, 'Sin ficha'));
    v_dest_rol := 'presupuestos';
  ELSIF p_tipo_checklist = 'presupuesto_enviado' THEN
    v_title := 'DT · Presupuesto enviado';
    v_desc := format('El presupuesto de %s fue enviado al cliente.', coalesce(p_numero_op, 'Sin ficha'));
    v_dest_rol := 'asesor-tecnico';
  ELSIF p_tipo_checklist = 'presupuesto_armado' THEN
    v_title := 'DT · Presupuesto armado';
    v_desc := format('El presupuesto de %s está armado.', coalesce(p_numero_op, 'Sin ficha'));
    v_dest_rol := 'asesor-tecnico';
  ELSIF p_tipo_checklist = 'presupuesto_en_espera' THEN
    v_title := 'DT · Presupuesto en espera';
    v_desc := format('El presupuesto de %s quedó en espera.', coalesce(p_numero_op, 'Sin ficha'));
    v_dest_rol := 'asesor-tecnico';
  ELSE
    v_title := 'DT · Checklist actualizado';
    v_desc := format('Se actualizó un checklist (%s) en %s.', p_tipo_checklist, coalesce(p_numero_op, 'Sin ficha'));
    v_dest_rol := NULL;
  END IF;

  BEGIN
    PERFORM public.registrar_cambio_manual_v2(
      p_id_orden,
      1,
      'Sistema',
      NULL,
      NULL,
      v_desc,
      'checklist',
      jsonb_build_object('tipo_checklist', p_tipo_checklist)
    );
  EXCEPTION WHEN undefined_function THEN
    INSERT INTO public.historial_movimientos (
      id_orden,
      estado_anterior,
      estado_nuevo,
      id_usuario,
      nombre_usuario,
      timestamp,
      comentario,
      accion_tipo,
      cambios_detallados
    ) VALUES (
      p_id_orden,
      NULL,
      NULL,
      1,
      'Sistema',
      now(),
      v_desc,
      'checklist',
      jsonb_build_object('tipo_checklist', p_tipo_checklist)
    );
  END;

  IF v_dest_rol IS NOT NULL THEN
    FOR u IN
      SELECT id
      FROM public.usuarios
      WHERE rol = v_dest_rol
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id,
          type,
          title,
          description,
          orden_id,
          is_read
        ) VALUES (
          u.id,
          'info',
          v_title,
          v_desc || ' [' || v_tipo_notif || ']',
          p_id_orden,
          false
        );
      EXCEPTION WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        -- Columnas distintas en otros entornos: no romper checklist
        NULL;
      END;
    END LOOP;
  END IF;
END;
$$;

COMMIT;
