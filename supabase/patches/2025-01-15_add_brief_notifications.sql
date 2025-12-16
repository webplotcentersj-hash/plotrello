-- Función helper para obtener usuarios de diseño gráfico y admin
CREATE OR REPLACE FUNCTION public.get_usuarios_diseno_admin()
RETURNS TABLE (user_id integer, user_nombre varchar(255), user_rol varchar(50))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre, u.rol
  FROM public.usuarios u
  WHERE u.rol IN ('diseno', 'administracion', 'gerencia')
  ORDER BY u.id;
END;
$$;

-- Trigger para notificar cuando se crea un nuevo brief público
CREATE OR REPLACE FUNCTION public.notify_new_brief()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  notification_count integer := 0;
BEGIN
  -- Notificar a usuarios de diseño gráfico y admin cuando se crea un brief
  FOR user_record IN 
    SELECT * FROM public.get_usuarios_diseno_admin()
  LOOP
    BEGIN
      INSERT INTO public.user_notifications (
        user_id, title, description, type, is_read
      ) VALUES (
        user_record.user_id,
        '📋 Nuevo Brief Público Creado',
        format('Se creó un nuevo brief público. Cliente: %s', 
          COALESCE(NEW.cliente_nombre_completo, 'Sin nombre')),
        'info',
        false
      );
      notification_count := notification_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creando notificación para usuario %: %', 
        user_record.user_nombre, SQLERRM;
    END;
  END LOOP;
  
  IF notification_count > 0 THEN
    RAISE NOTICE '✅ Notificaciones enviadas a % usuarios sobre nuevo brief', notification_count;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para notificar cuando se completa un brief (cuando el cliente lo envía)
CREATE OR REPLACE FUNCTION public.notify_brief_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  notification_count integer := 0;
BEGIN
  -- Solo notificar si el brief se marcó como completado (antes no estaba completado)
  IF NEW.completado = true AND (OLD.completado IS NULL OR OLD.completado = false) THEN
    FOR user_record IN 
      SELECT * FROM public.get_usuarios_diseno_admin()
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, is_read
        ) VALUES (
          user_record.user_id,
          '✅ Brief Público Completado',
          format('Un cliente completó el brief público. Cliente: %s%s', 
            COALESCE(NEW.cliente_nombre_completo, 'Sin nombre'),
            CASE WHEN NEW.es_urgencia THEN ' ⚠️ URGENCIA' ELSE '' END),
          CASE WHEN NEW.es_urgencia THEN 'warning' ELSE 'success' END,
          false
        );
        notification_count := notification_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario %: %', 
          user_record.user_nombre, SQLERRM;
      END;
    END LOOP;
    
    IF notification_count > 0 THEN
      RAISE NOTICE '✅ Notificaciones enviadas a % usuarios sobre brief completado', notification_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear triggers
DROP TRIGGER IF EXISTS trigger_notify_new_brief ON public.briefs_publicos;
CREATE TRIGGER trigger_notify_new_brief
  AFTER INSERT ON public.briefs_publicos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_brief();

DROP TRIGGER IF EXISTS trigger_notify_brief_completed ON public.briefs_publicos;
CREATE TRIGGER trigger_notify_brief_completed
  AFTER UPDATE ON public.briefs_publicos
  FOR EACH ROW
  WHEN (NEW.completado IS DISTINCT FROM OLD.completado)
  EXECUTE FUNCTION public.notify_brief_completed();

COMMENT ON FUNCTION public.get_usuarios_diseno_admin IS 'Obtiene usuarios con rol de diseño gráfico, administración o gerencia';
COMMENT ON FUNCTION public.notify_new_brief IS 'Notifica a usuarios de diseño y admin cuando se crea un nuevo brief público';
COMMENT ON FUNCTION public.notify_brief_completed IS 'Notifica a usuarios de diseño y admin cuando un cliente completa un brief público';

