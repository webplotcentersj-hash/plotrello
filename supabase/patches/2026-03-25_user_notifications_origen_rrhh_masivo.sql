-- Marca notificaciones del notificador masivo RRHH (Recursos Humanos → Notificador).
-- Permite filtrar en la app sin mezclar con avisos de OP, pedidos, menciones, etc.

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'sistema';

COMMENT ON COLUMN public.user_notifications.origen IS
  'sistema: triggers y app; rrhh_masivo: enviadas desde enviar_notificacion_masiva (RRHH).';

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_origen_ts
  ON public.user_notifications (user_id, origen, "timestamp" DESC);

-- Reemplazar función: los INSERT del notificador masivo llevan origen = rrhh_masivo
CREATE OR REPLACE FUNCTION public.enviar_notificacion_masiva(
  p_titulo varchar(255),
  p_descripcion text,
  p_tipo varchar(50) DEFAULT 'info',
  p_rol_filtro varchar(50) DEFAULT NULL,
  p_sector_filtro text DEFAULT NULL,
  p_enviar_a_todos boolean DEFAULT false,
  p_id_usuario_emisor integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notificaciones_creadas integer := 0;
  v_usuarios_notificados integer := 0;
  v_result jsonb;
  user_record record;
BEGIN
  IF NOT p_enviar_a_todos AND p_rol_filtro IS NULL AND p_sector_filtro IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Debe especificar al menos un filtro (todos, rol, o sector)',
      'notificaciones_creadas', 0
    );
  END IF;

  IF p_enviar_a_todos THEN
    FOR user_record IN
      SELECT id, nombre, rol
      FROM public.usuarios
      ORDER BY id
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, is_read, origen
        ) VALUES (
          user_record.id,
          p_titulo,
          p_descripcion,
          COALESCE(p_tipo, 'info'),
          false,
          'rrhh_masivo'
        );
        v_notificaciones_creadas := v_notificaciones_creadas + 1;
        v_usuarios_notificados := v_usuarios_notificados + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario %: %',
          user_record.nombre, SQLERRM;
      END;
    END LOOP;
  END IF;

  IF p_rol_filtro IS NOT NULL AND NOT p_enviar_a_todos THEN
    FOR user_record IN
      SELECT id, nombre, rol
      FROM public.usuarios
      WHERE rol = p_rol_filtro
      ORDER BY id
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, is_read, origen
        ) VALUES (
          user_record.id,
          p_titulo,
          p_descripcion,
          COALESCE(p_tipo, 'info'),
          false,
          'rrhh_masivo'
        );
        v_notificaciones_creadas := v_notificaciones_creadas + 1;
        v_usuarios_notificados := v_usuarios_notificados + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario %: %',
          user_record.nombre, SQLERRM;
      END;
    END LOOP;
  END IF;

  IF p_sector_filtro IS NOT NULL AND NOT p_enviar_a_todos THEN
    FOR user_record IN
      SELECT DISTINCT u.id, u.nombre, u.rol
      FROM public.usuarios u
      INNER JOIN public.ordenes_trabajo ot ON (
        ot.usuario_trabajando_id = u.id
        OR ot.id_usuario_creador = u.id
        OR ot.sector = p_sector_filtro
      )
      WHERE ot.sector = p_sector_filtro
      ORDER BY u.id
    LOOP
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.user_notifications
          WHERE user_id = user_record.id
            AND title = p_titulo
            AND description = p_descripcion
            AND "timestamp" > NOW() - INTERVAL '1 minute'
        ) THEN
          INSERT INTO public.user_notifications (
            user_id, title, description, type, is_read, origen
          ) VALUES (
            user_record.id,
            p_titulo,
            p_descripcion,
            COALESCE(p_tipo, 'info'),
            false,
            'rrhh_masivo'
          );
          v_notificaciones_creadas := v_notificaciones_creadas + 1;
          v_usuarios_notificados := v_usuarios_notificados + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario %: %',
          user_record.nombre, SQLERRM;
      END;
    END LOOP;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'notificaciones_creadas', v_notificaciones_creadas,
    'usuarios_notificados', v_usuarios_notificados,
    'mensaje', format('Se enviaron %s notificaciones a %s usuarios',
      v_notificaciones_creadas, v_usuarios_notificados)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.enviar_notificacion_masiva IS
  'Notificador masivo RRHH: inserta user_notifications con origen = rrhh_masivo.';
