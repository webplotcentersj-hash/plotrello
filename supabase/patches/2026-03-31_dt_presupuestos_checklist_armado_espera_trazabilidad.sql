-- DT (Asesor Técnico / Presupuestos)
-- Checklist extra en Presupuestos: Armado + En espera
-- + registrar en historial_movimientos (trazabilidad) al tildar.

BEGIN;

-- 1) Campos nuevos en ordenes_trabajo
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS presupuesto_armado boolean DEFAULT false;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS presupuesto_en_espera boolean DEFAULT false;

COMMENT ON COLUMN public.ordenes_trabajo.presupuesto_armado IS 'DT: Presupuestos checklist - armado';
COMMENT ON COLUMN public.ordenes_trabajo.presupuesto_en_espera IS 'DT: Presupuestos checklist - en espera';

-- 2) Extender RPC de notificación/checklist para incluir trazabilidad.
-- Nota: la app llama a `notificar_checklist_ficha_no_op(p_id_orden, p_tipo_checklist, p_numero_op)`.
CREATE OR REPLACE FUNCTION public.notificar_checklist_ficha_no_op(
  p_id_orden integer,
  p_tipo_checklist text,
  p_numero_op text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title text;
  v_desc text;
  v_tipo_notif text := 'dt_checklist';
  v_dest_rol text;
  u record;
BEGIN
  -- Mensaje + destino por tipo
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

  -- 2.a) Registrar trazabilidad (historial_movimientos)
  -- Usa la función robusta si existe, sino inserta directo.
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

  -- 2.b) Crear notificación interna (best-effort)
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
          related_id,
          read
        ) VALUES (
          u.id,
          v_tipo_notif,
          v_title,
          v_desc,
          p_id_orden::text,
          false
        );
      EXCEPTION WHEN undefined_table THEN
        -- Si no existe la tabla en este proyecto, no romper la operación.
        NULL;
      END;
    END LOOP;
  END IF;
END;
$$;

COMMIT;

