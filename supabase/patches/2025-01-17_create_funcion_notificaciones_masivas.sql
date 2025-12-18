-- Función para enviar notificaciones masivas desde Recursos Humanos
-- Permite enviar notificaciones a todos los usuarios, por rol, o por sector

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
AS $$
DECLARE
  v_notificaciones_creadas integer := 0;
  v_usuarios_notificados integer := 0;
  v_result jsonb;
  user_record record;
BEGIN
  -- Validar que al menos un filtro esté activo
  IF NOT p_enviar_a_todos AND p_rol_filtro IS NULL AND p_sector_filtro IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Debe especificar al menos un filtro (todos, rol, o sector)',
      'notificaciones_creadas', 0
    );
  END IF;

  -- Enviar a todos los usuarios
  IF p_enviar_a_todos THEN
    FOR user_record IN 
      SELECT id, nombre, rol
      FROM public.usuarios
      ORDER BY id
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, is_read
        ) VALUES (
          user_record.id,
          p_titulo,
          p_descripcion,
          COALESCE(p_tipo, 'info'),
          false
        );
        v_notificaciones_creadas := v_notificaciones_creadas + 1;
        v_usuarios_notificados := v_usuarios_notificados + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario %: %', 
          user_record.nombre, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- Enviar por rol
  IF p_rol_filtro IS NOT NULL AND NOT p_enviar_a_todos THEN
    FOR user_record IN 
      SELECT id, nombre, rol
      FROM public.usuarios
      WHERE rol = p_rol_filtro
      ORDER BY id
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, is_read
        ) VALUES (
          user_record.id,
          p_titulo,
          p_descripcion,
          COALESCE(p_tipo, 'info'),
          false
        );
        v_notificaciones_creadas := v_notificaciones_creadas + 1;
        v_usuarios_notificados := v_usuarios_notificados + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario %: %', 
          user_record.nombre, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- Enviar por sector (basado en el sector de las órdenes de trabajo)
  IF p_sector_filtro IS NOT NULL AND NOT p_enviar_a_todos THEN
    -- Obtener usuarios que tienen órdenes en ese sector
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
        -- Verificar que no se haya creado ya una notificación para este usuario
        IF NOT EXISTS (
          SELECT 1 FROM public.user_notifications
          WHERE user_id = user_record.id
          AND title = p_titulo
          AND description = p_descripcion
          AND timestamp > NOW() - INTERVAL '1 minute'
        ) THEN
          INSERT INTO public.user_notifications (
            user_id, title, description, type, is_read
          ) VALUES (
            user_record.id,
            p_titulo,
            p_descripcion,
            COALESCE(p_tipo, 'info'),
            false
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

  -- Retornar resultado
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

-- Función para obtener estadísticas de notificaciones
CREATE OR REPLACE FUNCTION public.obtener_estadisticas_notificaciones()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_notificaciones', COUNT(*),
    'notificaciones_no_leidas', COUNT(*) FILTER (WHERE is_read = false),
    'notificaciones_leidas', COUNT(*) FILTER (WHERE is_read = true),
    'notificaciones_hoy', COUNT(*) FILTER (WHERE DATE(timestamp) = CURRENT_DATE),
    'notificaciones_semana', COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days'),
    'por_tipo', (
      SELECT jsonb_object_agg(type, count)
      FROM (
        SELECT type, COUNT(*) as count
        FROM public.user_notifications
        GROUP BY type
      ) sub
    )
  ) INTO v_result
  FROM public.user_notifications;

  RETURN v_result;
END;
$$;

