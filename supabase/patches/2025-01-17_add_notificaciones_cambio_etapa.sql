-- Trigger para notificar cuando cambia la etapa de Taller Gráfico

BEGIN;

-- Función para notificar cambio de etapa
CREATE OR REPLACE FUNCTION public.notify_cambio_etapa_taller_grafico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id_destino integer;
  notification_title text;
  notification_desc text;
  usuarios_taller record;
  operario_nombre varchar(255);
BEGIN
  -- Solo notificar si cambió la etapa
  IF OLD.etapa_taller_grafico IS DISTINCT FROM NEW.etapa_taller_grafico 
     AND NEW.etapa_taller_grafico IS NOT NULL THEN
    
    -- Obtener nombre del operario (usar operario_asignado o usuario_trabajando_nombre como fallback)
    -- Manejar el caso donde operario_asignado pueda no existir
    BEGIN
      operario_nombre := COALESCE(
        NULLIF(trim(NEW.operario_asignado), ''),
        NULLIF(trim(NEW.usuario_trabajando_nombre), ''),
        NULL
      );
    EXCEPTION WHEN undefined_column THEN
      -- Si operario_asignado no existe, usar solo usuario_trabajando_nombre
      operario_nombre := COALESCE(
        NULLIF(trim(NEW.usuario_trabajando_nombre), ''),
        NULL
      );
    END;
    
    -- Notificar al operario asignado si existe
    IF operario_nombre IS NOT NULL THEN
      SELECT id INTO user_id_destino
      FROM public.usuarios
      WHERE nombre = operario_nombre
      LIMIT 1;
      
      IF user_id_destino IS NOT NULL THEN
        notification_title := 'Cambio de etapa en Taller Gráfico';
        notification_desc := format('La orden #%s (%s) cambió de etapa: "%s" → "%s"', 
          NEW.numero_op, NEW.cliente, 
          COALESCE(OLD.etapa_taller_grafico, 'Sin etapa'), 
          NEW.etapa_taller_grafico);
        
        BEGIN
          INSERT INTO public.user_notifications (
            user_id, title, description, type, orden_id, is_read
          ) VALUES (
            user_id_destino, notification_title, notification_desc, 'info', NEW.id, false
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Error creando notificación de cambio de etapa: %', SQLERRM;
        END;
      END IF;
    END IF;
    
    -- Notificar a todos los usuarios de taller-grafico y administracion
    FOR usuarios_taller IN 
      SELECT id, nombre 
      FROM public.usuarios 
      WHERE rol IN ('taller-grafico', 'administracion', 'gerencia')
        AND (operario_nombre IS NULL OR nombre != operario_nombre)
    LOOP
      BEGIN
        notification_title := 'Cambio de etapa en Taller Gráfico';
        notification_desc := format('La orden #%s (%s) cambió de etapa: "%s" → "%s"', 
          NEW.numero_op, NEW.cliente, 
          COALESCE(OLD.etapa_taller_grafico, 'Sin etapa'), 
          NEW.etapa_taller_grafico);
        
        INSERT INTO public.user_notifications (
          user_id, title, description, type, orden_id, is_read
        ) VALUES (
          usuarios_taller.id, notification_title, notification_desc, 'info', NEW.id, false
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario %: %', usuarios_taller.nombre, SQLERRM;
      END;
    END LOOP;
    
    -- Notificar al creador si es diferente del operario
    IF NEW.nombre_creador IS NOT NULL 
       AND trim(NEW.nombre_creador) != '' 
       AND (operario_nombre IS NULL OR trim(NEW.nombre_creador) != trim(operario_nombre)) THEN
      SELECT id INTO user_id_destino
      FROM public.usuarios
      WHERE nombre = NEW.nombre_creador
      LIMIT 1;
      
      IF user_id_destino IS NOT NULL THEN
        notification_title := 'Cambio de etapa en tu orden';
        notification_desc := format('La orden #%s (%s) cambió de etapa: "%s" → "%s"', 
          NEW.numero_op, NEW.cliente, 
          COALESCE(OLD.etapa_taller_grafico, 'Sin etapa'), 
          NEW.etapa_taller_grafico);
        
        BEGIN
          INSERT INTO public.user_notifications (
            user_id, title, description, type, orden_id, is_read
          ) VALUES (
            user_id_destino, notification_title, notification_desc, 'info', NEW.id, false
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Error creando notificación para creador: %', SQLERRM;
        END;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para notificaciones de cambio de etapa
DROP TRIGGER IF EXISTS trigger_notify_cambio_etapa_taller_grafico ON public.ordenes_trabajo;
CREATE TRIGGER trigger_notify_cambio_etapa_taller_grafico
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (OLD.etapa_taller_grafico IS DISTINCT FROM NEW.etapa_taller_grafico)
  EXECUTE FUNCTION public.notify_cambio_etapa_taller_grafico();

COMMIT;
