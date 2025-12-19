-- Trigger para notificar a todos los usuarios de un sector cuando se crea una nueva orden
-- Este script modifica la función notify_new_orden para notificar a todos los usuarios del sector

BEGIN;

-- ============================================
-- FUNCIÓN: Obtener usuarios de un sector
-- Usa la tabla usuario_sectores si existe, sino usa mapeo por roles
-- ============================================
CREATE OR REPLACE FUNCTION public.get_users_by_sector(sector_nombre text)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists boolean;
  query_result record;
BEGIN
  -- Verificar si la tabla usuario_sectores existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'usuario_sectores'
  ) INTO table_exists;
  
  -- Si la tabla existe, intentar usarla con SQL dinámico
  IF table_exists THEN
    BEGIN
      -- Usar SQL dinámico para evitar errores de compilación si la tabla no existe
      FOR query_result IN
        EXECUTE '
          SELECT DISTINCT u.id AS user_id, u.nombre::text AS user_nombre
          FROM public.usuarios u
          INNER JOIN public.usuario_sectores us ON u.id = us.usuario_id
          INNER JOIN public.sectores s ON us.sector_id = s.id
          WHERE s.nombre = $1
          ORDER BY u.nombre
        ' USING sector_nombre
      LOOP
        user_id := query_result.user_id;
        user_nombre := query_result.user_nombre;
        RETURN NEXT;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      -- Si hay error (tabla no existe o no tiene datos), usar fallback
      RAISE WARNING 'Error usando usuario_sectores, usando fallback: %', SQLERRM;
      table_exists := false;
    END;
  END IF;
  
  -- Fallback: mapeo de sectores a roles (si la tabla no existe o hubo error)
  IF NOT table_exists THEN
    RETURN QUERY
    SELECT u.id::integer AS user_id, u.nombre::text AS user_nombre
    FROM public.usuarios u
    WHERE 
      -- Mapeo de sectores a roles
      (
        (sector_nombre = 'Taller de Imprenta' AND (u.rol = 'imprenta' OR u.rol = 'taller-grafico')) OR
        (sector_nombre = 'Taller Gráfico' AND u.rol = 'taller-grafico') OR
        (sector_nombre = 'Metalúrgica' AND u.rol = 'metalurgica') OR
        (sector_nombre = 'Mostrador' AND u.rol = 'mostrador') OR
        (sector_nombre = 'Caja' AND u.rol = 'caja') OR
        (sector_nombre = 'Diseño Gráfico' AND (u.rol = 'diseno' OR u.rol = 'administracion')) OR
        (sector_nombre = 'Instalaciones' AND u.rol = 'instalaciones') OR
        (sector_nombre = 'Asesor Técnico' AND (u.rol = 'asesor-tecnico' OR u.rol = 'administracion')) OR
        (sector_nombre = 'Presupuestos' AND (u.rol = 'presupuestos' OR u.rol = 'asesor-tecnico' OR u.rol = 'administracion'))
      )
    ORDER BY u.nombre;
  END IF;
END;
$$;

-- ============================================
-- FUNCIÓN MEJORADA: Notificar cuando se crea una nueva orden
-- Notifica a todos los usuarios del sector asignado
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  notification_count integer := 0;
BEGIN
  -- Si hay un sector asignado, notificar a todos los usuarios de ese sector
  IF NEW.sector IS NOT NULL AND trim(NEW.sector) != '' THEN
    FOR user_record IN 
      SELECT * FROM public.get_users_by_sector(NEW.sector)
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, orden_id, is_read
        ) VALUES (
          user_record.user_id,
          '📋 Nueva orden en tu sector',
          format('Se creó la orden #%s (%s) en el sector "%s"', 
            NEW.numero_op, NEW.cliente, NEW.sector),
          'success',
          NEW.id,
          false
        );
        notification_count := notification_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación para usuario % (sector %): %', 
          user_record.user_nombre, NEW.sector, SQLERRM;
      END;
    END LOOP;
    
    IF notification_count > 0 THEN
      RAISE NOTICE '✅ Notificaciones enviadas a % usuarios del sector "%s"', notification_count, NEW.sector;
    ELSE
      RAISE NOTICE '⚠️ No se encontraron usuarios para el sector "%s"', NEW.sector;
    END IF;
  END IF;
  
  -- También notificar al operario asignado específicamente (si es diferente de los usuarios del sector)
  IF NEW.operario_asignado IS NOT NULL AND trim(NEW.operario_asignado) != '' THEN
    DECLARE
      user_id_destino integer;
      already_notified boolean := false;
    BEGIN
      -- Verificar si ya fue notificado como parte del sector
      SELECT EXISTS (
        SELECT 1 FROM public.get_users_by_sector(NEW.sector) g
        WHERE g.user_nombre = NEW.operario_asignado
      ) INTO already_notified;
      
      -- Si no fue notificado como parte del sector, notificar específicamente
      IF NOT already_notified THEN
        user_id_destino := public.get_user_id_from_nombre(NEW.operario_asignado);
        
        IF user_id_destino IS NOT NULL THEN
          BEGIN
            INSERT INTO public.user_notifications (
              user_id, title, description, type, orden_id, is_read
            ) VALUES (
              user_id_destino,
              'Nueva orden asignada',
              format('Te asignaron la orden #%s: %s', NEW.numero_op, NEW.cliente),
              'success',
              NEW.id,
              false
            );
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creando notificación para operario asignado: %', SQLERRM;
          END;
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recrear el trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_notify_new_orden ON public.ordenes_trabajo;
    CREATE TRIGGER trigger_notify_new_orden
      AFTER INSERT ON public.ordenes_trabajo
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_new_orden();
    
    RAISE NOTICE '✅ Trigger de nueva orden actualizado (notifica a todos los usuarios del sector)';
  END IF;
END $$;

COMMIT;

